/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const TableState = require('../constants').TableState;
const isPosInt32 = require('../utils').isPosInt32;
const isPosInt32OrZero = require('../utils').isPosInt32OrZero;
const isPlainObject = require('../utils').isPlainObject;
const hasOwnProperty = require('../utils').hasOwnProperty;
const Op = require('./op');

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

    static _validateTimeout(req) {
        if ((!req.opt.complete || req.opt.timeout !== Infinity) &&
            !isPosInt32(req.opt.timeout)) {
            throw new NoSQLArgumentError(
                `Invalid timeout for table DDL: ${req.opt.timeout}`, req);
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
        GetTableOp.onResult(client, req, res);
        res._stmt = req.stmt;
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
        super.onResult(client, req, res);
        client.emit('tableState', res.tableName, res.tableState);
        if (client._rlClient != null) {
            client._rlClient.updateLimiters(res);
        }
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

    static _validateTimeout(req) {
        if (req.opt.timeout !== Infinity && !isPosInt32(req.opt.timeout)) {
            throw new NoSQLArgumentError(
                `Invalid timeout for table poll: ${req.opt.timeout}`, req);
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

module.exports = {
    TableDDLOp,
    TableLimitsOp,
    GetTableOp,
    TableUsageOp,
    GetIndexesOp,
    ListTablesOp,
    PollTableOp
};
