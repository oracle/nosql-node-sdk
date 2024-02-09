/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');

const ErrorCode = require('../error_code');
const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const Limits = require('../constants').Limits;
const isPosInt32 = require('../utils').isPosInt32;
const isPosInt32OrZero = require('../utils').isPosInt32OrZero;
const Op = require('./op');

/* "5" == PrepareCallback.QueryOperation.SELECT */
const OPCODE_SELECT = 5;

class QueryOpBase extends Op {

    static _decrementQueryVersion(client, versionUsed) {
        //See comment to HttpClient._decrementSerialVersion().
        if (client._queryVersion !== versionUsed) {
            return true;
        }
        //Allow going from V4 to V3.
        if (client._queryVersion === this.QUERY_V4) {
            client._queryVersion = this.QUERY_V3;
            return true;
        }
        return false;
    }

    //See Op for base class implementations of the following methods.

    static setProtocolVersion(client, req) {
        super.setProtocolVersion(client, req);
        if (client._queryVersion == null) {
            client._queryVersion = this.QUERY_VERSION;
        }
        req._queryVersion = client._queryVersion;
    }

    //Returns true if the operation can be retried immediately because we
    //received UNSUPPORTED_PROTOCOL or UNSUPPORTED_QUERY_VERSION errors.
    static handleUnsupportedProtocol(client, req, err) {
        if (super.handleUnsupportedProtocol(client, req, err)) {
            return true;
        }

        //Check if we got UNSUPPORTED_QUERY_VERSION error and can can retry
        //with older protocol, in which case we can immediately retry
        //(otherwise use retry handler as usual).
        if (err.errorCode === ErrorCode.UNSUPPORTED_QUERY_VERSION) {
            if (!this._decrementQueryVersion(client, req._serialVersion)) {
                throw err;
            }
            return true;
        }

        return false;
    }

    static protocolChanged(client, req) {
        return super.protocolChanged(client, req) ||
            req._queryVersion !== client._queryVersion;
    }
}

//Query protocol versions currently in use.
QueryOpBase.QUERY_V3 = 3;
QueryOpBase.QUERY_V4 = 4;
//Current query version.
QueryOpBase.QUERY_VERSION = QueryOpBase.QUERY_V4;

class PrepareOp extends QueryOpBase {

    static validate(req) {
        this._validateRequest(req);
        if (typeof req.stmt !== 'string' || !req.stmt.length) {
            throw new NoSQLArgumentError('Invalid statement', req);
        }
    }

    static getTableName(req, res) {
        return res != null ? res._tableName : null;
    }

    static get supportsRateLimiting() {
        return true;
    }

    static doesReads() {
        return true;
    }

}

class QueryOp extends QueryOpBase {

    static validate(req) {
        this._validateRequest(req);
        this._chkConsistency(req);
        if (req.opt.durability != null) {
            this._chkProtoVer('Query durability option', 4, req);
            this._validateDurability(req);
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

        assert(req.opt); //see Op.applyDefaults()
        //Batch counter is needed for query tracing.
        if (req.opt.traceLevel > 0 && res.continuationKey) {
            res.continuationKey._batchNum =
                req.opt.continuationKey && req.opt.continuationKey._batchNum ?
                    req.opt.continuationKey._batchNum + 1 : 1;
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
        return prepStmt != null ? prepStmt._tableName : null;
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
            prepStmt._opCode != OPCODE_SELECT : false;
    }
}

module.exports = {
    PrepareOp,
    QueryOp
};
