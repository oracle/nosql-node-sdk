/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const EventEmitter = require('events');
const assert = require('assert');
const HttpClient = require('./http_client');

const ops = require('./ops');

const TableState = require('./constants').TableState;
const AdminState = require('./constants').AdminState;
const ServiceType = require('./constants').ServiceType;
const ErrorCode = require('./error_code');
const NoSQLTimeoutError = require('./error').NoSQLTimeoutError;
const NoSQLProtocolError = require('./error').NoSQLProtocolError;
const NoSQLArgumentError = require('./error').NoSQLArgumentError;
const Config = require('./config');
const sleep = require('./utils').sleep;
const replaceObject = require('./utils').replaceObject;
const PreparedStatement = require('./stmt').PreparedStatement;
const QueryPlanExecutor = require('./query/common').QueryPlanExecutor;
const NoSQLError = require('./error').NoSQLError;

//Default timeout for admin list operations such as listNamespaces, listUsers,
//listRoles.
const DEF_ADMIN_LIST_TIMEOUT = 30000;

//Default limit for table usage iterable. The value is set to 24 hours of
//1-minute usage records.
const DEF_TABLE_USAGE_LIMIT = 1440;

class NoSQLClientImpl extends EventEmitter {

    constructor(config) {
        super();
        this._config = Config.create(config);
        this._client = new HttpClient(this._config);
        //Forward all events from the _client.
        this.on('newListener', (event, listener) => {
            this._client.on(event, listener);
        });
        this.on('removeListener', (event, listener) => {
            this._client.removeListener(event, listener);
        });
        //To prevent throwing if no error events are registered.
        //We should log the error in this listener.
        this.on('error', () => {});
    }

    _assignOpt(opt, addOpt) {
        if (opt == null) {
            return addOpt;
        }
        //We don't throw here because we want the error to be handled
        //asynchronously.  If a user passes invalid opt which is not
        //an object, we just return it and pass it to asynchronous code
        //for validation.
        if (typeof opt !== 'object') {
            return opt;
        }
        return Object.assign({}, opt, addOpt);
    }

    //Used by _forTableState, _forLocalReplicaInit and _forAdminCompletion.
    _doPollOpDelay(req, poReq, startTime) {
        if (req.opt.timeout !== Infinity) {
            const remaining = startTime + req.opt.timeout -
                (Date.now() + req.opt.delay);
            //Fail if we are less than opt.delay ahead of timing out.
            if (remaining <= 0) {
                throw new NoSQLTimeoutError(req.opt.timeout, null, req);
            }
            //Make sure timeout of poll op request (poReq) does not go past
            //total poll timeout.
            if (poReq.opt.timeout > remaining) {
                poReq.opt.timeout = remaining;
            }
        }
        return sleep(req.opt.delay);
    }

    async _forTableState(table, tableState, opt, skipInit) {
        const req = {
            api: typeof table === 'string' ? this.forTableState :
                this.forCompletion,
            table,
            tableState,
            opt
        };

        //If called from _withCompletion, the work below was already done on
        //the original request.  In addition this check avoids throwing wrong
        //error if remaining timeout < pollDelay.  Same applies to
        //_forAdminCompletion().
        if (!skipInit) {
            ops.PollTableStateOp.applyDefaults(req, this._config);
            ops.PollTableStateOp.validate(req);
        }

        // Should be set by PollTableStateOp.applyDefaults() above or from
        // _withCompletion().
        assert(req.opt != null);

        //For forCompletion(), when table is TableResult, return if already
        //reached desired state.
        if (req.api === this.forCompletion &&
            table.tableState === tableState) {
            return table;
        }

        //Request for GetTableOp.
        const gtReq = {
            api: req.api,
            table,
            opt: {
                compartment: req.opt.compartment,
                timeout: Math.min(this._config.timeout, req.opt.timeout)
            }
        };
        
        const startTime = Date.now();
        for(;;) {
            try {
                const res = await this._execute(ops.GetTableOp, gtReq);
                if (res.tableState === req.tableState) {
                    return res;
                }
            } catch(err) {
                if (err.errorCode === ErrorCode.TABLE_NOT_FOUND &&
                    req.tableState === TableState.DROPPED) {
                    const res = {
                        tableName: gtReq.tableName,
                        tableState: TableState.DROPPED
                    };
                    //In this case onResult was not called by _execute above.
                    ops.PollTableStateOp.onResult(this, req, res);
                    return res;
                }
                throw err;
            }
            await this._doPollOpDelay(req, gtReq, startTime);
        }
    }

    async _forLocalReplicaInit(table, opt) {
        const req = {
            api: this.forLocalReplicaInit,
            table,
            opt
        };

        if (this._config.serviceType !== ServiceType.CLOUD) {
            throw NoSQLError.create(ErrorCode.OPERATION_NOT_SUPPORTED,
                `forLocalReplicaInit is not supported for service type \
${this._config.serviceType} (requires Cloud Service)`, null, req);
        }

        ops.PollTableOp.applyDefaults(req, this._config);
        ops.PollTableOp.validate(req);
        assert(req.opt != null);

        //Request for GetTableOp.
        const gtReq = {
            api: req.api,
            table,
            opt: {
                compartment: req.opt.compartment,
                timeout: Math.min(this._config.timeout, req.opt.timeout)
            }
        };
        
        const startTime = Date.now();
        for(;;) {
            const res = await this._execute(ops.GetTableOp, gtReq);
            if (res.isLocalReplicaInitialized) {
                return res;
            }
            await this._doPollOpDelay(req, gtReq, startTime);
        }
    }

    async * _tableUsageIterable(tableName, opt) {
        if (opt == null) {
            opt = {};
        } else if (typeof opt === 'object') {
            opt = Object.assign({}, opt);
            opt.startIndex = undefined;
        }
        if (opt.limit == null) {
            opt.limit = DEF_TABLE_USAGE_LIMIT;
        }
        let res;
        do {
            res = await this.getTableUsage(tableName, opt);
            if (!res.usageRecords.length) {
                break;
            }
            opt.startIndex = res.nextIndex;
            yield res;
        } while(res.usageRecords.length === opt.limit);
    }

    async _getIndex(tableName, indexName, opt) {
        const req = {
            api: this.getIndex,
            tableName,
            opt
        };
        req.opt = this._assignOpt(opt, { indexName });
        const res = await this._client.execute(ops.GetIndexesOp, req);
        if (res.length != 1) {
            throw new NoSQLProtocolError(
                `Unexpected number of index results: ${res.length}`,
                null, req);
        }
        return res[0];
    }

    //Note: This function is only used if opt.all is set to true and is not
    //fully implemented yet to account for throttling errors.  Reserved for
    //future use.
    async _deleteRangeAll(tableName, key, opt) {
        const req = {
            api: this.deleteRange,
            tableName,
            key,
            opt
        };
        //Accumulate deletedCount and consumedCapacity
        const total = {
            deletedCount: 0,
            consumedCapacity: 
                this._config.serviceType !== ServiceType.KVSTORE ? {
                    readKB: 0,
                    readUnits: 0,
                    writeKB: 0,
                    writeUnits: 0
                } : null
        };

        for(;;) {
            const res = await this._client.execute(ops.MultiDeleteOp, req);
            assert(res.deletedCount != null);
            assert(res.consumedCapacity != null ||
                total.consumedCapacity == null);
            total.deletedCount += res.deletedCount;
            if (total.consumedCapacity) {
                for(let key in total.consumedCapacity) {
                    total.consumedCapacity[key] += res.consumedCapacity[key];
                }
            }
            if (!res.continuationKey) {
                res.deletedCount = total.deletedCount;
                if (total.consumedCapacity) {
                    Object.assign(res.consumedCapacity,
                        total.consumedCapacity);
                }
                return res;
            }
            opt.continuationKey = res.continuationKey;
        }
    }

    async _prepare(stmt, opt) {
        const res = await this._client.execute(ops.PrepareOp, {
            api: this.prepare,
            stmt,
            opt
        });
        res.__proto__ = PreparedStatement.prototype;
        return res;
    }

    async _query(stmt, opt) {
        const req = {
            api: this.query,
            opt
        };

        let ck = opt ? opt.continuationKey : null;
        if (ck && ck._prepStmt) {
            req.prepStmt = ck._prepStmt;
        } else if (typeof stmt !== 'string') {
            req.prepStmt = stmt;
        } else {
            req.stmt = stmt;
        }

        if (!req.prepStmt) {
            const res = await this._client.execute(ops.QueryOp, req);
            //We always read the prepared statement if the request does not
            //have it.
            assert(res._prepStmt);
            //Simple query may already have results, so we just return them.
            if (!res._prepStmt._queryPlan) {
                return res;
            }

            //Advanced query will have no results in this case, only the
            //prepared statement. To make it more intuitive for the user, we
            //execute the first prepared query call.
            req.prepStmt = res._prepStmt;
            req.stmt = undefined;
            ck = res.continuationKey;
            assert(ck); //see QueryOp.onResult()
            assert(req.opt); //see Op.applyDefaults()
            req.opt.continuationKey = ck;
        }

        //Advanced query.
        if (req.prepStmt._queryPlan) {
            let qpExec = ck ? ck._qpExec : null;
            if (!qpExec) {
                //First advanced query call, create plan executor.
                qpExec = new QueryPlanExecutor(this, req.prepStmt);
            }
            return qpExec.execute(req);
        }

        //Simple query.
        return this._client.execute(ops.QueryOp, req);
    }

    async * _queryIterable(stmt, opt) {
        if (opt == null) {
            opt = {};
        } else if (typeof opt === 'object') {
            opt = Object.assign({}, opt);
            opt.continuationKey = undefined;
        }
        
        do {
            const res = await this.query(stmt, opt);
            opt.continuationKey = res.continuationKey;
            yield res;
        } while(opt.continuationKey);
    }

    _execute(op, req) {
        return this._client.execute(op, req);
    }

    async _adminStatus(req) {
        if (req.adminResult != null && req.adminResult.operationId == null) {
            //still validate options passed for correctness
            ops.AdminStatusOp.applyDefaults(req, this._config);
            ops.AdminStatusOp.validate(req);
            return req.adminResult;
        }
        return this._execute(ops.AdminStatusOp, req);
    }

    async _forAdminCompletion(adminResult, opt, skipInit) {
        const req = {
            api: this.forCompletion,
            adminResult,
            opt
        };

        if (!skipInit) {
            ops.AdminPollOp.applyDefaults(req, this._config);
            ops.AdminPollOp.validate(req);
        }

        // Should be set by AdminPollOp.applyDefaults() above or from
        // _withCompletion().
        assert(req.opt != null);

        if (adminResult.state === AdminState.COMPLETE) {
            return adminResult;
        }

        //Request for AdminStatusOp.
        const asReq = {
            api: req.api,
            adminResult,
            opt: {
                timeout: Math.min(this._config.timeout, req.opt.timeout)
            }
        };

        const startTime = Date.now();
        for(;;) {
            const res = await this._execute(ops.AdminStatusOp, asReq);
            if (res.state === AdminState.COMPLETE) {
                return res;
            }
            await this._doPollOpDelay(req, asReq, startTime);
        }
    }

    async _forCompletion(res, opt, skipInit) {
        let ret;
        if (res == null) {
            throw new NoSQLArgumentError(
                'forCompletion: missing result object');
        }
        if (res._forAdmin) {
            ret = await this._forAdminCompletion(res, opt, skipInit);
        } else {
            const isDropTable = typeof res._stmt === 'string' &&
                res._stmt.match(/^\s*DROP\s+TABLE\s+/i);
            ret = await this._forTableState(res, isDropTable ?
                TableState.DROPPED : TableState.ACTIVE, opt, skipInit);
        }
        return replaceObject(res, ret);
    }

    async _withCompletion(op, req) {
        const startTime = Date.now();
        const res = await this._execute(op, req);

        //This initialization would be done by _execute() above.
        assert(req.opt != null && req.opt.__proto__ === this._config);
        
        let timeOut = req.opt._ownsTimeout ?
            req.opt.timeout : this._config.tablePollTimeout;
        if (timeOut !== Infinity) {
            timeOut -= (Date.now() - startTime);
        }

        req.opt.timeout = Math.max(timeOut, 1);
        return this._forCompletion(res, req.opt, true);
    }

    async _adminListOp(opName, stmt, req) {
        const listOpt = {
            complete: true,
            timeout: DEF_ADMIN_LIST_TIMEOUT
        };
        if (req.opt == null) {
            req.opt = listOpt;
        } else if (typeof req.opt === 'object') {
            //if typeof opt !== 'object', it will be passed to adminDDL
            //and throw during validation
            req.opt = Object.assign(listOpt, req.opt);
        }
        let res = await this.adminDDL(stmt, req.opt);
        if (res.output == null) {
            throw new NoSQLProtocolError(`Missing output for ${opName}`, null,
                req);
        }
        try {
            res = JSON.parse(res.output);
        } catch(err) {
            throw new NoSQLProtocolError(`Error parsing output for \
${opName}`, null, req);
        }
        if (res == null || typeof res !== 'object') {
            throw new NoSQLProtocolError(`Invalid output for ${opName}`, null,
                req);
        }
        return res;
    }

    async _listNamespaces(opt) {
        const req = { //will be included in any thrown errors
            api: this.listNamespaces,
            opt
        };
        const res = await this._adminListOp('listNamespaces',
            'SHOW AS JSON NAMESPACES', req);
        if (res.namespaces == null) {
            return [];
        }
        if (!Array.isArray(res.namespaces) || res.namespaces.findIndex(
            el => typeof el !== 'string') !== -1) {
            throw new NoSQLProtocolError('Invalid namespaces array in \
the output for listNamespaces operation', null, req);
        }
        return res.namespaces;
    }

    async _listUsers(opt) {
        const req = { //will be included in any thrown errors
            api: this.listUsers,
            opt
        };
        const res = await this._adminListOp('listUsers', 'SHOW AS JSON USERS',
            req);
        if (res.users == null) {
            return [];
        }
        if (!Array.isArray(res.users)) {
            throw new NoSQLProtocolError('Invalid users array in the output \
for listUsers operation', null, req);
        }
        return res.users.map(user => {
            if (user == null || typeof user !== 'object' ||
            typeof user.id !== 'string' || typeof user.name !== 'string') {
                throw new NoSQLProtocolError('Invalid value in the users \
array in the output for listUsers operation', null, req);
            }
            return {
                id: user.id,
                name: user.name
            };
        });
    }

    async _listRoles(opt) {
        const req = { //will be included in any thrown errors
            api: this.listRoles,
            opt
        };
        const res = await this._adminListOp('listRoles', 'SHOW AS JSON ROLES',
            req);
        if (res.roles == null) {
            return [];
        }
        if (!Array.isArray(res.roles)) {
            throw new NoSQLProtocolError('Invalid roles array in the output \
for listRoles operation', null, req);
        }
        return res.roles.map(role => {
            if (role == null || typeof role !== 'object' ||
            typeof role.name !== 'string') {
                throw new NoSQLProtocolError('Invalid value in the roles \
array in the output for listRoles operation', null, req);
            }
            return role.name;
        });
    }

    //used for testing
    get _serialVersion() {
        return this._client.serialVersion;
    }

    close() {
        this._client.shutdown();
        return Promise.resolve(Config.destroy(this._config));
    }

    async _precacheAuth() {
        await this._config.auth.provider.getAuthorization({
            opt: {
                __proto__: this._config
            },
            lastError: new NoSQLError(ErrorCode.INVALID_AUTHORIZATION),
            _op: ops.GetTableOp
        });
        return this;
    }
    
}

module.exports = NoSQLClientImpl;
