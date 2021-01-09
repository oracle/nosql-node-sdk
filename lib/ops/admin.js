/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const NoSQLProtocolError = require('../error').NoSQLProtocolError;
const AdminState = require('../constants').AdminState;
const isPlainObject = require('../utils').isPlainObject;
const isPosInt32 = require('../utils').isPosInt32;
const hasOwnProperty = require('../utils').hasOwnProperty;
const Op = require('./op');

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

    static _validateTimeout(req) {
        if ((!req.opt.complete || req.opt.timeout !== Infinity) &&
            !isPosInt32(req.opt.timeout)) {
            throw new NoSQLArgumentError(
                `Invalid timeout for admin DDL: ${req.opt.timeout}`, req);
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

    static _validateTimeout(req) {
        if (req.opt.timeout !== Infinity && !isPosInt32(req.opt.timeout)) {
            throw new NoSQLArgumentError(
                `Invalid timeout for admin poll: ${req.opt.timeout}`, req);
        }
    }

    static validate(req) {
        super.validate(req);
        this._validateDelay(req);
    }

}

module.exports = {
    AdminDDLOp,
    AdminStatusOp,
    AdminPollOp
};
