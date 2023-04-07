/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const OpCode = require('../binary_protocol/constants').OpCode;
const Protocol = require('./protocol');
const NoSQLProtocolError = require('../error').NoSQLProtocolError;
const QUERY_VERSION = require('../query/common').QUERY_VERSION;
const DataReader = require('../binary_protocol/reader');
const ccAsObj = require('../ops').ccAsObj;
const Fields = require('./constants').Fields;
const BinaryPrepareSerializer = require('../binary_protocol/serializers')
    .PrepareSerializer;
const BinaryQuerySerializer = require('../binary_protocol/serializers')
    .QuerySerializer;

class PrepareSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.PREPARE, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        nw.writeIntField(Fields.QUERY_VERSION, QUERY_VERSION);
        nw.writeStringField(Fields.STATEMENT, req.stmt);
        this.checkWriteBooleanField(nw, Fields.GET_QUERY_PLAN,
            req.opt.getQueryPlan);
        this.checkWriteBooleanField(nw, Fields.GET_QUERY_SCHEMA,
            req.opt.getResultSchema);
        nw.endMapField();
        nw.endMap();
    }

    static _deserializeDriverPlanInfo(buf, res) {
        const dr = new DataReader(buf);
        return BinaryPrepareSerializer._deserializeDriverPlanInfo(dr, res);
    }

    //topology info is not always sent
    static _processPrepStmtField(nr, field, res) {
        switch (field) {
        case Fields.PREPARED_QUERY:
            res._prepStmt = nr.readBinary();
            return true;
        case Fields.DRIVER_QUERY_PLAN:
            this._deserializeDriverPlanInfo(nr.readBinary(), res);
            return true;
        case Fields.TABLE_NAME:
            res._tableName = nr.readString();
            return true;
        case Fields.NAMESPACE:
            res._namespace = nr.readString();
            return true;
        case Fields.QUERY_PLAN_STRING:
            res._queryPlanStr = nr.readString();
            return true;
        case Fields.QUERY_RESULT_SCHEMA:
            res._schema = nr.readString();
            return true;
        case Fields.QUERY_OPERATION:
            res._opCode = nr.readInt();
            return true;
        case Fields.PROXY_TOPO_SEQNUM:
            res._topoInfo = res._topoInfo || {};
            res._topoInfo.seqNum = nr.readInt();
            return true;
        case Fields.SHARD_IDS:
            res._topoInfo = res._topoInfo || {};
            res._topoInfo.shardIds = this.readArray(nr,
                nr => nr.readInt());
            return true;
        default:
            return false;
        }
    }

    static _validatePrepStmt(ps) {
        if (ps == null) {
            throw new NoSQLProtocolError(
                'Missing prepared query information');
        }
        if (ps._prepStmt == null) {
            throw new NoSQLProtocolError('Missing prepared statement');
        }
        //Todo: put anything else here that we need to check.
    }

    static deserialize(nr, req) {
        const res = {
            _sql: req.stmt
        };

        this.deserializeResponse(nr, req, (field, res) =>
            this._processPrepStmtField(nr, field, res), res);
        this._validatePrepStmt(res);
        return res;
    }

}

class QuerySerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.QUERY, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);

        this.writeConsistency(nw, req.opt.consistency);
        if (req.opt.durability != null) {
            this.writeDurability(nw, req.opt.durability);
        }

        this.checkWriteIntField(nw, Fields.MAX_READ_KB, req.opt.maxReadKB);
        this.checkWriteIntField(nw, Fields.MAX_WRITE_KB, req.opt.maxWriteKB);
        this.checkWriteIntField(nw, Fields.NUMBER_LIMIT, req.opt.limit);
        this.checkWriteIntField(nw, Fields.TRACE_LEVEL, req.opt.traceLevel);
        nw.writeIntField(Fields.QUERY_VERSION, QUERY_VERSION);
        
        if (req.prepStmt != null) {
            nw.writeBooleanField(Fields.IS_PREPARED, true);
            nw.writeBooleanField(Fields.IS_SIMPLE_QUERY,
                req.prepStmt._queryPlan == null);
            nw.writeBinaryField(Fields.PREPARED_QUERY,
                req.prepStmt._prepStmt);
            
            if (req.prepStmt._bindings != null) {
                const ents = Object.entries(req.prepStmt._bindings);
                nw.startArrayField(Fields.BIND_VARIABLES);
                for(let [key, val] of ents) {
                    nw.startMap();
                    nw.writeStringField(Fields.NAME, key);
                    this.writeValue(nw, val, req.opt);
                    nw.endMap();
                }
                nw.endArrayField();
            }

            if (req.prepStmt._topoInfo != null) {
                nw.writeIntField(Fields.TOPO_SEQ_NUM,
                    req.prepStmt._topoInfo.seqNum);
            }
        } else {
            nw.writeStringField(Fields.STATEMENT, req.stmt);
        }

        if (req.opt.continuationKey && !req.opt.continuationKey[ccAsObj]) {
            nw.writeBinaryField(Fields.CONTINUATION_KEY,
                req.opt.continuationKey);
        }

        this.writeMathContext(nw, req.opt);
        this.checkWriteIntField(nw, Fields.SHARD_ID, req._shardId);

        nw.endMapField();
        nw.endMap();
    }

    static _deserializeSortPhase1Results(buf, res) {
        const dr = new DataReader(buf);
        return BinaryQuerySerializer._deserializeSortPhase1Results(dr, res);
    }

    static deserialize(nr, req) {
        let prepStmt;

        const res = this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.QUERY_RESULTS:
                res.rows = this.readArray(nr, this.readRow, req.opt);
                return true;
            case Fields.CONTINUATION_KEY:
                res.continuationKey = nr.readBinary();
                return true;
            case Fields.SORT_PHASE1_RESULTS:
                this._deserializeSortPhase1Results(nr.readBinary(), res);
                return true;
            case Fields.REACHED_LIMIT:
                res._reachedLimit = nr.readBoolean();
                return true;
            default:
                prepStmt = prepStmt || {};
                return PrepareSerializer._processPrepStmtField(nr, field,
                    prepStmt);
            }
        });

        //If the QueryRequest was not initially prepared, the prepared
        //statement created at the proxy is returned back along with the
        //query results, so that the preparation does not need to be done
        //during each query batch.
        if (req.prepStmt == null) {
            PrepareSerializer._validatePrepStmt(prepStmt);
            prepStmt._sql = req.stmt;
            prepStmt.consumedCapacity = res.consumedCapacity;
            res._prepStmt = prepStmt;
        } else if (prepStmt != null) {
            //We received updated topology info.
            res._topoInfo = prepStmt._topoInfo;
        }

        res.rows = res.rows || []; //empty array if no results
        return res;
    }

}

module.exports = {
    PrepareSerializer,
    QuerySerializer
};
