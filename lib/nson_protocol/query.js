/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const OpCode = require('../binary_protocol/constants').OpCode;
const Protocol = require('./protocol');
const NoSQLProtocolError = require('../error').NoSQLProtocolError;
const QUERY_V4 = require('../ops').QueryOp.QUERY_V4;
const DataReader = require('../binary_protocol/reader');
const ccAsObj = require('../ops').ccAsObj;
const Fields = require('./constants').Fields;
const Type = require('../binary_protocol/constants').Type;
const BinaryPrepareSerializer = require('../binary_protocol/serializers')
    .PrepareSerializer;
const BinaryQuerySerializer = require('../binary_protocol/serializers')
    .QuerySerializer;

class PrepareSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.PREPARE, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        nw.writeIntField(Fields.QUERY_VERSION, req._queryVersion);
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
        //These fields are for query V3 and below, for query V4 the topology
        //is read in Protocol.deserializeResponse().
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
        if (ps._topoInfo != null) {
            this.validateTopologyInfo(ps._topoInfo);
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

    static _writeVirtualScan(nw, vs) {
        nw.startMapField(Fields.VIRTUAL_SCAN);
        nw.writeIntField(Fields.VIRTUAL_SCAN_SID, vs.sid);
        nw.writeIntField(Fields.VIRTUAL_SCAN_PID, vs.pid);
        if (!vs.isInfoSent) {
            nw.writeBinaryField(Fields.VIRTUAL_SCAN_PRIM_KEY, vs.primKey);
            nw.writeBinaryField(Fields.VIRTUAL_SCAN_SEC_KEY, vs.secKey);
            nw.writeBooleanField(Fields.VIRTUAL_SCAN_MOVE_AFTER,
                vs.moveAfterResumeKey);

            nw.writeBinaryField(Fields.VIRTUAL_SCAN_JOIN_DESC_RESUME_KEY,
                vs.descResumeKey);
            if (vs.joinPathTables) {
                nw.writeFieldName(Fields.VIRTUAL_SCAN_JOIN_PATH_TABLES);
                this.writeFieldValue(nw, vs.joinPathTables, {});
            }
            nw.writeBinaryField(Fields.VIRTUAL_SCAN_JOIN_PATH_KEY,
                vs.joinPathKey);
            nw.writeBinaryField(Fields.VIRTUAL_SCAN_JOIN_PATH_SEC_KEY,
                vs.joinPathSecKey);
            nw.writeBooleanField(Fields.VIRTUAL_SCAN_JOIN_PATH_MATCHED,
                vs.joinPathMatched);
        }
        nw.endMapField();
    }

    static _readVirtualScan(nr) {
        const vs = {};

        Protocol.readMap(nr, field => {
            switch (field) {
            case Fields.VIRTUAL_SCAN_SID:
                vs.sid = nr.readInt();
                return true;
            case Fields.VIRTUAL_SCAN_PID:
                vs.pid = nr.readInt();
                return true;
            case Fields.VIRTUAL_SCAN_PRIM_KEY:
                vs.primKey = nr.readBinary();
                return true;
            case Fields.VIRTUAL_SCAN_SEC_KEY:
                vs.secKey = nr.readBinary();
                return true;
            case Fields.VIRTUAL_SCAN_MOVE_AFTER:
                vs.moveAfterResumeKey = nr.readBoolean();
                return true;
            case Fields.VIRTUAL_SCAN_JOIN_DESC_RESUME_KEY:
                vs.descResumeKey = nr.readBinary();
                return true;
            case Fields.VIRTUAL_SCAN_JOIN_PATH_TABLES:
                vs.joinPathTables = this.readArray(nr, nr => nr.readInt());
                return true;
            case Fields.VIRTUAL_SCAN_JOIN_PATH_KEY:
                vs.joinPathKey = nr.readBinary();
                return true;
            case Fields.VIRTUAL_SCAN_JOIN_PATH_SEC_KEY:
                vs.joinPathSecKey = nr.readBinary();
                return true;
            case Fields.VIRTUAL_SCAN_JOIN_PATH_MATCHED:
                vs.joinPathMatched = nr.readBoolean();
                return true; 
            default:
                return false;
            }
        });

        return vs;
    }

    static _readQueryTraces(nr) {
        const traces = [];
        nr.expectType(Type.ARRAY);

        let cnt = nr.count;
        if (cnt % 2 !== 0) {
            throw new NoSQLProtocolError(
                `Invalid size of query traces array: ${cnt}`);
        }
        cnt /= 2;

        for(let i = 0; i < cnt; i++) {
            nr.next();
            const name = nr.readString();
            nr.next();
            const val = nr.readString();
            traces.push([name, val]);
        }
        
        return traces;
    }

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
        this.checkWriteLongField(nw, Fields.SERVER_MEMORY_CONSUMPTION,
            req.opt._maxServerMemory);

        if (req.opt.traceLevel > 0) {
            nw.writeBooleanField(Fields.TRACE_TO_LOG_FILES,
                req.opt.traceToLogFiles);
            const batchNum =
                req.opt.continuationKey && req.opt.continuationKey._batchNum ?
                    req.opt.continuationKey._batchNum : 0;
            //It seems that Java driver is using 1-based counter.
            nw.writeIntField(Fields.BATCH_COUNTER, batchNum + 1);
        }

        nw.writeIntField(Fields.QUERY_VERSION, req._queryVersion);
        
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

            //For query V3 we write topology seqNum in the payload.
            if (req._queryVersion < QUERY_V4 && req._topoInfo != null) {
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

        if (req._queryVersion >= QUERY_V4) {
            this.checkWriteStringField(nw, Fields.QUERY_ID, req.opt.queryId);
            if (req._vScan != null) {
                this._writeVirtualScan(nw, req._vScan);
            }
        }

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
            case Fields.VIRTUAL_SCANS:
                res._vScans = this.readArray(nr, this._readVirtualScan);
                return true;
            case Fields.QUERY_BATCH_TRACES:
                res.queryTraces = this._readQueryTraces(nr);
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
        } else if (prepStmt != null && prepStmt._topoInfo != null) {
            //We received updated topology info. This should happen only for
            //query V3 and below.
            this.validateTopologyInfo(prepStmt._topoInfo);
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
