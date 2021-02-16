/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');

const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const Limits = require('../constants').Limits;
const isPosInt32 = require('../utils').isPosInt32;
const isPosInt32OrZero = require('../utils').isPosInt32OrZero;
const Op = require('./op');

/* "5" == PrepareCallback.QueryOperation.SELECT */
const OPCODE_SELECT = 5;

class PrepareOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        if (typeof req.stmt !== 'string' || !req.stmt.length) {
            throw new NoSQLArgumentError('Invalid statement', req);
        }
    }

    static getTableName(req, res) {
        return res != null ? res._prepStmtInfo.tableName : null;
    }

    static get supportsRateLimiting() {
        return true;
    }

    static doesReads() {
        return true;
    }

}

class QueryOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        this._chkConsistency(req);
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
                res.continuationKey = { [Op.ccAsObj]: true };
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

    static _getPrepStmt(req, res) {
        if (req.prepStmt != null) {
            return req.prepStmt;
        }
        const ck = req.opt.continuationKey;
        if (ck != null) {
            return ck._prepStmt;
        }
        //We need this for simple queries returing only one batch of results
        //and thus having no continuation key.
        return res != null ? res._prepStmt : null;
    }

    static getTableName(req, res) {
        const prepStmt = this._getPrepStmt(req, res);
        return prepStmt != null ? prepStmt._prepStmtInfo.tableName : null;
    }

    static get supportsRateLimiting() {
        return true;
    }

    static doesReads() {
        return true;
    }

    static doesWrites(req, res) {
        const prepStmt = this._getPrepStmt(req, res);
        return prepStmt != null ?
            prepStmt._prepStmtInfo.opCode != OPCODE_SELECT : false;
    }
}

module.exports = {
    PrepareOp,
    QueryOp
};
