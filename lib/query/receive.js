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
const NoSQLClient = require('../nosql_client');
const QueryOp = require('../ops').QueryOp;
const NoSQLError = require('../error').NoSQLError;
const PlanIterator = require('./common').PlanIterator;
const DistributionKind = require('./common').DistributionKind;
const MinHeap = require('./utils').MinHeap;
const compareRows = require('./sort').compareRows;
const sizeof = require('./utils').sizeof;

function hasLocalResults(res) {
    return res.rows && res._idx != null && res._idx < res.rows.length;
}

function compPartShardIds(res1, res2) {
    return res1._partId != null ?
        (res1._partId < res2._partId ? -1 : 1) :
        (res1._shardId < res2._shardId ? -1 : 1);
}

/**
 * ReceiveIterator requests and receives results from the proxy. For sorting
 * queries, it performs a merge sort of the received results. It also
 * performs duplicate elimination for queries that require it (note:
 * a query can do both sorting and dup elimination).
 */
class ReceiveIterator extends PlanIterator {
    
    constructor(qpExec, step) {
        super(qpExec, step);
        if (step.pkFields) {
            this._dup = new Set();
            this._dupMem = 0;
        }
        if (step.sortSpecs) {
            this._untypedJsonComp = true;
            const cmp = this._compareRes.bind(this);
            if (step.distKind === DistributionKind.ALL_SHARDS) {
                assert(qpExec._prepStmt && qpExec._prepStmt._topologyInfo);
                this._topoInfo = qpExec._prepStmt._topologyInfo;
                //seed empty shard results for sortingNext() loop
                this._spRes = new MinHeap(cmp, this._topoInfo.shardIds.map(
                    _shardId => ({ _shardId })));
            } else if (step.distKind === DistributionKind.ALL_PARTITIONS) {
                this._spRes = new MinHeap(cmp);
                this._allPartSort = true;
                this._allPartSortPhase1 = true;
                this._totalRows = 0;
                this._totalMem = 0;
            }
        }
    }

    _compareRes(res1, res2) {
        if (!hasLocalResults(res1)) {
            return hasLocalResults(res2) ? -1 :
                compPartShardIds(res1, res2);
        }
        if (!hasLocalResults(res2)) {
            return 1;
        }
        const compRes = compareRows(this, res1.rows[res1._idx],
            res2.rows[res2._idx], this._step.sortSpecs);
        return compRes ? compRes : compPartShardIds(res1, res2);
    }

    _getLimitFromMem() {
        const maxMem = this._qpExec.maxMem;
        const memPerRow = this._totalMem / this._totalRows;
        let limit = (maxMem - this._dupMem) / memPerRow;
        limit = Math.min(Math.floor(limit), 2048);
        if (limit <= 0) {
            throw this.illegalState(`Cannot make another request because set \
memory limit of ${this._qpExec.maxMemMB} MB will be exceeded`);
        }
        return limit;
    }

    _setMemStats(res) {
        res._mem = sizeof(this, res.rows);
        this._totalRows += res.rows.length;
        this._totalMem += res._mem;
        this._qpExec.incMem(res._mem);
    }

    _validatePhase1Res(res) {
        //Check that we are really in sort phase 1
        if (res._contAllPartSortPhase1 == null) {
            throw this.badProto('First response to ALL_PARTITIONS query is \
not a phase 1 response');
        }
        if (res._contAllPartSortPhase1 && !res.continuationKey) {
            throw this.badProto('ALL_PARTITIONS query: missing continuation \
key needed to continue phase 1');
        }

        if (!res._partIds) {
            res._partIds = [];
        }
        if (!res._partIds.length) {
            //Empty result case, do validation and return
            if (res.rows && res.rows.length) {
                throw this.badProto('ALL_PARTITIONS query phase 1: received \
rows but no partition ids');
            }
            if (res._numResultsPerPartId && res._numResultsPerPartId.length) {
                throw this.badProto('ALL_PARTITIONS query phase 1: received \
numResultsPerPartitionId array but no partition ids');
            }
        } else {
            const numResPerPartCnt = res._numResultsPerPartId ?
                res._numResultsPerPartId.length : 0;
            if (numResPerPartCnt !== res._partIds.length) {
                throw this.badProto(`ALL_PARTITIONS query phase 1: received \
mismatched arrays of partitionIds of length ${res._partIds.length} and \
numResultsPerPartitionId of length ${numResPerPartCnt}`);
            }
        }
    }

    //Group results by partition id and put them into the MinHeap
    _addPartResults(res) {
        let rowIdx = 0;
        for(let i = 0; i < res._partIds.length; i++) {
            const end = rowIdx + res._numResultsPerPartId[i];
            if (end > res.rows.length) {
                throw this.badProto(`ALL PARTITIONS query phase 1: exceeded \
row count ${res.rows.length} while getting rows for partition id \
${res._partId[i]}, expected index range [${rowIdx}, ${end})`);
            }
            const pRes = {
                rows: res.rows.slice(rowIdx, end),
                continuationKey: res._partContKeys[i],
                _partId: res._partIds[i],
                _idx: 0
            };
            this._spRes.add(pRes);
            this._setMemStats(pRes);
            rowIdx = end;
        }
        if (rowIdx !== res.rows.length) {
            throw this.badProto(`ALL PARTITIONS query phase 1: received per \
partition row counts (total ${rowIdx}) did not match total row count \
${res.rows.length}`);
        }
    }

    //We have to convert PKs to string because JS Set only does value
    //comparison for primitives, objects (etc. Buffer) are compared by
    //reference only
    _pkVal2str(row, fldName) {
        const val = row[fldName];
        switch(typeof val) {
        case 'string':
            return val;
        case 'number':
            return val.toString();
        case 'object':
            if (val instanceof Date) {
                return val.toISOString();
            }
            if (this._dbNumber != null && this._dbNumber.isInstance(val)) {
                return this._dbNumber.stringValue(val);
            }
        default:
            throw this.illegalState(`Unexpected type ${typeof val} for \
primary key column ${fldName}`);
        }
    }
    
    _chkDup(row) {
        let pkVal = '';
        for(let fldName of this._step.pkFields) {
            pkVal += this._pkVal2str(row, fldName);
        }
        if (this._dup.has(pkVal)) {
            return true;
        }
        this._dup.add(pkVal);
        const size = sizeof(this, pkVal);
        this._dupMem += size;
        this._qpExec.incMem(size);
        return false;
    }

    _handleTopologyChange() {
        const topoInfo = this._qpExec._prepStmt._topologyInfo;
        if (this._topoInfo === topoInfo) {
            return;
        }

        //Shard ids removed in new topo
        let shardIds = this._topoInfo.shardIds.filter(shardId =>
            !topoInfo.shardIds.includes(shardId));
        if (shardIds.length) {
            this._spRes = this._spRes.filter(res =>
                !shardIds.includes(res._shardId));
        }
        //Shard ids added in new topo
        shardIds = topoInfo.shardIds.filter(shardId =>
            !this._topoInfo.shardIds.includes(shardId));
        for(let shardId of shardIds) {
            this._spRes.add({ shardId });
        }

        this._topoInfo = topoInfo;
    }

    async _fetch(ck, shardId, limit) {
        assert(this._qpExec._req);
        const opt = this._qpExec._req.opt;
        
        const req = {
            api: NoSQLClient.query,
            prepStmt: this._qpExec._prepStmt,
            opt: Object.assign({}, opt),
            _queryInternal: true,
            _shardId: shardId
        };
        req.opt.continuationKey = ck;
        if (limit) {
            req.opt.limit = opt.limit ? Math.min(opt.limit, limit) : limit;
        }

        const res = await this._qpExec._client._execute(QueryOp, req);
        assert(Array.isArray(res.rows));
        res._idx = 0; //initialize index to iterate
        res._shardId = shardId; //set shard id if any

        //We only make one internal request per user's query() call,
        //so the same consumed capacity will be returned to the user
        this._qpExec._cc = res.consumedCapacity;
        this._qpExec._fetchDone = true;

        assert(res._reachedLimit || !res.continuationKey ||
            this._allPartSortPhase1);
        return res;
    }

    //Returns true if phase 1 is completed
    async _doAllPartSortPhase1() {
        //have to postpone phase 1 to the next query() call
        if (this._qpExec._fetchDone) {
            assert(this._qpExec._needUserCont);
            return false;
        }

        /*
         * Create and execute a request to get at least one result from
         * the partition whose id is specified in theContinuationKey and
         * from any other partition that is co-located with that partition.
         */
        const res = await this._fetch(this._allPartSortPhase1CK);
        this._validatePhase1Res(res);
        this._allPartSortPhase1 = res._contAllPartSortPhase1;
        this._allPartSortPhase1CK = res.continuationKey;
        this._addPartResults(res);

        if (this._allPartSortPhase1) { //need more phase 1 results
            this._qpExec._needUserCont = true;
            return false;
        }

        return true;
    }

    async _simpleNext() {
        for(;;) {
            const res = this._res;
            if (res) {
                assert(res.rows && res._idx != null);
                if (res._idx < res.rows.length) {
                    const row = res.rows[res._idx++];
                    if (this._dup && this._chkDup(row)) {
                        continue;
                    }
                    this.result = row;
                    return true;
                }
                if (!res.continuationKey) {
                    return false;
                }
            }
            if (this._qpExec._fetchDone) {
                break;
            }
            this._res = await this._fetch(res ? res.continuationKey : null);
        }
        assert(this._res);
        if (this._res.continuationKey) {
            this._qpExec._needUserCont = true;
        }
        return false;
    }

    async _sortingFetch(fromRes) {
        let limit;
        if (this._allPartSort) {
            //We only limit number of rows for ALL_PARTITIONS query
            limit = this._getLimitFromMem();
        }
        let res;
        try {
            res = await this._fetch(fromRes.continuationKey, fromRes._shardId,
                limit);
        } catch(err) {
            if ((err instanceof NoSQLError) && err.retryable) {
                //add original result to retry later
                this._spRes.add(fromRes);
            }
            throw err;
        }
        this._spRes.add(res);
        if (this._allPartSort) {
            this._setMemStats(res);
        } else {
            this._handleTopologyChange();
        }
    }

    _localNext(res) {
        const row = res.rows[res._idx++];
        if (this._allPartSort && res._idx === res.rows.length) {
            res.rows = []; //release memory
            this._qpExec.decMem(res._mem);
        }
        //more cached results or more remote results
        if (res._idx < res.rows.length || res.continuationKey) {
            this._spRes.add(res);
        }
        if (this._dup && this._chkDup(row)) {
            return false;
        }
        this.result = row;
        return true;
    }

    async _sortingNext() {
        if (this._allPartSortPhase1 &&
            !(await this._doAllPartSortPhase1())) {
            return false;
        }

        let res;
        while ((res = this._spRes.pop())) {
            if (res.rows) { //we have real result
                assert(res._idx != null);
                if (res._idx < res.rows.length) {
                    if (this._localNext(res)) {
                        return true;
                    }
                    continue;
                }
                if (!res.continuationKey) {
                    //no more results for this shard or partition
                    continue;
                }
            }
            //remote fetch is needed
            if (this._qpExec._fetchDone) {
                //We limit to 1 fetch per query() call
                break;
            } else {
                await this._sortingFetch(res);
            }
        }
        if (res) {
            //another fetch needs to be performed on next query() call
            assert(!res.rows || res.continuationKey);
            this._spRes.add(res);
            this._qpExec._needUserCont = true;
        }
        return false;
    }

    next() {
        return this._spRes ? this._sortingNext() : this._simpleNext();
    }

    //should not be called
    reset() {
        throw this.illegalState(
            'Reset should not be called for ReceiveIterator');
    }

}

ReceiveIterator._isAsync = true;

module.exports = ReceiveIterator;
