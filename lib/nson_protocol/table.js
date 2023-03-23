/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const Protocol = require('./protocol');
const NoSQLProtocolError = require('../error').NoSQLProtocolError;
const stringToUTCDate = require('../utils').stringToUTCDate;
const CapacityMode = require('../constants').CapacityMode;
const OpCode = require('../binary_protocol/constants').OpCode;
const Type = require('../binary_protocol/constants').Type;
const Fields = require('./constants').Fields;

class TableRequestSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.TABLE_REQUEST, serialVersion, req);
        
        nw.startMapField(Fields.PAYLOAD);
        this.checkWriteStringField(nw, Fields.STATEMENT, req.stmt);

        const tableLimits = req.opt.tableLimits;
        if (tableLimits != null) {
            nw.startMapField(Fields.LIMITS);
            nw.writeIntField(Fields.READ_UNITS, tableLimits.readUnits);
            nw.writeIntField(Fields.WRITE_UNITS, tableLimits.writeUnits);
            nw.writeIntField(Fields.STORAGE_GB, tableLimits.storageGB);
            nw.writeIntField(Fields.LIMITS_MODE, tableLimits.mode != null ?
                tableLimits.mode.ordinal : CapacityMode.PROVISIONED.ordinal);
            nw.endMapField();
        }

        if (req.opt.definedtags != null) {
            nw.writeStringField(Fields.DEFINED_TAGS,
                JSON.stringify(req.opt.definedTags));
        }
        if (req.opt.freeFormTags != null) {
            nw.writeStringField(Fields.FREE_FORM_TAGS,
                JSON.stringify(req.opt.freeFormTags));
        }

        this.checkWriteStringField(nw, Fields.ETAG, req.opt.matchETag);

        nw.endMapField();
        nw.endMap();
    }

    static deserialize(nr, req) {
        return this.deserializeTableResult(nr, req);
    }
}

class GetTableSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.GET_TABLE, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        this.checkWriteStringField(nw, Fields.OPERATION_ID,
            req.opt.operationId);
        nw.endMapField();
        nw.endMap();
    }

    static deserialize(dr, req) {
        return this.deserializeTableResult(dr, req);
    }

}

class TableUsageSerializer extends Protocol {

    static _deserializeUsageRecord(nr) {
        const rec = {};

        Protocol.readMap(nr, (field) => {
            switch (field)
            {
            case Fields.START:
                rec.startTime = stringToUTCDate(nr.readString());
                return true;
            case Fields.TABLE_USAGE_PERIOD:
                rec.secondsInPeriod = nr.readInt();
                return true;
            case Fields.READ_UNITS:
                rec.readUnits = nr.readInt();
                return true;
            case Fields.WRITE_UNITS:
                rec.writeUnits = nr.readInt();
                return true;
            case Fields.STORAGE_GB:
                rec.storageGB = nr.readInt();
                return true;
            case Fields.READ_THROTTLE_COUNT:
                rec.readThrottleCount = nr.readInt();
                return true;
            case Fields.WRITE_THROTTLE_COUNT:
                rec.writeThrottleCount = nr.readInt();
                return true;
            case Fields.STORAGE_THROTTLE_COUNT:
                rec.storageThrottleCount = nr.readInt();
                return true;
            case Fields.MAX_SHARD_USAGE_PERCENT:
                rec.maxShardUsagePercent = nr.readInt();
                return true;
            default:
                return false;
            }
        });

        return rec;
    }

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.GET_TABLE_USAGE, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);

        //already converted to Date during validation
        if (req.opt.startTime) {
            nw.writeStringField(Fields.START,
                req.opt.startTime.toISOString());
        }
        if (req.opt.endTime) {
            nw.writeStringField(Fields.END, req.opt.endTime.toISOString());
        }
        this.checkWriteIntField(nw, Fields.LIST_MAX_TO_READ, req.opt.limit);
        this.checkWriteIntField(nw, Fields.LIST_START_INDEX,
            req.opt.startIndex);

        nw.endMapField();
        nw.endMap();
    }

    static deserialize(nr, req) {
        const res = this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.TABLE_NAME:
                res.tableName = nr.readString();
                return true;
            case Fields.TABLE_USAGE:
                res.usageRecords = this.readArray(nr,
                    this._deserializeUsageRecord);
                return true;
            case Fields.LAST_INDEX:
                res.nextIndex = nr.readInt();
                return true;
            default:
                return false;
            }
        });

        res.usageRecords = res.usageRecords || [];
        return res;
    }

}

class GetIndexesSerializer extends Protocol {

    static _deserializeIndexResult(nr) {
        const res = {};
        Protocol.readMap(nr, field => {
            switch (field) {
            case Fields.NAME:
                res.indexName = nr.readString();
                return true;
            case Fields.FIELDS:
                //We can't use readArray() here since we need to
                //populate two arrays.
                nr.expectType(Type.ARRAY);
                res.fields = new Array(nr.count);
                res.fieldTypes = new Array(res.fields.length);
                for (let i = 0; i < res.fields.length; i++) {
                    nr.next();
                    let name;
                    let type;
                    Protocol.readMap(nr, field => {
                        switch (field) {
                        case Fields.PATH:
                            name = nr.readString();
                            return true;
                        case Fields.TYPE:
                            type = nr.readString();
                            return true;
                        default:
                            return false;
                        }
                    });
                    if (!name) {
                        throw new NoSQLProtocolError(`Missing field name in \
index result at position ${i}`);
                    }
                    res.fields[i] = name;
                    res.fieldTypes[i] = type;
                }
                return true;
            default:
                return false;
            }
        });
        
        return res;
    }

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.GET_INDEXES, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        this.checkWriteStringField(nw, Fields.INDEX, req.opt.indexName);
        nw.endMapField();
        nw.endMap();
    }

    static deserialize(nr, req) {
        const res = this.deserializeResponse(nr, req, (field, res) => {
            if (field !== Fields.INDEXES) {
                return false;
            }
            res.indexes = this.readArray(nr, this._deserializeIndexResult);
            return true;
        });

        return res.indexes ? res.indexes : [];
    }

}

class ListTablesSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.LIST_TABLES, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        this.checkWriteIntField(nw, Fields.LIST_START_INDEX,
            req.opt.startIndex);
        this.checkWriteIntField(nw, Fields.LIST_MAX_TO_READ, req.opt.limit);
        this.checkWriteStringField(nw, Fields.NAMESPACE, req.opt.namespace);
        nw.endMapField();
        nw.endMap();
    }

    static deserialize(nr, req) {
        const res = this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.TABLES:
                res.tables = this.readArray(nr, nr => nr.readString());
                return true;
            case Fields.LAST_INDEX:
                res.lastIndex = nr.readInt();
                return true;
            default:
                return false;
            }
        });

        res.tables = res.tables || [];
        return res;
    }

}

module.exports = {
    TableRequestSerializer,
    GetTableSerializer,
    TableUsageSerializer,
    GetIndexesSerializer,
    ListTablesSerializer,
};
