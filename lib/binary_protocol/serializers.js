/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const OpCode = require('./constants').OpCode;
const Protocol = require('./protocol');
const NoSQLProtocolError = require('../error').NoSQLProtocolError;
const PutOp = require('../ops').PutOp;
const DeleteOp = require('../ops').DeleteOp;
const QUERY_VERSION = require('../query/common').QUERY_VERSION;
const QueryPlanSerializer = require('../query/binary_protocol/serializer');

function numberOrZero(n) {
    return n ? n : 0;
}

class TableRequestSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.TABLE_REQUEST, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeString(req.stmt);
        const tl = req.opt.tableLimits;
        if (tl) {
            dw.writeBoolean(true);
            dw.writeInt32BE(tl.readUnits);
            dw.writeInt32BE(tl.writeUnits);
            dw.writeInt32BE(tl.storageGB);
            if (serialVersion > 2) {
                if (tl.mode != null) {
                    dw.writeByte(tl.mode.ordinal);
                } else {
                    dw.writeByte(1);
                }
            }
            if (req.tableName) {
                dw.writeBoolean(true);
                dw.writeString(req.tableName);
            } else {
                dw.writeBoolean(false);
            }
        } else {
            dw.writeBoolean(false);
        }
    }

    static deserialize(dr, req, serialVersion) {
        return this.deserializeTableResult(dr, req.opt, serialVersion);
    }

}

class GetTableSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.GET_TABLE, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeString(req.tableName);
        dw.writeString(req.opt.operationId);
    }

    static deserialize(dr, req, serialVersion) {
        return this.deserializeTableResult(dr, req.opt, serialVersion);
    }

}

class TableUsageSerializer extends Protocol {

    static _deserializeUsage(dr) {
        const usage = {};
        usage.startTime = new Date(dr.readLong());
        usage.secondsInPeriod = dr.readInt();
        usage.readUnits = dr.readInt();
        usage.writeUnits = dr.readInt();
        usage.storageGB = dr.readInt();
        usage.readThrottleCount = dr.readInt();
        usage.writeThrottleCount = dr.readInt();
        usage.storageThrottleCount = dr.readInt();
        return usage;
    }

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.GET_TABLE_USAGE, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeString(req.tableName);
        //Already converted to Date during validation
        dw.writeLong(req.opt.startTime ? req.opt.startTime.getTime() : 0);
        dw.writeLong(req.opt.endTime ? req.opt.endTime.getTime() : 0);
        dw.writeInt(numberOrZero(req.opt.limit));
    }

    //eslint-disable-next-line no-unused-vars
    static deserialize(dr, req, serialVersion) {
        const res = {};
        //eslint-disable-next-line no-unused-vars
        const tenantId = dr.readString();
        res.tableName = dr.readString();
        res.usageRecords = new Array(dr.readInt());

        for (let i = 0; i < res.usageRecords.length; i++) {
            res.usageRecords[i] = this._deserializeUsage(dr);
        }
        return res;
    }

}

class GetIndexesSerializer extends Protocol {

    static _deserializeIndexInfo(dr) {
        const info = {};
        info.indexName = dr.readString();
        info.fields = new Array(dr.readInt());
        for (let i = 0; i < info.fields.length; i++) {
            info.fields[i] = dr.readString();
        }
        return info;
    }

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.GET_INDEXES, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeString(req.tableName);
        if (req.opt.indexName) {
            dw.writeBoolean(true);
            dw.writeString(req.opt.indexName);
        } else {
            dw.writeBoolean(false);
        }
    }

    //eslint-disable-next-line no-unused-vars
    static deserialize(dr, req, serialVersion) {
        const res = new Array(dr.readInt());
        for (let i = 0; i < res.length; i++) {
            res[i] = this._deserializeIndexInfo(dr);
        }
        return res;
    }

}

class ListTablesSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.LIST_TABLES, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeInt32BE(numberOrZero(req.opt.startIndex));
        dw.writeInt32BE(numberOrZero(req.opt.limit));
        dw.writeString(req.opt.namespace);
    }

    //eslint-disable-next-line no-unused-vars
    static deserialize(dr, req, serialVersion) {
        const res = {};
        res.tables = new Array(dr.readInt());
        for (let i = 0; i < res.tables.length; i++) {
            res.tables[i] = dr.readString();
        }
        res.lastIndex = dr.readInt();
        return res;
    }

}

class GetSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.GET, serialVersion);
        this.serializeReadRequest(dw, req);
        this.writeFieldValue(dw, req.key, req.opt);
    }

    static deserialize(dr, req, serialVersion) {
        const res = {};
        this.deserializeConsumedCapacity(dr, res, req.opt);
        const hasRow = dr.readBoolean();
        if (hasRow) {
            res.row = this.readRecord(dr, req.opt);
            const expTime = dr.readLong();
            if (expTime) {
                res.expirationTime = new Date(expTime);
            }
            res.version = this.readVersion(dr);
            if (serialVersion > 2) {
                res.modificationTime = new Date(dr.readLong());
            }
        } else {
            res.row = null;
        }
        return res;
    }

}

class PutSerializer extends Protocol {

    static _opcode(opt) {
        if (opt.ifAbsent) {
            return OpCode.PUT_IF_ABSENT;
        }
        if (opt.ifPresent) {
            return OpCode.PUT_IF_PRESENT;
        }
        if (opt.matchVersion) {
            return OpCode.PUT_IF_VERSION;
        }
        return OpCode.PUT;
    }

    static serialize(dw, req, serialVersion, isSubRequest = false) {
        const opt = req.opt;
        if (isSubRequest) {
            this.writeSubOpCode(dw, this._opcode(opt));
            dw.writeBoolean(opt.returnExisting);
        } else {
            this.writeOpCode(dw, this._opcode(opt), serialVersion);
            this.serializeWriteRequest(dw, req, serialVersion);
        }
        dw.writeBoolean(opt.exactMatch);
        dw.writeInt(numberOrZero(opt.identityCacheSize));
        this.writeFieldValue(dw, req.row, req.opt);
        dw.writeBoolean(PutOp.needUpdateTTL(req));
        this.writeTTL(dw, opt.ttl);
        if (opt.matchVersion) {
            this.writeVersion(dw, opt.matchVersion);
        }
    }

    static deserialize(dr, req, serialVersion) {
        const res = {};
        this.deserializeConsumedCapacity(dr, res, req.opt);
        res.success = dr.readBoolean();
        if (res.success) {
            res.version = this.readVersion(dr);
        }
        return this.deserializeWriteResponseWithId(dr,
            req.opt, res, serialVersion);
    }

}

class DeleteSerializer extends Protocol {

    static serialize(dw, req, serialVersion, isSubRequest = false) {
        const opt = req.opt;
        const opCode = opt.matchVersion ? OpCode.DELETE_IF_VERSION :
            OpCode.DELETE;
        if (isSubRequest) {
            this.writeSubOpCode(dw, opCode);
            dw.writeBoolean(opt.returnExisting);
        } else {
            this.writeOpCode(dw, opCode, serialVersion);
            this.serializeWriteRequest(dw, req, serialVersion);
        }
        this.writeFieldValue(dw, req.key, req.opt);
        if (opt.matchVersion) {
            this.writeVersion(dw, opt.matchVersion);
        }
    }

    static deserialize(dr, req, serialVersion) {
        const res = {};
        this.deserializeConsumedCapacity(dr, res, req.opt);
        res.success = dr.readBoolean();
        return this.deserializeWriteResponse(dr, req.opt, res, serialVersion);
    }

}

class MultiDeleteSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        const opt = req.opt;
        this.writeOpCode(dw, OpCode.MULTI_DELETE, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeString(req.tableName);
        this.writeDurability(dw, opt.durability, serialVersion);
        this.writeFieldValue(dw, req.key, req.opt);
        this.writeFieldRange(dw, opt.fieldRange, req.opt);
        dw.writeInt(numberOrZero(opt.maxWriteKB));
        dw.writeBinary(opt.continuationKey);
    }

    //eslint-disable-next-line no-unused-vars
    static deserialize(dr, req, serialVersion) {
        const res = {};
        this.deserializeConsumedCapacity(dr, res, req.opt);
        res.deletedCount = dr.readInt();
        res.continuationKey = dr.readBinary();
        return res;
    }

}

class WriteMultipleSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.WRITE_MULTIPLE, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeString(req.tableName != null ?
            req.tableName : req.ops.map(op => op.tableName).join(','));
        dw.writeInt(req.ops.length);
        this.writeDurability(dw, req.opt.durability, serialVersion);

        for(let op of req.ops) {
            const start = dw.buffer.length;
            dw.writeBoolean(op.opt.abortOnFail);
            if (op.put) {
                PutSerializer.serialize(dw, op, serialVersion, true);
                PutOp._chkRequestSizeLimit(req, dw.buffer.length - start);
            } else {
                assert(op.delete);
                DeleteSerializer.serialize(dw, op, serialVersion, true);
                DeleteOp._chkRequestSizeLimit(req, dw.buffer.length - start);
            }
        }
    }

    static _readOpResult(dr, req, serialVersion) {
        const res = {};
        res.success = dr.readBoolean();
        const hasVersion = dr.readBoolean();
        if (hasVersion) {
            res.version = this.readVersion(dr);
        }
        return this.deserializeWriteResponseWithId(dr,
            req.opt, res, serialVersion);
    }

    static deserialize(dr, req, serialVersion) {
        const res = {};
        const succeeded = dr.readBoolean();
        this.deserializeConsumedCapacity(dr, res, req.opt);
        if (succeeded) {
            const cnt = dr.readInt();
            res.results = new Array(cnt);
            for(let i = 0; i < cnt; i++) {
                res.results[i] = this._readOpResult(dr, req, serialVersion);
            }
        } else {
            res.failedOpIndex = dr.readByte();
            res.failedOpResult = this._readOpResult(dr, req, serialVersion);
        }
        return res;
    }

}

class PrepareSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.PREPARE, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeString(req.stmt);
        dw.writeInt16BE(QUERY_VERSION);
        dw.writeBoolean(req.opt.getQueryPlan);
    }

    /*
     * Extract the table name, namespace and opcode from the prepared query.
     * This dips into the portion of the prepared query that is
     * normally opaque
     *
     * int (4 byte)
     * byte[] (32 bytes -- hash)
     * byte (number of tables)
     * namespace (string)
     * tablename (string)
     * operation (1 byte)
     */
    static _getPrepStmtInfo(dr, res) {
        const off = dr.offset;
        dr.offset += 37; //4 + 32 + 1
        res._namespace = dr.readString();
        res._tableName = dr.readString();
        res._opCode = dr.readByte();
        dr.offset = off;
    }

    static _deserializeDriverPlanInfo(dr, res) {
        res._queryPlan = QueryPlanSerializer.deserialize(dr);
        if (res._queryPlan == null) {
            return;
        }

        //Skip numIterators and numRegisters, not used.
        dr.offset += 8;
        const varCnt = dr.readInt32BE();

        if (varCnt > 0) {
            res._varNames = new Array(varCnt);
            for(let i = 0; i < varCnt; i++) {
                const name = dr.readString();
                const pos = dr.readInt32BE();
                if (pos < 0 || pos >= varCnt) {
                    throw new NoSQLProtocolError(`External variable id \
is out of range for variable ${name}: ${pos}, ${varCnt} variables total`);
                }
                res._varNames[pos] = name;
            }
        }
    }

    static deserializePS(dr, req) {
        const res = {};
        res._sql = req.stmt;
        this._getPrepStmtInfo(dr, res);
        res._prepStmt = dr.readBinary2();
        if (req.opt.getQueryPlan) {
            res._queryPlanStr = dr.readString();
        }
        if (!res._prepStmt.length) {
            throw new NoSQLProtocolError('Received null prepared query');
        }

        this._deserializeDriverPlanInfo(dr, res);
        if (res._queryPlan) {
            res._topoInfo = this.readTopologyInfo(dr);
        }

        return res;
    }

    //eslint-disable-next-line no-unused-vars
    static deserialize(dr, req, serialVersion) {
        const res = {};
        this.deserializeConsumedCapacity(dr, res, req.opt);
        return Object.assign(res, this.deserializePS(dr, req));
    }

}

class QuerySerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.QUERY, serialVersion);
        this.serializeRequest(dw, req);
        this.writeConsistency(dw, req.opt.consistency);
        dw.writeInt(numberOrZero(req.opt.limit));
        dw.writeInt(numberOrZero(req.opt.maxReadKB));
        dw.writeBinary(req.opt.continuationKey);
        dw.writeBoolean(req.prepStmt != null);

        //The following 7 fields were added in V2
        dw.writeInt16BE(QUERY_VERSION);
        dw.writeByte(numberOrZero(req.opt.traceLevel));
        dw.writeInt(numberOrZero(req.opt.maxWriteKB));
        this.writeMathContext(dw, req.opt);
        dw.writeInt(req.prepStmt && req.prepStmt._topoInfo ?
            req.prepStmt._topoInfo.seqNum : -1);
        dw.writeInt(req._shardId != null ? req._shardId : -1);
        dw.writeBoolean(req.prepStmt && !req.prepStmt._queryPlan);

        if (req.prepStmt) {
            dw.writeBinary2(req.prepStmt._prepStmt);
            if (req.prepStmt._bindings) {
                const ents = Object.entries(req.prepStmt._bindings);
                dw.writeInt(ents.length);
                for(let [key, val] of ents) {
                    dw.writeString(key);
                    this.writeFieldValue(dw, val, req.opt);
                }
            } else {
                dw.writeInt(0);
            }
        } else {
            dw.writeString(req.stmt);
        }
    }

    static _deserializeSortPhase1Results(dr, res) {
        res._contAllPartSortPhase1 = dr.readBoolean();
        res._partIds = dr.readIntArray();
        if (res._partIds) {
            res._numResultsPerPartId = dr.readIntArray();
            res._partContKeys = new Array(res._partIds.length);
            for(let i = 0; i < res._partIds.length; i++) {
                res._partContKeys[i] = dr.readBinary();
            }
        }
    }

    //eslint-disable-next-line no-unused-vars
    static deserialize(dr, req, serialVersion) {
        const res = {};

        res.rows = new Array(dr.readInt32BE());
        const isAllPartSortPhase1 = dr.readBoolean();
        for(let i = 0; i < res.rows.length; i++) {
            res.rows[i] = this.readRecord(dr, req.opt);
        }

        if (isAllPartSortPhase1) {
            this._deserializeSortPhase1Results(dr, res);
        }

        this.deserializeConsumedCapacity(dr, res, req.opt);
        res.continuationKey = dr.readBinary();

        /*
         * In V2, if the QueryRequest was not initially prepared, the prepared
         * statement created at the proxy is returned back along with the
         * query results, so that the preparation does not need to be done
         * during each query batch.  For advanced queries, only prepared
         * statement will be returned and the query will start executing
         * on the next invocation of NoSQLClient#query() method.
         */
        if (!req.prepStmt) {
            res._prepStmt = PrepareSerializer.deserializePS(dr, req);
        }
        if (req._queryInternal) {
            res._reachedLimit = dr.readBoolean();
            res._topoInfo = this.readTopologyInfo(dr);
        }

        return res;
    }
}

class SystemRequestSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.SYSTEM_REQUEST, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeBinary(Buffer.isBuffer(req.stmt) ? req.stmt :
            Buffer.from(req.stmt));
    }

    //eslint-disable-next-line no-unused-vars
    static deserialize(dr, req, serialVersion) {
        return this.deserializeSystemResult(dr);
    }

}

class SystemStatusSerializer extends Protocol {

    static serialize(dw, req, serialVersion) {
        this.writeOpCode(dw, OpCode.SYSTEM_STATUS_REQUEST, serialVersion);
        this.serializeRequest(dw, req);
        dw.writeString(req.adminResult.operationId);
        dw.writeString(req.adminResult.stmt);
    }

    //eslint-disable-next-line no-unused-vars
    static deserialize(dr, req, serialVersion) {
        return this.deserializeSystemResult(dr);
    }

}

module.exports = {
    GetSerializer,
    PutSerializer,
    DeleteSerializer,
    MultiDeleteSerializer,
    WriteMultipleSerializer,
    TableRequestSerializer,
    GetTableSerializer,
    TableUsageSerializer,
    GetIndexesSerializer,
    ListTablesSerializer,
    PrepareSerializer,
    QuerySerializer,
    SystemRequestSerializer,
    SystemStatusSerializer
};
