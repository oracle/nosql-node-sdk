/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const Enum = require('../constants').Enum;
const QueryOp = require('../ops').QueryOp;
const ccAsObj = require('../ops').ccAsObj;
const ServiceType = require('../constants').ServiceType;
const NoSQLQueryError = require('../error').NoSQLQueryError;

const QUERY_V2 = 2;

const QUERY_VERSION = QUERY_V2;

class QueryPlanExecutor {

    constructor(client, prepStmt) {
        this._client = client;
        this._prepStmt = prepStmt;
        this._res = [];
        this._mem = 0;
        if (prepStmt._vars) {
            this._initExtVars();
        }
    }

    _initExtVars() {
        this._extVars = new Array(this._prepStmt._vars.size);
        if (!this._prepStmt.bindings) {
            return; //will be checked at the proxy
        }
        for(let ent of Object.entries(this._prepStmt.bindings)) {
            const id = this._prepStmt._vars.get(ent[0]);
            if (id == null) {
                throw this.illegalArg(`Query does not contain variable \
${ent[0]}`);
            }
            assert(Number.isSafeInteger(id) && id >= 0 &&
                id < this._extVars.length);
            this._extVars[id] = ent[1];
        }
    }

    _makeResult() {
        return {
            consumedCapacity: this._cc,
            rows: this._rows,
            continuationKey: this._needUserCont ? {
                [ccAsObj]: true,
                _prepStmt: this._prepStmt,
                _qpExec: this
            } : null
        };
    }

    makeIterator(step) {
        return step ? new step.itCls(this, step) : null;
    }

    async executePromise(req) {
        QueryOp.applyDefaults(req, this._client._config);
        QueryOp.validate(req);

        this._req = req;
        this._maxMem = req.opt.maxMemoryMB * 1024 * 1024;
        //default consumed capacity if no requests to the server were made
        if (this._client._config.serviceType !== ServiceType.KVSTORE) {
            this._cc = {
                readUnits: 0,
                readKB: 0,
                writeUnits: 0,
                writeKB: 0
            };
        }
        //We limit to 1 request to the server per user's call to query()
        this._fetchDone = false;
        //Indicates whether user needs to call query() again
        this._needUserCont = false;

        //If the previous call threw retryable exception, we may still have
        //results (this.rows).  In this case we return them and let user issue
        //query again to get more results.
        if (!this._rows) {
            this._rows = [];
            const limit = req.opt ? req.opt.limit : 0;
            if (!this._iter) {
                this._iter = this.makeIterator(this._prepStmt._queryPlan);
            }
            while(await this._iter.next()) {
                this._rows.push(this._iter.result);
                if (limit && this._rows.length === limit) {
                    this._needUserCont = true;
                    break;
                }
            }
        }
        const res = this._makeResult();
        this._rows = null;
        return res;
    }

    execute(req, callback) {
        this.executePromise(req)
            .then((res) => callback(null, res))
            .catch((err) => callback(err));
    }

    get maxMem() {
        return this._maxMem;
    }

    get maxMemMB() {
        return this._req.opt.maxMemoryMB;
    }

    incMem(val) {
        this._mem += val;
        if (this._mem > this._maxMem) {
            throw this.memoryExceeded(`Memory used for the query exceeded \
maximum allowed value of ${this.maxMemMB} MB`);
        }
    }

    decMem(val) {
        this._mem -= val;
        assert(this._mem >= 0);
    }

    badProto(msg, cause) {
        return NoSQLQueryError.badProto(msg, this._req, cause);
    }

    illegalArg(msg, exprLoc) {
        let exprLocStr = '';
        if (exprLoc) {
            exprLocStr = ` Expression location: ${exprLoc.startLine}:\
${exprLoc.startColumn}-${exprLoc.endLine}:${exprLoc.endColumn}`;
        }
        return NoSQLQueryError.illegalArg(msg + exprLocStr, this._req);
    }

    illegalState(msg, cause) {
        return NoSQLQueryError.illegalState(msg, this._req, cause);
    }

    memoryExceeded(msg) {
        return NoSQLQueryError.memory(msg, this._req);
    }

}

//Base class for all iterators
class PlanIterator {
    
    constructor(qpExec, step) {
        this._qpExec = qpExec;
        this._step = step;
        //Handler for custom DB Number type if present, needed for sorting and
        //arithmetic operations
        this._dbNumber = qpExec._client._config._dbNumber;
    }

    static validateStep() {}

    static _validateStepInputSync(step) {
        if (!step.input) {
            throw NoSQLQueryError.illegalState(`Missing input iterator for \
${step.displayName}`);
        }
        assert(step.input.itCls);
        if (step.input.itCls._isAsync) {
            throw NoSQLQueryError.illegalState(`Unexpected async input \
iterator ${step.input.displayName} for ${step.displayName}`);
        }
    }

    //attach info for debugging to error
    _addErrInfo(err) {
        return Object.assign(err, { _planIterator: this});
    }

    get result() {
        return this._qpExec._res[this._step.resPos];
    }

    set result(val) {
        this._qpExec._res[this._step.resPos] = val;
    }

    //empty next()
    next() {
        return this._done ? false : this._done = true;
    }

    reset() {
        this._done = false;
    }

    badProto(msg, cause) {
        return this._addErrInfo(this._qpExec.badProto(msg, cause));
    }

    illegalState(msg, cause) {
        return this._addErrInfo(this._qpExec.illegalState(msg, cause));
    }

    illegalArg(msg, loc) {
        return this._addErrInfo(this._qpExec.illegalArg(msg, loc ? loc :
            this._step.exprLoc));
    }

    isAsync() {
        return this.constructor._isAsync;
    }
}

class DistributionKind extends Enum {}

/*
 * The query predicates specify a complete shard key, and as a result,
 * the query goes to a single partition and uses the primary index for
 * its execution.
 */
DistributionKind.SINGLE_PARTITION = new DistributionKind(0);

/*
 * The query uses the primary index for its execution, but does not
 * specify a complete shard key. As a result, it must be sent to all
 * partitions.
 */
DistributionKind.ALL_PARTITIONS = new DistributionKind(1);

/*
 * The query uses a secondary index for its execution. As a result,
 * it must be sent to all shards.
 */
DistributionKind.ALL_SHARDS = new DistributionKind(2);

DistributionKind.seal();

class SQLFuncCode extends Enum {}
SQLFuncCode.OP_ADD_SUB = new SQLFuncCode(14);
SQLFuncCode.OP_MULT_DIV = new SQLFuncCode(15);
SQLFuncCode.FN_MIN = new SQLFuncCode(47);
SQLFuncCode.FN_MAX = new SQLFuncCode(48);
SQLFuncCode.seal();

module.exports = {
    QUERY_VERSION,
    QueryPlanExecutor,
    PlanIterator,
    DistributionKind,
    SQLFuncCode
};
