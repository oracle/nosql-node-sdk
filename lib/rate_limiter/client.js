/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const path = require('path');

const ErrorCode = require('../error').ErrorCode;
const NoSQLTimeoutError = require('../error').NoSQLTimeoutError;
const NoSQLProtocolError = require('../error').NoSQLProtocolError;
const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const TableState = require('../constants').TableState;
const GetTableOp = require('../ops').GetTableOp;
const ServiceType = require('../constants').ServiceType;
const SimpleRateLimiter = require('./simple_rate_limiter');

//Check table limits in background every 10 minutes
const BG_CHECK_INTERVAL = 600000;

//Timeout over multiple retries for getTable in background
const BG_GETTABLE_TIMEOUT = 300000;

//It seems that clearTimeout already ignores invalid values, this is just
//in case this behavior changes in future
function _clearTimeout(tm) {
    if (tm != null && typeof tm === 'object') {
        clearTimeout(tm);
    }
}

class RateLimiterClient {

    constructor(client)
    {
        this._client = client;

        let rl = client._config.rateLimiter;
        switch(typeof rl) {
        case 'undefined': case 'null':
            assert(false);
            break;
        case 'function':
            this._limiterCls = rl;
            break;
        case 'boolean':
            assert(rl === true);
            this._limiterCls = SimpleRateLimiter;
            break;
        case 'string':
            try {
                rl = require(path.resolve(rl));
                this._limiterCls = rl;
                break;
            } catch(err) {
                throw new NoSQLArgumentError(`Error loading rate limiter \
class from module ${rl}`, client._config, err);
            }
        case 'object':
            assert(rl != null);
            this._limiterCls = SimpleRateLimiter;
            if (rl.maxBurstSeconds != null) {
                if (typeof rl.maxBurstSeconds !== 'number' ||
                    rl.maxBurstSeconds < 0) {
                    throw new NoSQLArgumentError(
                        'Invalid value of rateLimiter.maxBurstSeconds: ' +
                        rl.maxBurstSeconds, client._config);
                }
                this._maxBurstSecs = rl.maxBurstSeconds;
            }
            break;
        default:
            throw new NoSQLArgumentError(
                `Invalid value of rateLimiter: ${rl}`, client._config);
        }

        const limiterPercent = client._config.rateLimiterPercent;
        if (limiterPercent != null) {
            if (typeof limiterPercent !== 'number' || limiterPercent <= 0 ||
                limiterPercent > 100) {
                throw new NoSQLArgumentError(
                    `Invalid value of rateLimiterPercent: ${limiterPercent}`);
            }
            this._limiterRatio = limiterPercent / 100;
        }

        this._rlMap = new Map();
        this._rlUpdateMap = new Map();
    }

    _doUpdateLimiters(tblNameLower, tblRes) {
        if (tblRes.tableState === TableState.DROPPED) {
            this._rlMap.delete(tblNameLower);
            return;
        }

        if (tblRes.tableState !== TableState.ACTIVE) {
            return;
        }

        //special case for table with no limits
        if (tblRes.tableLimits == null) {
            this._rlMap.set(tblNameLower, { noLimits: true });
        }

        let ent = this._rlMap.get(tblNameLower);
        if (ent == null) {
            //we store readUnits and writeUnits in ent to allow precise
            //integer comparsion in order to update the limiters
            //(see the else... clause below)
            ent = {
                readUnits: tblRes.tableLimits.readUnits,
                readRL: this._createLimiter(tblRes.tableLimits.readUnits),
                writeUnits: tblRes.tableLimits.writeUnits,
                writeRL: this._createLimiter(tblRes.tableLimits.writeUnits),
            };
            this._rlMap.set(tblNameLower, ent);
        } else {
            if (ent.readUnits !== tblRes.tableLimits.readUnits) {
                ent.readUnits = tblRes.tableLimits.readUnits;
                this._setLimit(ent.readRL, tblRes.tableLimits.readUnits);
            }
            if (ent.writeUnits !== tblRes.tableLimits.writeUnits) {
                ent.writeUnits = tblRes.tableLimits.writeUnits;
                this._setLimit(ent.writeRL, tblRes.tableLimits.writeUnits);
            }
        }
    }

    //tblRes is undefined in case of error during getTable
    _updateLimiters(tblNameLower, tblRes) {
        _clearTimeout(this._rlUpdateMap.get(tblNameLower));
        
        if (tblRes != null) {
            this._doUpdateLimiters(tblNameLower, tblRes);
        }

        //keep checking table limits at regular interval BG_CHECK_INTERVAL
        //if was not successful or if using multiple clients each using
        //portion of table limits (this._limiterRatio)
        if (tblRes == null || this._limiterRatio != null) {
            this._rlUpdateMap.set(tblNameLower, setTimeout(() =>
                this._doBackgroundUpdate(tblNameLower), BG_CHECK_INTERVAL));
        } else {
            //just so that we don't launch background update again
            this._rlUpdateMap.set(tblNameLower, true);
        }
    }

    async _doBackgroundUpdate(tblNameLower) {
        let res;
        try {
            res = await this._client.execute(GetTableOp, {
                tableName: tblNameLower,
                opt: {
                    //allow enough for retries if necessary
                    timeout: BG_GETTABLE_TIMEOUT
                }
            });
        } catch(err) {
            if (err.errorCode === ErrorCode.TABLE_NOT_FOUND) {
                res = {
                    tableName: tblNameLower,
                    tableState: TableState.DROPPED
                };
            }
        }

        this._updateLimiters(tblNameLower, res);
    }

    _backgroundUpdateLimiters(tblNameLower) {
        if (this._rlUpdateMap.get(tblNameLower) != null) {
            return;
        }
        this._rlUpdateMap.set(tblNameLower, setTimeout(() =>
            this._doBackgroundUpdate(tblNameLower), 0));
    }

    _setRLEnt(req, res) {
        let tblName = req._op.getTableName(req, res);
        if (tblName == null) {
            return;
        }

        tblName = tblName.toLowerCase();
        req._rlEnt = this._rlMap.get(tblName);
        if (req._rlEnt != null) {
            //initialize rate limit delays to be computed later
            if (req._doesReads) {
                req._rrlDelay = 0;
            }
            if (req._doesWrites) {
                req._wrlDelay = 0;
            }
        } else { //initiate getting table limits in the background
            this._backgroundUpdateLimiters(tblName);
        }
    }

    _createLimiter(units) {
        let res;
        if (this._maxBurstSecs != null) {
            assert(this._limiterCls === SimpleRateLimiter);
            res = new SimpleRateLimiter(this._maxBurstSecs);
        } else {
            res = new this._limiterCls();
        }
        this._setLimit(res, units);
        return res;
    }

    _setLimit(limiter, units) {
        limiter.setLimit(this._limiterRatio == null ?
            units : units * this._limiterRatio);
    }

    static rateLimitingEnabled(cfg) {
        return cfg.serviceType != ServiceType.KVSTORE && cfg.rateLimiter;
    }

    close() {
        this._rlUpdateMap.forEach(val => _clearTimeout(val));
    }

    updateLimiters(tblRes) {
        if (tblRes.tableName == null) {
            throw new NoSQLProtocolError('TableResult is missing table name');
        }
        this._updateLimiters(tblRes.tableName.toLowerCase(), tblRes);
    }

    initRequest(req) {
        req._doesReads = req._op.doesReads(req);
        req._doesWrites = req._op.doesWrites(req);
        this._setRLEnt(req);
    }

    async startRequest(req, startTime, timeout, totalTimeout, numRetries) {
        if (req._rlEnt == null || req._rlEnt.noLimits) {
            return;
        }
        try {
            if (req._doesReads) {
                assert(req._rrlDelay != null);
                req._rrlDelay += await req._rlEnt.readRL.consumeUnits(
                    0, timeout, false);
            }
            if (req._doesWrites) {
                timeout = Math.max(startTime + timeout - Date.now(), 0);
                assert(req._wrlDelay != null);
                req._wrlDelay += await req._rlEnt.writeRL.consumeUnits(
                    0, timeout, false);
            }
        } catch(err) {
            throw new NoSQLTimeoutError(totalTimeout, numRetries, req, err);
        }
    }

    async finishRequest(req, res, timeout) {
        //For un-prepared query request the table name is not known until
        //the request is processed, so we try again (note that this must be
        //done after Op.onResult() is called).  May also be called if table
        //limits were just obtained.
        if (req._rlEnt == null) {
            //We have to recompute doesReads and doesWrites since their values
            //may depend on the result of operation.  This is the case for
            //doesWrites for query that was just prepared.
            req._doesReads = req._op.doesReads(req, res);
            req._doesWrites = req._op.doesWrites(req, res);
            this._setRLEnt(req, res);
        }

        if (req._rlEnt == null || req._rlEnt.noLimits) {
            return;
        }

        assert(res.consumedCapacity != null);

        if (req._doesReads) {
            assert(req._rrlDelay != null);
            res.consumedCapacity.readRateLimitDelay = req._rrlDelay;
            res.consumedCapacity.readRateLimitDelay +=
                await req._rlEnt.readRL.consumeUnits(
                    res.consumedCapacity.readUnits, timeout, true);
        }
        
        if (req._doesWrites) {
            assert(req._wrlDelay != null);
            res.consumedCapacity.writeRateLimitDelay = req._wrlDelay;
            res.consumedCapacity.writeRateLimitDelay +=
                await req._rlEnt.writeRL.consumeUnits(
                    res.consumedCapacity.writeUnits, timeout, true);
        }
    }

    onError(req, err) {
        if (req._rlEnt == null || req._rlEnt.noLimits) {
            return;
        }

        if (err.errorCode === ErrorCode.READ_LIMIT_EXCEEDED) {
            req._doesReads = true;
            req._rlEnt.readRL.onThrottle(err);
        } else if (err.errorCode === ErrorCode.WRITE_LIMIT_EXCEEDED) {
            req._doesWrites = true;
            req._rlEnt.writeRL.onThrottle(err);
        }
    }

}

module.exports = RateLimiterClient;
