/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const Config = require('../config');
const Limits = require('../constants').Limits;
const isPosInt32 = require('../utils').isPosInt32;
const TTLUtil = require('../ttl_util');
const Op = require('./op');

class GetOp extends Op {

    static validate(req) {
        this._validateReadRequest(req);
        this._chkKey(req);
    }

    static get supportsRateLimiting() {
        return true;
    }

    static doesReads() {
        return true;
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

    static get supportsRateLimiting() {
        return true;
    }

    static doesReads(req) {
        return req.opt.ifAbsent || req.opt.ifPresent || req.opt.matchVersion;
    }

    static doesWrites() {
        return true;
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

    static get supportsRateLimiting() {
        return true;
    }

    static doesReads() {
        return true;
    }

    static doesWrites() {
        return true;
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

    static get supportsRateLimiting() {
        return true;
    }

    static doesReads() {
        return true;
    }

    static doesWrites() {
        return true;
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
            if (PutOp.doesReads(op)) {
                req._doesReads = true;
            }
        } else {
            if (op.delete == null) {
                throw new NoSQLArgumentError(
                    `Operation at index ${idx} does not have put ` +
                        'or delete', req);
            }
            op.key = op.delete;
            DeleteOp.validate(op, true);
            if (DeleteOp.doesReads(op)) {
                req._doesReads = true;
            }
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

    static get supportsRateLimiting() {
        return true;
    }

    static doesReads(req) {
        return req._doesReads;
    }

    static doesWrites() {
        return true;
    }

}

module.exports = {
    GetOp,
    PutOp,
    DeleteOp,
    MultiDeleteOp,
    WriteMultipleOp
};
