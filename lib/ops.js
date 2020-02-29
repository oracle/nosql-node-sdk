/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const assert = require('assert');

const ErrorCode = require('./error').ErrorCode;
const NoSQLError = require('./error').NoSQLError;
const NoSQLArgumentError = require('./error').NoSQLArgumentError;
const NoSQLProtocolError = require('./error').NoSQLProtocolError;
const TableState = require('./constants').TableState;
const AdminState = require('./constants').AdminState;
const Consistency = require('./constants').Consistency;
const Config = require('./config');
const Limits = require('./constants').Limits;
const isPosInt32 = require('./utils').isPosInt32;
const isPosInt32OrZero = require('./utils').isPosInt32OrZero;
const isPlainObject = require('./utils').isPlainObject;
const hasOwnProperty = require('./utils').hasOwnProperty;
const TTLUtil = require('./ttl_util');

//For advanced queries and other possible cases where continuation key is
//an object, this allows us to validate that user did not supply a bogus
//value that could cause internal failures down the line
const ccAsObj = Symbol('ccAsObj');

class Op {

    static _chkTblName(req) {
        if (!req.tableName || typeof req.tableName !== 'string') {
            throw new NoSQLArgumentError('Missing or invalid table name',
                req);
        }
    }

    //Reminder: "==" and "!=" treat null and undefined as equal

    static _chkKey(req) {
        if (typeof req.key === 'string') {
            try {
                req.key = JSON.parse(req.key);
            } catch(err) {
                throw new NoSQLArgumentError('Invalid JSON key', req, err);
            }
        }
        if (!isPlainObject(req.key)) {
            throw new NoSQLArgumentError('Invalid or missing key', req);
        }
    }

    static _chkRow(req) {
        if (typeof req.row === 'string') {
            try {
                req.row = JSON.parse(req.row);
            } catch(err) {
                throw new NoSQLArgumentError('Invalid JSON row', req, err);
            }
        }
        if (!isPlainObject(req.row)) {
            throw new NoSQLArgumentError('Invalid or missing row', req);
        }
    }

    static _chkConsistency(req) {
        if (!(req.opt.consistency instanceof Consistency)) {
            throw new NoSQLArgumentError('Invalid consistency', req);
        }
    }

    static _chkMatchVersion(req) {
        if (req.opt.matchVersion != null &&
            !(req.opt.matchVersion instanceof Buffer)) {
            throw new NoSQLArgumentError(
                'matchVersion must be instance of Buffer', req);
        }
    }

    static _chkContinuationKey(req) {
        const cc = req.opt.continuationKey;
        if (cc != null && !Buffer.isBuffer(cc) && !cc[ccAsObj]) {
            throw new NoSQLArgumentError('Invalid continuation key', req);
        }
    }

    static _validateDelay(req) {
        if (!isPosInt32(req.opt.delay)) {
            throw new NoSQLArgumentError('Invalid delay', req);
        }
        if (req.opt.timeout < req.opt.delay) {
            throw new NoSQLArgumentError('Timeout cannot be less than delay',
                req);
        }
    }

    static _validateFieldRange(req) {
        const fr = req.opt.fieldRange;
        if (fr == null) {
            return;
        }
        if (typeof fr !== 'object') {
            throw new NoSQLArgumentError('Invalid field range', req);
        }
        if (typeof fr.fieldName !== 'string' || !fr.fieldName.length) {
            throw new NoSQLArgumentError('Invalid field name in field range',
                req);
        }
        if (fr.startWith == null && fr.startAfter == null &&
            fr.endWith == null && fr.endBefore == null) {
            throw new NoSQLArgumentError('Missing bounds in field range');
        }
        if ((fr.startWith != null && fr.startAfter != null) ||
            (fr.endWith != null && fr.endBefore != null)) {
            throw new NoSQLArgumentError('Both inclusive and exclusive bound \
specified for one end of field range');
        }
    }

    //Here we will conver the value to long so that we don't have to do this
    //again during serialization.  We accept any valid Date values as well as
    //any number or string value passed to Date constructor (we will use
    //the value from the resulting Date.getTime()).  Javascript Date range is
    //+-100000 days since/before epoch, which is subset of java.util.Date
    //range so we should be ok on the server side.
    static _validateDateField(req, obj, field) {
        if (obj[field] == null) {
            return;
        }
        let d = obj[field];
        let v;
        switch(typeof d) {
        case 'number':
            v = new Date(d).getTime();
            break;
        case 'string':
            v = Date.parse(d);
            break;
        case 'object':
            if (d instanceof Date) {
                v = d.getTime();
            }
        default:
            break;
        }
        if (!Number.isInteger(v)) {
            throw new NoSQLArgumentError(`Invalid ${field} value`, req);
        }
        obj[field] = v;
    }

    static _validateOpt(req) {
        //Check that opt did not specify properties that it is not allowed
        //to override
        for(let key of this.NO_OVERRIDE_OPTS) {
            if (hasOwnProperty(req.opt, key)) {
                throw new NoSQLArgumentError(
                    `Options may not override ${key}`, req);
            }
        }
    }

    static _validateRequest(req) {
        this._validateOpt(req);
        if (!isPosInt32(req.opt.timeout)) {
            throw new NoSQLArgumentError('Invalid timeout', req);
        }
        //set timeout to use for single request (vs timeout across retries)
        req.opt.requestTimeout = Math.min(req.opt.timeout,
            Limits.MAX_REQUEST_TIMEOUT);
    }

    static _validateReadRequest(req) {
        this._validateRequest(req);
        this._chkTblName(req);
        this._chkConsistency(req);
    }

    static _validateWriteRequest(req) {
        this._validateRequest(req);
        this._chkTblName(req);
    }

    static get REQUEST_SIZE_LIMIT() {
        return Limits.REQUEST_SIZE;
    }

    static _chkRequestSizeLimit(req, len) {
        if (len > this.REQUEST_SIZE_LIMIT) {
            throw new NoSQLError(ErrorCode.REQUEST_SIZE_LIMIT_EXCEEDED,
                `Request size ${len} exceeds the limit of ` +
                `${this.REQUEST_SIZE_LIMIT}`,
                null,
                req);
        }
    }

    static chkRequestSizeLimit(dw, req) {
        this._chkRequestSizeLimit(req, dw.buffer.length);
    }

    static serialize(pm, dw, req) {
        try {
            pm.serializer(this.name).serialize(dw, req);
            this.chkRequestSizeLimit(dw, req);
        } catch(err) {
            throw new NoSQLArgumentError('Error processing request', req,
                err);
        }
    }

    //req argument is only needed for PrepareSerializer.deserialize()
    //and QuerySerializer.deserialize()
    static deserialize(pm, dr, req) {
        try {
            return pm.serializer(this.name).deserialize(dr, req);
        } catch(err) {
            throw new NoSQLProtocolError('Error in service protocol for ' +
                `operation ${this.name}: ${err.message}`, err, req);
        }
    }

    static applyDefaults(req, def) {
        req.opt = Config.inheritOpt(req.opt, def, req);
    }

    static onResult(client, req, res) {
        if (res.consumedCapacity) {
            client.emit('consumedCapacity', res.consumedCapacity, req);
        }
    }

    //Subclasses may provide req as an argument if needed
    static shouldRetry() {
        return true;
    }

}

//These parameters have to be specified in initial configuration and may not
//be overriden in options.
Op.NO_OVERRIDE_OPTS = [ 'serviceType', 'retry', 'auth' ];

class GetOp extends Op {

    static validate(req) {
        this._validateReadRequest(req);
        this._chkKey(req);
    }

}

class PutOp extends Op {

    static needUpdateTTL(req) {
        return req.opt.updateTTLToDefault || req.opt.ttl;
    }

    static _validateTTL(req) {
        if (req.opt.ttl == null) {
            return;
        }
        if (req.opt.updateTTLToDefault) {
            throw new NoSQLArgumentError('Cannot specify ' +
            '"updateTTLToDefault" option if TTL is specified', req);
        }
        req.opt.ttl = TTLUtil._validate(req.opt.ttl, req);
    }

    static validate(req, isSubRequest = false) {
        if (req.opt.ifAbsent && req.opt.ifPresent) {
            throw new NoSQLArgumentError('Options ifAbsent and ifPresent ' +
                'cannot be specified together', req);
        }
        if (req.opt.ifAbsent && req.opt.matchVersion != null) {
            throw new NoSQLArgumentError('matchVersion is not compatible ' +
            'with ifAbsent version', req);
        }
        if (req.opt.identityCacheSize != null &&
            !isPosInt32(req.opt.identityCacheSize)) {
            throw new NoSQLArgumentError('Invalid identity cache size', req);
        }
        if (!isSubRequest) {
            this._validateWriteRequest(req);
        } else {
            this._validateOpt(req);
        }
        this._chkRow(req);
        this._validateTTL(req);
        this._chkMatchVersion(req);
    }

}

class DeleteOp extends Op {

    static validate(req, isSubRequest = false) {
        if (!isSubRequest) {
            this._validateWriteRequest(req);
        } else {
            this._validateOpt(req);
        }
        this._chkKey(req);
        this._chkMatchVersion(req);
    }

}

class MultiDeleteOp extends Op {

    static validate(req) {
        this._validateWriteRequest(req);
        this._chkKey(req);
        this._validateFieldRange(req);
        //Not sure if we need to hardcode WRITE_KB_LIMIT here because
        //if it changes in the proxy, we may forget to change it in this
        //driver.  IMO, it is better to let proxy reject over-the-limit
        //values.
        if (req.opt.maxWriteKB != null) {
            if (!isPosInt32(req.opt.maxWriteKB)) {
                throw new NoSQLArgumentError('Invalid "maxWriteKB" value',
                    req);
            } else if (req.opt.maxWriteKB > Limits.WRITE_KB) {
                throw new NoSQLArgumentError('maxWriteKB value exceeds ' +
                    `limit of ${Limits.WRITE_KB}`, req);
            }
        }
        this._chkContinuationKey(req);
    }

}

class WriteMultipleOp extends Op {

    static get REQUEST_SIZE_LIMIT() {
        return Limits.BATCH_REQUEST_SIZE;
    }

    static _validateOp(op, idx, req) {
        //Here we will convert each op to canonical form to use by the
        //serializer. We also use options provided to the API for options
        //not provided for each individual op.

        //User-supplied options should be in op itself.  We make a copy of
        //op before inheriting to avoid changing op object itself just in
        //case, to avoid option name clashes.
        op.opt = Config.inheritOpt(Object.assign({}, op), req.opt);

        if (op.put != null) {
            if (op.delete != null) {
                throw new NoSQLArgumentError('Operation at index ' +
                    `${idx}: cannot have both put and delete`, req);
            }
            op.row = op.put;
            PutOp.validate(op, true);
        } else {
            if (op.delete == null) {
                throw new NoSQLArgumentError(
                    `Operation at index ${idx} does not have put ` +
                        'or delete', req);
            }
            op.key = op.delete;
            DeleteOp.validate(op, true);
        }
    }

    //validate and convert each op to canonical form having "opt" and
    //"row" or "key" properties for put/delete
    static validate(req) {
        this._validateWriteRequest(req);
        if ('rows' in req) {
            if (!Array.isArray(req.rows) || !req.rows.length) {
                throw new NoSQLArgumentError('Invalid rows array', req);
            }
            req.ops = req.rows.map(put => ({ put }));
        } else if ('keys' in req) {
            if (!Array.isArray(req.keys) || !req.keys.length) {
                throw new NoSQLArgumentError('Invalid keys array', req);
            }
            req.ops = req.keys.map(key => ({ delete: key }));    
        } else if (!Array.isArray(req.ops) || !req.ops.length) {
            throw new NoSQLArgumentError(
                'Missing, invalid or empty operations array', req);
        }
        if (req.ops.length > Limits.BATCH_OP_NUMBER) {
            throw new NoSQLArgumentError('Number of batch operations ' +
                `exceeds limit of ${Limits.BATCH_OP_NUMBER}`, req);
        }
        //Validation code in Java driver does not validate every operation
        //for WriteMultipleRequest.  Should we do it here?
        for(let i = 0; i < req.ops.length; i++) {
            const op = req.ops[i];
            if (op == null || typeof op !== 'object') {
                throw new NoSQLArgumentError(
                    `Invalid operation value at index ${i}`, req);
            }
            this._validateOp(op, i, req);
        }
    }

}

class TableDDLOp extends Op {

    static applyDefaults(req, def) {
        super.applyDefaults(req, def);
        if (req.opt.complete) {
            if (!hasOwnProperty(req.opt, 'timeout')) {
                req.opt.timeout = def.ddlTimeout + def.tablePollTimeout;
            }
            if (!hasOwnProperty(req.opt, 'delay')) {
                req.opt.delay = def.tablePollDelay;
            }
        } else if (!hasOwnProperty(req.opt, 'timeout')) {
            req.opt.timeout = def.ddlTimeout;
        }
    }

    static _validateTableLimits(req) {
        const tl = req.opt.tableLimits;
        if (tl == null || typeof tl !== 'object') {
            throw new NoSQLArgumentError('Invalid table limits', req);
        }
        if (!isPosInt32(tl.readUnits) || !isPosInt32(tl.writeUnits) ||
            !isPosInt32(tl.storageGB)) {
            throw new NoSQLArgumentError('Invalid table limits field values',
                req);
        }
    }

    static validate(req) {
        this._validateRequest(req);
        if (typeof req.stmt !== 'string' || !req.stmt.length) {
            throw new NoSQLArgumentError('Missing or invalid statement', req);
        }
        if (req.opt.tableLimits != null) {
            this._validateTableLimits(req);
        }
        if (req.opt.complete) {
            this._validateDelay(req);
        }
    }

    static onResult(client, req, res) {
        super.onResult(client, req, res);
        res._stmt = req.stmt;
        client.emit('tableState', res.tableName, res.tableState);
    }

    static shouldRetry() {
        return false;
    }

}

class TableLimitsOp extends TableDDLOp {

    static validate(req) {
        this._validateRequest(req);
        this._chkTblName(req);
        this._validateTableLimits(req);
    }

}

class GetTableOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        if (!req.tableName) {
            if (req.table == null) {
                throw new NoSQLArgumentError('Missing table argument', req);
            }
            if (typeof req.table === 'string') {
                req.tableName = req.table;
            } else if (isPlainObject(req.table) &&
                req.table.tableName != null) {
                req.tableName = req.table.tableName;
                req.opt.operationId = req.table.operationId;
            } else {
                throw new NoSQLArgumentError('Invalid table argument', req);
            }
        }
        if (req.opt.operationId != null &&
            (typeof req.opt.operationId !== 'string' ||
            !req.opt.operationId.length)) {
            throw new NoSQLArgumentError('Invalid operation id', req);
        }
        this._chkTblName(req);
    }

    static onResult(client, req, res) {
        TableDDLOp.onResult(client, req, res);
    }

}

class PollTableOp extends GetTableOp {
    
    static applyDefaults(req, def) {
        super.applyDefaults(req, def);
        if (!hasOwnProperty(req.opt, 'timeout')) {
            req.opt.timeout = def.tablePollTimeout;
        }
        if (!hasOwnProperty(req.opt, 'delay')) {
            req.opt.delay = def.tablePollDelay;
        }
    }

    static validate(req) {
        super.validate(req);
        if (!(req.tableState instanceof TableState)) {
            throw new NoSQLArgumentError('Invalid table state', req);
        }
        this._validateDelay(req);
    }
}

class TableUsageOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        this._chkTblName(req);
        this._validateDateField(req, req.opt, 'startTime');
        this._validateDateField(req, req.opt, 'endTime');
        if (req.opt.limit != null && !isPosInt32(req.opt.limit)) {
            throw new NoSQLArgumentError('Invalid limit', req);
        }
    }

    static shouldRetry() {
        return false;
    }

}

class GetIndexesOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        this._chkTblName(req);

        if ((req.opt.indexName != null || req.api.name === 'getIndex')  &&
            (typeof req.opt.indexName !== 'string' ||
            !req.opt.indexName.length)) {
            throw new NoSQLArgumentError('Invalid index name', req);
        }
    }

    static shouldRetry() {
        return false;
    }

}

class ListTablesOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        if (req.opt.startIndex != null &&
            !isPosInt32OrZero(req.opt.startIndex)) {
            throw new NoSQLArgumentError('Invalid start index', req);
        }
        if (req.opt.limit != null && !isPosInt32(req.opt.limit)) {
            throw new NoSQLArgumentError('Invalid limit', req);
        }
        if (req.opt.namespace != null &&
            typeof req.opt.namespace !== 'string') {
            throw new NoSQLArgumentError('Invalid namespace', req);
        }
    }

    static shouldRetry() {
        return false;
    }

}

class PrepareOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        if (typeof req.stmt !== 'string' || !req.stmt.length) {
            throw new NoSQLArgumentError('Invalid statement', req);
        }
    }
}

class QueryOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        this._chkConsistency(req);
        if (req.opt.limit != null && !isPosInt32(req.opt.limit)) {
            throw new NoSQLArgumentError('Invalid limit', req);
        }
        if (req.opt.limit != null && !isPosInt32(req.opt.limit)) {
            throw new NoSQLArgumentError('Invalid limit', req);
        }
        if (req.opt.maxReadKB != null) {
            if (!isPosInt32(req.opt.maxReadKB)) {
                throw new NoSQLArgumentError('Invalid maxReadKB', req);
            } else if (req.opt.maxReadKB > Limits.READ_KB) {
                throw new NoSQLArgumentError('maxReadKB value exceeds ' +
                    `limit of ${Limits.READ_KB}`, req);
            }
        }
        if (req.opt.maxWriteKB != null) {
            if (!isPosInt32(req.opt.maxWriteKB)) {
                throw new NoSQLArgumentError('Invalid "maxWriteKB" value',
                    req);
            } else if (req.opt.maxWriteKB > Limits.WRITE_KB) {
                throw new NoSQLArgumentError('maxWriteKB value exceeds ' +
                    `limit of ${Limits.WRITE_KB}`, req);
            }
        }
        if (req.opt.maxMemoryMB != null && !isPosInt32(req.opt.maxMemoryMB)) {
            throw new NoSQLArgumentError('Invalid "maxMemoryMB" value', req);
        }
        if (req.opt.traceLevel != null &&
            (!isPosInt32OrZero(req.opt.traceLevel) ||
            req.opt.traceLevel > 32)) {
            throw new NoSQLArgumentError(
                'Invalid trace level, must be <= 32', req);
        }
        this._chkContinuationKey(req);
        
        if (req.stmt != null) {
            assert(typeof req.stmt === 'string');
            if (!req.stmt.length) {
                throw new NoSQLArgumentError('Invalid statement', req);
            }
        } else {
            assert(req.prepStmt != null);
            if (typeof req.prepStmt !== 'object' ||
                !Buffer.isBuffer(req.prepStmt._prepStmt)) {
                throw new NoSQLArgumentError('Invalid prepared statement',
                    req);
            }
            if (req.prepStmt.bindings != null &&
                typeof req.prepStmt.bindings !== 'object') {
                throw new NoSQLArgumentError('Invalid bindings', req);
            }
        }
    }

    static onResult(client, req, res) {
        super.onResult(client, req, res);
        //Make continuation key ready for the next query() call
        let prepStmt;
        if (res._prepStmt) { //received prepared statement
            prepStmt = res._prepStmt;
            //advanced query will be executed on the next query() call,
            //so we need continuation key
            if (res._prepStmt._queryPlan) {
                res.continuationKey = { [ccAsObj]: true };
            }
            if (res.continuationKey) {
                res.continuationKey._prepStmt = prepStmt;
            }
        } else {
            prepStmt = req.prepStmt;
            if (res.continuationKey) {
                res.continuationKey._prepStmt = prepStmt;
            }
        }
        if (res._topoInfo) {
            prepStmt._topoInfo = res._topoInfo;
        }
    }

}

class AdminDDLOp extends Op {

    static applyDefaults(req, def) {
        super.applyDefaults(req, def);
        if (req.opt.complete) {
            if (!hasOwnProperty(req.opt, 'timeout')) {
                req.opt.timeout = def.ddlTimeout + def.adminPollTimeout;
            }
            if (!hasOwnProperty(req.opt, 'delay')) {
                req.opt.delay = def.adminPollDelay;
            }
        } else if (!hasOwnProperty(req.opt, 'timeout')) {
            req.opt.timeout = def.ddlTimeout;
        }
    }

    static validate(req) {
        this._validateRequest(req);
        if ((!Buffer.isBuffer(req.stmt) && typeof req.stmt !== 'string') ||
            !req.stmt.length) {
            throw new NoSQLArgumentError('Missing or invalid statement', req);
        }
        if (req.opt.complete) {
            this._validateDelay(req);
        }
    }

    static shouldRetry() {
        return false;
    }

    static onResult(client, req, res) {
        if (res.operationId == null && res.state !== AdminState.COMPLETE) {
            throw new NoSQLProtocolError('Missing operation id for \
incomplete admin result', null, req);
        }
        res._forAdmin = true;
    }

}

class AdminStatusOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        const res = req.adminResult;
        if (!isPlainObject(res)) {
            throw new NoSQLArgumentError('Missing or invalid admin result',
                req);
        }
        if (res.operationId == null) {
            //If operationId is null, the request is not sent to the server,
            //see NoSQLClientImpl._adminStatus()
            if (res.state !== AdminState.COMPLETE) {
                throw new NoSQLArgumentError('Missing operation id for \
incomplete admin result', req);
            }
        } else if (typeof res.operationId !== 'string' ||
            !res.operationId.length) {
            throw new NoSQLArgumentError('Invalid operation id', req);
        }
        if (res.statement != null && typeof res.statement !== 'string') {
            throw new NoSQLArgumentError('Invalid statememt', req);
        }
    }

    static onResult(client, req, res) {
        res._forAdmin = true;
    }

}

class AdminPollOp extends AdminStatusOp {
    
    static applyDefaults(req, def) {
        super.applyDefaults(req, def);
        if (!hasOwnProperty(req.opt, 'timeout')) {
            req.opt.timeout = def.adminPollTimeout;
        }
        if (!hasOwnProperty(req.opt, 'delay')) {
            req.opt.delay = def.adminPollDelay;
        }
    }

    static validate(req) {
        super.validate(req);
        this._validateDelay(req);
    }

}

module.exports = {
    Op,
    GetOp,
    PutOp,
    DeleteOp,
    MultiDeleteOp,
    WriteMultipleOp,
    TableDDLOp,
    TableLimitsOp,
    GetTableOp,
    TableUsageOp,
    GetIndexesOp,
    ListTablesOp,
    PrepareOp,
    QueryOp,
    PollTableOp,
    AdminDDLOp,
    AdminStatusOp,
    AdminPollOp,
    ccAsObj
};
