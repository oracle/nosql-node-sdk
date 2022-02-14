/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');

const isInt32 = require('../utils').isInt32;
const TableState = require('../constants').TableState;
const AdminState = require('../constants').AdminState;
const ScanDirection = require('../constants').ScanDirection;
const ServiceType = require('../constants').ServiceType;
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;
const CapacityMode = require('../constants').CapacityMode;
const Type = require('./constants').Type;
const TTLTimeUnit = require('./constants').TTLTimeUnit;
const MathContext = require('./constants').MathContext;

const ErrorCode = require('../error_code');
const error = require('../error');
const NoSQLError = error.NoSQLError;
const NoSQLArgumentError = error.NoSQLArgumentError;
const NoSQLProtocolError = error.NoSQLProtocolError;

class Protocol {

    //Serialization.

    static writeTimeout(dw, timeout) {
        dw.writeInt(timeout);
    }

    static writeConsistency(dw, cons) {
        dw.writeByte(cons.ordinal);
    }

    static writeScanDirection(dw, dir) {
        if (!dir) {
            dir = ScanDirection.UNORDERED;
        }
        dw.writeByte(dir.ordinal);
    }

    //Assumes ttl already in canonical form, see TTLUtil#validate()
    static writeTTL(dw, ttl) {
        if (ttl == null) { //null or undefined
            return dw.writeLong(-1);
        }
        if (ttl.days != null) {
            dw.writeLong(ttl.days !== Infinity ? ttl.days : 0);
            return dw.writeByte(TTLTimeUnit.DAYS);
        }
        assert(ttl.hours != null);
        dw.writeLong(ttl.hours);
        dw.writeByte(TTLTimeUnit.HOURS);
    }

    static writeArray(dw, array, opt) {
        const lengthOffset = dw.buffer.length;
        dw.writeInt32BE(0);
        const start = dw.buffer.length;
        
        dw.writeInt32BE(array.length);
        for(let val of array) {
            this.writeFieldValue(dw, val, opt);
        }

        dw.buffer.writeInt32BE(dw.buffer.length - start, lengthOffset);
    }

    static _sortMapEntries(ent) {
        if (!Array.isArray(ent)) {
            ent = Array.from(ent);
        }
        //no reason to consider == since keys should be distinct
        return ent.sort((a, b) => a[0] > b[0] ? 1 : -1);
    }

    static _writeMapEntries(dw, ent, cnt, opt) {
        if (opt._writeSortedMaps) {
            //used by the query code to serialize grouping columns of type MAP
            ent = this._sortMapEntries(ent);
        }

        const lengthOffset = dw.buffer.length;
        dw.writeInt32BE(0);
        const start = dw.buffer.length;

        dw.writeInt32BE(cnt);
        for(let [key, val] of ent) {
            if (typeof key !== 'string') {
                throw new NoSQLArgumentError(`Invalid map or object key for \
field value: ${key}, must be a string`);
            }
            dw.writeString(key);
            this.writeFieldValue(dw, val, opt);
        }

        dw.buffer.writeInt32BE(dw.buffer.length - start, lengthOffset);
    }

    static writeMap(dw, map, opt) {
        this._writeMapEntries(dw, map.entries(), map.size, opt);
    }

    static writeObject(dw, obj, opt) {
        const ent = Object.entries(obj);
        this._writeMapEntries(dw, ent, ent.length, opt);
    }

    static writeVersion(dw, version) {
        dw.writeBinary(version);
    }

    static writeOpCode(dw, opCode, serialVersion) {
        dw.writeInt16BE(serialVersion);
        dw.writeByte(opCode);
    }

    static writeSubOpCode(dw, opCode) {
        dw.writeByte(opCode);
    }

    static writeFieldRange(dw, fr, opt) {
        if (!fr) {
            dw.writeBoolean(false);
            return;
        }

        dw.writeBoolean(true);
        dw.writeString(fr.fieldName);

        if (fr.startWith) {
            dw.writeBoolean(true);
            this.writeFieldValue(dw, fr.startWith, opt);
            dw.writeBoolean(true);
        } else if (fr.startAfter) {
            dw.writeBoolean(true);
            this.writeFieldValue(dw, fr.startAfter, opt);
            dw.writeBoolean(false);
        } else {
            dw.writeBoolean(false);
        }
        
        if (fr.endWith) {
            dw.writeBoolean(true);
            this.writeFieldValue(dw, fr.endWith, opt);
            dw.writeBoolean(true);
        } else if (fr.endBefore) {
            dw.writeBoolean(true);
            this.writeFieldValue(dw, fr.endBefore, opt);
            dw.writeBoolean(false);
        } else {
            dw.writeBoolean(false);
        }
    }
    
    static writeFieldValue(dw, val, opt) {
        if (typeof val === 'function') {
            //If the field specified as a function, we write its return value
            val = val();
        }
        if (val === undefined) {
            return dw.writeByte(Type.NULL);
        }
        if (val === null) {
            return dw.writeByte(Type.JSON_NULL);
        }
        switch(typeof val) {
        case 'boolean':
            dw.writeByte(Type.BOOLEAN);
            dw.writeBoolean(val);
            break;
        case 'string':
            dw.writeByte(Type.STRING);
            dw.writeString(val);
            break;
        case 'number':
            if (Number.isSafeInteger(val)) {
                if (isInt32(val)) {
                    dw.writeByte(Type.INTEGER);
                    dw.writeInt(val);
                } else {
                    dw.writeByte(Type.LONG);
                    dw.writeLong(val);
                }
            } else {
                dw.writeByte(Type.DOUBLE);
                dw.writeDouble(val);
            }
            break;
        case 'object':
            if (Buffer.isBuffer(val)) {
                dw.writeByte(Type.BINARY);
                dw.writeBinary(val);
                break;
            } else if (val instanceof Date) {
                dw.writeByte(Type.TIMESTAMP);
                dw.writeDate(val);
                break;
            } else if (Array.isArray(val)) {
                dw.writeByte(Type.ARRAY);
                this.writeArray(dw, val, opt);
                break;
            } else if (opt._dbNumber != null &&
                opt._dbNumber.isInstance(val)) {
                dw.writeByte(Type.NUMBER);
                dw.writeString(opt._dbNumber.stringValue(val));
                break;
            } else {
                dw.writeByte(Type.MAP);
                if (val instanceof Map) {
                    this.writeMap(dw, val, opt);
                } else {
                    this.writeObject(dw, val, opt);
                }
                break;
            }
        default:
            throw new NoSQLArgumentError('Unsupported value type ' +
                `${typeof val} for value ${val.toString()}`);
        }
    }

    static serializeRequest(dw, req) {
        assert(req.opt.requestTimeout);
        this.writeTimeout(dw, req.opt.requestTimeout);
    }

    static serializeReadRequest(dw, req) {
        this.serializeRequest(dw, req);
        dw.writeString(req.tableName);
        this.writeConsistency(dw, req.opt.consistency);
    }

    static serializeWriteRequest(dw, req, serialVersion) {
        this.serializeRequest(dw, req);
        dw.writeString(req.tableName);
        dw.writeBoolean(req.opt.returnExisting);
        this.writeDurability(dw, req.opt.durability, serialVersion);
    }

    static writeDurability(dw, dur, serialVersion) {
        if (serialVersion < 3) {
            return;
        }
        if (dur == null) {
            dw.writeByte(0);
            return;
        }
        var bval = dur.masterSync.ordinal;
        bval |= (dur.replicaSync.ordinal << 2);
        bval |= (dur.replicaAck.ordinal << 4);
        dw.writeByte(bval);
    }

    static writeMathContext(dw, opt) {
        if (opt._dbNumber == null) {
            return dw.writeByte(MathContext.DEFAULT);
        }
        dw.writeByte(MathContext.CUSTOM);
        dw.writeInt32BE(opt._dbNumber.precision);
        dw.writeInt32BE(opt._dbNumber.roundingMode);
    }

    //Deserialization.

    static readArray(dr, opt) {
        dr.readInt32BE(); //read total length
        const len = dr.readInt32BE();
        
        const array = new Array(len);
        for(let i = 0; i < len; i++) {
            array[i] = this.readFieldValue(dr, opt);
        }

        return array;
    }

    //For now, we will use readObject() for Map columns because currently
    //both Record and Map columns are sent with the same type code and it is
    //more natural to represent Record value as object.  IMO, it is more
    //adequate for now to represent Map value as object than to represent
    //Record value as JavaScript Map.
    static readMap(dr, opt) {
        dr.readInt32BE(); //read total length
        const size = dr.readInt32BE();

        const map = new Map();
        for(let i = 0; i < size; i++) {
            const key = dr.readString();
            const val = this.readFieldValue(dr, opt);
            map.set(key, val);
        }

        return map;
    }

    static readObject(dr, opt) {
        dr.readInt32BE(); //read total length
        const size = dr.readInt32BE();

        const obj = {};
        for(let i = 0; i < size; i++) {
            const key = dr.readString();
            const val = this.readFieldValue(dr, opt);
            obj[key] = val;
        }

        return obj;
    }

    static readFieldValue(dr, opt) {
        const type = dr.readByte();
        switch(type) {
        case Type.ARRAY:
            return this.readArray(dr, opt);
        case Type.BINARY:
            return dr.readBinary();
        case Type.BOOLEAN:
            return dr.readBoolean();
        case Type.DOUBLE:
            return dr.readDouble();
        case Type.INTEGER:
            return dr.readInt();
        case Type.LONG:
            return dr.readLong();
        case Type.MAP:
            //Until Record type code is added to the protocol
            return this.readObject(dr, opt);
        case Type.STRING:
            return dr.readString();
        case Type.TIMESTAMP:
            return dr.readDate();
        case Type.NUMBER:
            return (opt._dbNumber != null) ?
                opt._dbNumber.create(dr.readString()) :
                Number(dr.readString());
        case Type.NULL:
            return undefined;
        case Type.JSON_NULL:
            return null;
        case Type.EMPTY:
            return EMPTY_VALUE;
        default:
            throw new NoSQLProtocolError(`Unknown value type code: ${type}`);
        }
    }

    static readRecord(dr, opt) {
        const type = dr.readByte();
        //Until Record type code is added to the protocol
        if (type !== Type.MAP) {
            throw new NoSQLProtocolError(`Unexpected type code for row: \
${type}, expecting ${Type.MAP} (map)`);
        }
        return this.readObject(dr, opt, true);
    }

    static readVersion(dr) {
        return dr.readBinary();
    }
    
    static deserializeConsumedCapacity(dr, res, opt) {
        const readUnits = dr.readInt();
        const readKB = dr.readInt();
        const writeKB = dr.readInt();
        if (opt.serviceType !== ServiceType.KVSTORE) {
            res.consumedCapacity = {
                readUnits,
                readKB,
                writeUnits: writeKB,
                writeKB
            };
        }
    }

    static deserializeWriteResponse(dr, opt, res, serialVersion) {
        const returnInfo = dr.readBoolean();
        if (returnInfo) {
            res.existingRow = this.readRecord(dr, opt);
            res.existingVersion = this.readVersion(dr);
            if (serialVersion > 2) {
                res.existingModificationTime = dr.readLong();
            } else {
                res.existingModificationTime = 0;
            }
        }
        return res;
    }

    static deserializeWriteResponseWithId(dr, opt, res, serialVersion) {
        this.deserializeWriteResponse(dr, opt, res, serialVersion);
        if (dr.readBoolean()) { //has generated id column value
            res.generatedValue = this.readFieldValue(dr, opt);
        }
        return res;
    }

    static deserializeTableResult(dr, opt, serialVersion) {
        const res = {};
        const hasInfo = dr.readBoolean();
        if (hasInfo) {
            const compartmentId = dr.readString();
            if (opt.serviceType === ServiceType.CLOUD) {
                res.compartmentId = compartmentId;
            }
            res.tableName = dr.readString();
            res.tableState = TableState.fromOrdinal(dr.readByte());
        }
        const hasStaticState = dr.readBoolean();
        if (hasStaticState) {
            const readUnits = dr.readInt();
            const writeUnits = dr.readInt();
            const storageGB = dr.readInt();
            let mode = CapacityMode.PROVISIONED;
            if (serialVersion > 2) {
                mode = CapacityMode.fromOrdinal(dr.readByte());
            }
            if (opt.serviceType !== ServiceType.KVSTORE) {
                res.tableLimits = { readUnits, writeUnits, storageGB, mode };
            }
            res.schema = dr.readString();
        }
        res.operationId = dr.readString();
        return res;
    }

    static readTopologyInfo(dr) {
        const seqNum = dr.readInt();
        if (seqNum < -1) {
            throw new NoSQLProtocolError(
                `Invalid topology sequence number: ${seqNum}`);
        }
        if (seqNum === -1) {
            //No topology info sent by proxy
            return null;
        }
        const shardIds = dr.readIntArray();
        return {
            seqNum,
            shardIds
        };
    }

    static mapError(rc, msg) {
        try {
            const err = NoSQLError.create(ErrorCode.fromOrdinal(rc), msg);
            err._rejectedByDriver = false; //for testing
            return err;
        } catch(err) {
            return new NoSQLProtocolError(
                'Received invalid error code: ' + rc, err);
        }
    }

    static deserializeSystemResult(dr) {
        const res = {};
        res.state = AdminState.fromOrdinal(dr.readByte());
        res.operationId = dr.readString();
        res.statement = dr.readString();
        res.output = dr.readString();
        return res;
    }

}

module.exports = Protocol;
