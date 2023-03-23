/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const ErrorCode = require('../error_code');
const NoSQLError = require('../error').NoSQLError;
const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const Consistency = require('../constants').Consistency;
const SyncPolicy = require('../durability').SyncPolicy;
const ReplicaAckPolicy = require('../durability').ReplicaAckPolicy;
const Limits = require('../constants').Limits;
const Config = require('../config');
const isPosInt32 = require('../utils').isPosInt32;
const isPlainObject = require('../utils').isPlainObject;
const hasOwnProperty = require('../utils').hasOwnProperty;

class Op {

    static _chkTblName(req) {
        if (!req.tableName || typeof req.tableName !== 'string') {
            throw new NoSQLArgumentError('Missing or invalid table name',
                req);
        }
    }

    static _notSuppByProto(desc, suppVer, currVer, req) {
        throw NoSQLError.create(ErrorCode.OPERATION_NOT_SUPPORTED,
            `${desc} is not supported because it requires minimum \
protocol version ${suppVer}.  The service is running protocol version \
${currVer}`, null, req);
    }

    static _chkProtoVer(desc, suppVer, currVer, req) {
        if (currVer < suppVer) {
            throw this._notSuppByProto(desc, suppVer, currVer, req);
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
        if (cc != null && !Buffer.isBuffer(cc) && !cc[Op.ccAsObj]) {
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

    //Here we will conver the value to Date so that we don't have to do this
    //again during serialization.  We accept any valid Date values as well as
    //any number or string value passed to Date constructor (we will use
    //the value from the resulting Date.getTime()).  Javascript Date range is
    //+-100000 days since/before epoch, which is subset of java.util.Date
    //range so we should be ok on the server side.
    static _validateDateField(req, obj, field) {
        if (obj[field] == null) {
            return;
        }
        const d = obj[field];
        //Date constructor accepts other types such as arrays but we don't
        //allow this.
        const v = d instanceof Date ? d : new Date(
            (typeof d === 'number' || typeof d === 'string') ? d : NaN);
        if (!Number.isFinite(v.getTime())) { // NaN for invalid date
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

    static _validateTimeout(req) {
        if (!isPosInt32(req.opt.timeout)) {
            throw new NoSQLArgumentError(
                `Invalid timeout: ${req.opt.timeout}`, req);
        }
    }

    static _validateDurability(req) {
        if (req.opt == null || req.opt.durability == null) {
            return;
        }
        if (!(req.opt.durability.masterSync instanceof SyncPolicy)) {
            throw new NoSQLArgumentError(
                `Invalid durability.masterSync: \
${req.opt.durability.masterSync}`, req);
        }
        if (!(req.opt.durability.replicaSync instanceof SyncPolicy)) {
            throw new NoSQLArgumentError(
                `Invalid durability.replicaSync: \
${req.opt.durability.replicaSync}`, req);
        }
        if (!(req.opt.durability.replicaAck instanceof ReplicaAckPolicy)) {
            throw new NoSQLArgumentError(
                `Invalid durability.replicaAck: \
${req.opt.durability.replicaAck}`, req);
        }
    }

    static _validateRequest(req) {
        this._validateOpt(req);
        this._validateTimeout(req);
        //set timeout to use for single request (vs timeout across retries)
        req.opt.requestTimeout = Math.min(req.opt.timeout,
            Limits.MAX_REQUEST_TIMEOUT);
    }

    static _validateReadRequest(req) {
        this._validateRequest(req);
        this._chkTblName(req);
        this._chkConsistency(req);
    }

    static _validateWriteRequest(req, isSubRequest) {
        if (!isSubRequest) {
            this._validateRequest(req);
            this._chkTblName(req);
        } else {
            this._validateOpt(req);
        }
        this._validateDurability(req);
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

    static chkRequestSizeLimit(pm, writer, req) {
        this._chkRequestSizeLimit(req, pm.getRequestLength(writer));
    }

    static serialize(pm, writer, req) {
        pm.startWrite(writer, req);
        pm.serializer(this.name).serialize(writer, req, pm.serialVersion);
        this.chkRequestSizeLimit(pm, writer, req);
    }

    //req argument is only needed for PrepareSerializer.deserialize()
    //and QuerySerializer.deserialize()
    static deserialize(pm, reader, req) {
        pm.startRead(reader, req);
        return pm.serializer(this.name).deserialize(reader, req,
            pm.serialVersion);
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

    //The following are used by rate limiter

    static get supportsRateLimiting() {
        return false;
    }

    static getTableName(req) {
        return req.tableName;
    }

    static doesReads() {
        return false;
    }

    static doesWrites() {
        return false;
    }

}

//These parameters have to be specified in initial configuration and may not
//be overriden in options.
Op.NO_OVERRIDE_OPTS = [ 'serviceType', 'retry', 'auth' ];

//For advanced queries and other possible cases where continuation key is
//an object, this allows us to validate that user did not supply a bogus
//value that could cause internal failures down the line
Op.ccAsObj = Symbol('ccAsObj');

module.exports = Op;
