/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');

const isInt32 = require('../utils').isInt32;
const TableState = require('../constants').TableState;
const AdminState = require('../constants').AdminState;
const ServiceType = require('../constants').ServiceType;
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;
const CapacityMode = require('../constants').CapacityMode;
const Region = require('../region');
const Type = require('../binary_protocol/constants').Type;
const MathContext = require('../binary_protocol/constants').MathContext;

const error = require('../error');
const NoSQLArgumentError = error.NoSQLArgumentError;
const NoSQLProtocolError = error.NoSQLProtocolError;

const BinaryProtocol = require('../binary_protocol/protocol');
const Fields = require('./constants').Fields;

class Protocol {

    //Serialization, nw is Nson writer.

    static writeHeader(nw, opCode, serialVersion, req) {
        nw.startMapField(Fields.HEADER);
        nw.writeIntField(Fields.VERSION, serialVersion);
        this.checkWriteStringField(nw, Fields.TABLE_NAME, req.tableName);
        nw.writeIntField(Fields.OP_CODE, opCode);
        nw.writeIntField(Fields.TIMEOUT, req.opt.requestTimeout);
        nw.writeIntField(Fields.TOPO_SEQ_NUM,
            req._topoInfo ? req._topoInfo.seqNum : -1);
        nw.endMapField();
    }

    static checkWriteIntField(nw, name, val) {
        if (val != null) {
            nw.writeIntField(name, val);
        }
    }

    static checkWriteLongField(nw, name, val) {
        if (val != null) {
            nw.writeLongField(name, val);
        }
    }

    static checkWriteStringField(nw, name, val) {
        if (val != null) {
            nw.writeStringField(name, val);
        }
    }

    static checkWriteBooleanField(nw, name, val) {
        if (val) {
            nw.writeBooleanField(name, val);
        }
    }

    static writeConsistency(nw, cons) {
        nw.startMapField(Fields.CONSISTENCY);
        nw.writeIntField(Fields.TYPE, cons.ordinal);
        nw.endMapField();
    }

    static writeKey(nw, key, opt) {
        nw.writeFieldName(Fields.KEY);
        this.writeFieldValue(nw, key, opt);
    }

    static writeValue(nw, val, opt) {
        nw.writeFieldName(Fields.VALUE);
        this.writeFieldValue(nw, val, opt);
    }

    //Assumes ttl already in canonical form, see TTLUtil#validate()
    static ttlToString(ttl) {
        if (ttl.days != null) {
            return (ttl.days !== Infinity ? ttl.days : 0) + ' DAYS';
        }
        assert(ttl.hours != null);
        return ttl.hours + ' HOURS';
    }

    static _writeMapEntries(nw, ent, opt) {
        nw.startMap();
        for(let [key, val] of ent) {
            if (typeof key !== 'string') {
                throw new NoSQLArgumentError(`Invalid map or object key for \
field value: ${key}, must be a string`);
            }
            nw.writeFieldName(key);
            this.writeFieldValue(nw, val, opt);
        }
        nw.endMap();
    }

    static writeMap(nw, map, opt) {
        this._writeMapEntries(nw, map.entries(), opt);
    }

    static writeObject(nw, obj, opt) {
        this._writeMapEntries(nw, Object.entries(obj), opt);
    }

    static writeRowVersion(nw, version) {
        nw.writeBinaryField(Fields.ROW_VERSION, version);
    }

    static writeFieldRange(nw, fr, opt) {
        nw.startMapField(Fields.RANGE);
        nw.writeStringField(Fields.RANGE_PATH, fr.fieldName);

        let inclusive = (fr.startWith != null);
        let val = inclusive ? fr.startWith : fr.startAfter;
        if (val != null) {
            nw.startMapField(Fields.START);
            this.writeValue(nw, val, opt);
            nw.writeBooleanField(Fields.INCLUSIVE, inclusive);
            nw.endMapField();
        }

        inclusive = (fr.endWith != null);
        val = inclusive ? fr.endWith : fr.endBefore;
        if (val != null) {
            nw.startMapField(Fields.END);
            this.writeValue(nw, val, opt);
            nw.writeBooleanField(Fields.INCLUSIVE, inclusive);
            nw.endMapField();
        }

        nw.endMapField();
    }

    static writeFieldValue(nw, val, opt) {
        if (typeof val === 'function') {
            //If the field specified as a function, we write its return value
            val = val();
        }
        if (val === undefined) {
            return nw.writeNull();
        }
        if (val === null) {
            return nw.writeJsonNull();
        }
        switch(typeof val) {
        case 'boolean':
            nw.writeBoolean(val);
            break;
        case 'string':
            nw.writeString(val);
            break;
        case 'number':
            if (Number.isSafeInteger(val)) {
                if (isInt32(val)) {
                    nw.writeInt(val);
                } else {
                    nw.writeLong(val);
                }
            } else {
                nw.writeDouble(val);
            }
            break;
        case 'bigint':
            nw.writeLong(val);
            break;
        case 'object':
            if (Buffer.isBuffer(val)) {
                nw.writeBinary(val);
            } else if (val instanceof Date) {
                nw.writeDate(val);
            } else if (Array.isArray(val)) {
                nw.startArray();
                for(const elem of val) {
                    this.writeFieldValue(nw, elem, opt);
                }
                nw.endArray();
            } else if (opt._dbNumber != null &&
                opt._dbNumber.isInstance(val)) {
                nw.writeStringAsNumber(opt._dbNumber.stringValue(val));
            } else {
                if (val instanceof Map) {
                    this.writeMap(nw, val, opt);
                } else {
                    this.writeObject(nw, val, opt);
                }
            }
            break;
        default:
            if (val === EMPTY_VALUE) {
                nw.writeEmpty();
                break;
            }
            throw new NoSQLArgumentError('Unsupported value type ' +
                `${typeof val} for value ${val.toString()}`);
        }
    }

    static serializeWriteRequest(nw, req) {
        this.writeDurability(nw, req.opt.durability);
        nw.writeBooleanField(Fields.RETURN_ROW, req.opt.returnExisting);
    }

    static writeDurability(nw, dur) {
        nw.writeIntField(Fields.DURABILITY,
            BinaryProtocol.durabilityToNum(dur));
    }

    static writeMathContext(nw, opt) {
        if (opt._dbNumber == null) {
            return nw.writeIntField(Fields.MATH_CONTEXT_CODE,
                MathContext.DEFAULT);
        }

        nw.writeIntField(Fields.MATH_CONTEXT_CODE, MathContext.CUSTOM);
        nw.writeIntField(Fields.MATH_CONTEXT_PRECISION,
            opt._dbNumber.precision);
        nw.writeIntField(Fields.MATH_CONTEXT_ROUNDING_MODE,
            opt._dbNumber.roundingMode);
    }

    //Deserialization.

    static mapError(rc, msg, req) {
        return BinaryProtocol.mapError(rc, msg, req);
    }

    //To throw correct error if received invalid value.
    static numToEnum(val, cons, req) {
        try {
            return cons.fromOrdinal(val);
        } catch(err) {
            throw new NoSQLProtocolError(
                `Received invalid value of ${cons.name}: {val}`, err, req);
        }
    }

    //Same as above.
    static parseJSON(val, name, req) {
        try {
            return JSON.parse(val);
        } catch(err) {
            throw new NoSQLProtocolError(
                `Error parsing ${name}: ${err.message}`, err, req);
        }
    }

    static readArray(nr, readItem, ...args) {
        nr.expectType(Type.ARRAY);
        const res = new Array(nr.count);

        for (let i = 0; i < res.length; i++) {
            nr.next();
            //Enable readItem to use Protocol context
            res[i] = readItem.call(this, nr, ...args);
        }

        return res;
    }

    //processField() takes field name as an argument.  It returns true if
    //the field was read and processed or false if the field was ignored, in
    //which case we will skip it.
    //We assume processField() gets any other needed info (including the
    //NsonReader instance) from the closure context, as this is more
    //convenient, but we may add other overloads if required.
    static readMap(nr, processField) {
        nr.expectType(Type.MAP);
        const cnt = nr.count;        
        for (let i = 0; i < cnt; i++) {
            nr.next();
            if (!processField(nr.field)) {
                nr.skipValue();
            }
        }
    }

    static readDateAsLong(nr) {
        const val = nr.readLong();
        return val ? new Date(val) : undefined;
    }

    static validateTopologyInfo(topoInfo) {
        //We don't need to validate types of seqNum and shardIds because they
        //are read with correct types by NsonReader.
        if (topoInfo.seqNum == null || topoInfo.seqNum < 0) {
            throw new NoSQLProtocolError(
                `Received invalid topology seqNum: ${topoInfo.seqNum}`);
        }
        if (!topoInfo.shardIds || !topoInfo.shardIds.length) {
            throw new NoSQLProtocolError(
                `Missing shard ids for topology seqNum ${topoInfo.seqNum}`);
        }
    }

    static readTopologyInfo(nr) {
        const res = {};

        this.readMap(nr, field => {
            switch(field) {
            case Fields.PROXY_TOPO_SEQNUM:
                res.seqNum = nr.readInt();
                return true;
            case Fields.SHARD_IDS:
                res.shardIds = this.readArray(nr, nr => nr.readInt());
                return true;
            default:
                return false;
            }
        });

        this.validateTopologyInfo(res);
        return res;
    }

    static readReplicaInfo(nr, req) {
        const res = {};

        this.readMap(nr, field => {
            switch(field) {
            case Fields.REGION:
                res.replicaName = nr.readString();
                //May be undefined for regions not yet added to region.js.
                res.region = Region.fromRegionId(res.replicaName);
                return true;
            case Fields.TABLE_OCID:
                res.replicaOCID = nr.readString();
                return true;
            case Fields.WRITE_UNITS:
                res.writeUnits = nr.readInt();
                return true;
            case Fields.LIMITS_MODE:
                res.capacityMode = this.numToEnum(nr.readInt(), CapacityMode,
                    req);
                return true;
            case Fields.TABLE_STATE:
                res.state = this.numToEnum(nr.readInt(), TableState, req);
                return true;
            default:
                return false;
            }
        });

        return res;
    }

    static deserializeConsumedCapacity(nr) {
        const res = {};
        
        this.readMap(nr, field => {
            switch(field) {
            case Fields.READ_UNITS:
                res.readUnits = nr.readInt();
                return true;
            case Fields.READ_KB:
                res.readKB = nr.readInt();
                return true;
            case Fields.WRITE_KB:
                res.writeKB = nr.readInt();
                res.writeUnits = res.writeKB;
                return true;
            default:
                return false;
            }
        });

        return res;
    }

    static deserializeResponse(nr, req, processField, res) {
        let rc = 0;
        let msg;

        nr.next();
        if (res == null) {
            res = {};
        }

        this.readMap(nr, field => {
            switch (field) {
            case Fields.CONSUMED:
                if (req.opt.serviceType !== ServiceType.KVSTORE) {
                    res.consumedCapacity =
                        this.deserializeConsumedCapacity(nr);
                    return true;
                }
                return false;
            case Fields.ERROR_CODE:
                rc = nr.readInt();
                return true;
            case Fields.EXCEPTION:
                msg = nr.readString();
                return true;
            case Fields.TOPOLOGY_INFO:
                res._topoInfo = this.readTopologyInfo(nr);
                return true;
            default:
                return processField(field, res);
            }
        });

        if (rc != 0) {
            throw this.mapError(rc, msg, req);
        }

        return res;
    }

    static deserializeTableResult(nr, req) {
        return this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.COMPARTMENT_OCID:
                res.compartmentId = nr.readString();
                return true;
            case Fields.NAMESPACE:
                res.namespace = nr.readString();
                return true;
            case Fields.TABLE_OCID:
                res.tableOCID = nr.readString();
                return true;
            case Fields.TABLE_NAME:
                res.tableName = nr.readString();
                return true;
            case Fields.TABLE_STATE:
                res.tableState = this.numToEnum(nr.readInt(), TableState,
                    req);
                return true;
            case Fields.TABLE_SCHEMA:
                res.schema = nr.readString();
                return true;
            case Fields.TABLE_DDL:
                res.tableDDL = nr.readString();
                return true;
            case Fields.OPERATION_ID:
                res.operationId = nr.readString();
                return true;
            case Fields.FREE_FORM_TAGS:
                res.freeFormTags = this.parseJSON(nr.readString(),
                    'free-form tags', req);
                return true;
            case Fields.DEFINED_TAGS:
                res.definedTags = this.parseJSON(nr.readString(),
                    'defined tags', req);
                return true;
            case Fields.ETAG:
                res.etag = nr.readString();
                return true;
            case Fields.LIMITS:
                res.tableLimits = {
                    readUnits: 0,
                    writeUnits: 0,
                    mode: CapacityMode.PROVISIONED
                };
                this.readMap(nr, limitsField => {
                    switch (limitsField) {
                    case Fields.READ_UNITS:
                        res.tableLimits.readUnits = nr.readInt();
                        return true;
                    case Fields.WRITE_UNITS:
                        res.tableLimits.writeUnits = nr.readInt();
                        return true;
                    case Fields.STORAGE_GB:
                        res.tableLimits.storageGB = nr.readInt();
                        return true;
                    case Fields.LIMITS_MODE:
                        res.tableLimits.mode = this.numToEnum(nr.readInt(),
                            CapacityMode, req);
                        return true;
                    default:
                        return false;
                    }
                });
                return true;
            case Fields.SCHEMA_FROZEN:
                res.isSchemaFrozen = nr.readBoolean();
                return true;
            case Fields.INITIALIZED:
                res.isLocalReplicaInitialized = nr.readBoolean();
                return true;
            case Fields.REPLICAS:
                res.isReplicated = true;
                res.replicas = this.readArray(nr, this.readReplicaInfo, req);
                return true;
            default:
                return false;
            }
        }, req.opt.serviceType === ServiceType.CLOUD ? {
            isSchemaFrozen: false,
            isReplicated: false,
            isLocalReplicaInitialized: false
        } : {});
    }

    static readArrayValue(nr, opt) {
        const cnt = nr.count;
        var res = new Array(cnt);
        for (let i = 0; i < cnt; i++) {
            nr.next();
            res[i] = this.readFieldValue(nr, opt);
        }
        return res;
    }

    //For now, we will use objectst to represent map values because currently
    //both Record and Map columns are sent with the same type code and it is
    //more natural to represent Record value as object.  IMO, it is more
    //adequate for now to represent Map value as object than to represent
    //Record value as JavaScript Map.
    static readMapValue(nr, opt) {
        nr.expectType(Type.MAP);
        const res = {};
        const cnt = nr.count;     
        for (let i = 0; i < cnt; i++) {
            nr.next();
            res[nr.field] = this.readFieldValue(nr, opt);
        }
        return res;
    }

    //Assume the type code has already been read.
    static readFieldValue(nr, opt) {
        switch(nr.type) {
        case Type.ARRAY:
            return this.readArrayValue(nr, opt);
        case Type.BINARY:
            return nr.readBinary();
        case Type.BOOLEAN:
            return nr.readBoolean();
        case Type.DOUBLE:
            return nr.readDouble();
        case Type.INTEGER:
            return nr.readInt();
        case Type.LONG:
            return nr.readLong(opt.longAsBigInt);
        case Type.MAP:
            return this.readMapValue(nr, opt);
        case Type.STRING:
            return nr.readString();
        case Type.TIMESTAMP:
            return nr.readDate();
        case Type.NUMBER:
            return (opt._dbNumber != null) ?
                opt._dbNumber.create(nr.readNumberAsString()) :
                Number(nr.readNumberAsString());
        case Type.NULL:
            return undefined;
        case Type.JSON_NULL:
            return null;
        case Type.EMPTY:
            return EMPTY_VALUE;
        default:
            throw new NoSQLProtocolError(
                `Unknown value type code: ${nr.type}`);
        }
    }

    static readRow(nr, opt) {
        return this.readMapValue(nr, opt);
    }

    static readRowVersion(nr) {
        return nr.readBinary();
    }

    static deserializeReturnInfo(nr, res, opt) {
        this.readMap(nr, field => {
            switch (field){
            case Fields.EXISTING_MOD_TIME:
                res.existingModificationTime = this.readDateAsLong(nr);
                return true;
            case Fields.EXISTING_VERSION:
                res.existingVersion = this.readRowVersion(nr);
                return true;
            case Fields.EXISTING_VALUE:
                res.existingRow = this.readRow(nr, opt);
                return true;
            default:
                return false;
            }
        });
    }

    static deserializeSystemResult(nr, req) {
        return this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.SYSOP_STATE:
                res.state = AdminState.fromOrdinal(nr.readInt());
                return true;
            case Fields.SYSOP_RESULT:
                res.output = nr.readString();
                return true;
            case Fields.STATEMENT:
                res.statement = nr.readString();
                return true;
            case Fields.OPERATION_ID:
                res.operationId = nr.readString();
                return true;
            default:
                return false;
            }
        });
    }

}

module.exports = Protocol;
