/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const Type = require('../binary_protocol/constants').Type;
const DataReader = require('../binary_protocol/reader');
const NoSQLProtocolError = require('../error').NoSQLProtocolError;

//To prevent an infinite loop for bad serialization.
const MAX_ELEM_COUNT = 1000000000;

class NsonReader {

    constructor(buf) {
        this._dr = new DataReader(buf);
        this._stack = [];
    }

    //for error reporting
    _typeStr(type) {
        if (type == undefined) {
            type = this._type;
        }
        const str = Object.keys(Type).find(key => Type[key] === type);
        return str ? str : `(unknown type code ${type})`;
    }

    _stackTop() {
        return this._stack.length ?
            this._stack[this._stack.length - 1] : undefined;
    }

    _chkNsonType(type) {
        if (this._type !== type) {
            throw new NoSQLProtocolError(
                `Cannot read value of type ${this._typeStr()} as type \
${this._typeStr(type)}`);
        }
    }

    _skipBytes(len) {
        if (this._dr.offset + len > this._dr.buffer.length) {
            throw new NoSQLProtocolError(
                `End of stream reached trying to skip ${len} byte(s) while \
skipping ${this._typeStr()}, stream length: ${this._dr.buffer.length}, \
position: ${this._dr.offset}`);
        }
        this._dr.offset += len;
    }

    get dataReader() {
        return this._dr;
    }

    //Last Nson type read, undefined if nothing is read yet.
    get type() {
        return this._type;
    }

    //Total number of elements or entries in the current array or map, or 0 if
    //none. This lets the caller know how many entries to read. Note that this
    //value is only guaranteed to be correct right after the call to Next()
    //that finds the map or array.  Later this value may change when reading
    //nested maps or arrays.
    get count() {
        const top = this._stackTop();
        return top ? top.count : 0;
    }

    //Field name last read. If map entry is just read, the stream is
    //positioned to get the field value.  For atomic values, the caller
    //should call one of the read...() methods to read the value.
    //For array or map, the caller should call next() again to start reading
    //elements or entries, up to the value of count.
    //Note that this is just last field name read, and is not saved on the
    //stack, so the parent map field name will not be available even after
    //the child map has been read. For now, we expect the caller to keep
    //track of this if needed.
    get field() { return this._field; }

    reset() {
        this._field = undefined;
        this._type = undefined;
        this._stack.length = 0;
        this._dr.reset();
        return this;
    }

    //Start reading the next element and return its Nson type.  For atomic
    //values, the stream will be positioned to call one of read...() methods
    //to get the value.  For array or map, the caller will need to call next()
    //again to read the elements or entries. Note that if currently inside
    //the map, this function will also consume the field name, which will be
    //available as "field" property.
    next() {
        var top = this._stackTop();
        //Check if we are done with current array or map, this can be
        //multi-level.
        while (top && top.numRead === top.count) {
            const bytesRead = this._dr.offset - top.startPos;
            if (top.len != bytesRead) {
                // Or should we just log this instead?
                throw new NoSQLProtocolError(
                    `Read invalid ${this._typeStr()} length: expected \
${top.len}, got ${bytesRead}`);
            }

            this._stack.pop();
            top = this._stackTop();
        }

        if (top != null) {
            //If inside map, we must first read the field name.
            if (top.type == Type.MAP) {
                this._field = this._dr.readString();
            }
            top.numRead++;
        }

        this._type = this._dr.readByte();

        //Start array or map.
        if (this._type == Type.ARRAY || this._type == Type.MAP) {
            const elem = {
                type: this._type,
                len: this._dr.readInt32BE(), //byte length of array or map
                startPos: this._dr.offset, //starts after byte length is read
                //number of array or map elements
                count: this._dr.readInt32BE(),
                numRead: 0
            };

            if (elem.count < 0 || elem.count > MAX_ELEM_COUNT) {
                throw new NoSQLProtocolError(
                    `Invalid number of elements for type ${this._typeStr()}: \
${elem.count}`);
            }

            this._stack.push(elem);
        }
    }

    expectType(type) {
        //Different error message than in _chkNsonType().
        if (this._type !== type) {
            throw new NoSQLProtocolError(
                `Expecting type ${this._typeStr(type)}, got type \
${this._typeStr()}`);
        }
    }

    readBinary() {
        this._chkNsonType(Type.BINARY);
        return this._dr.readBinary();
    }

    readBoolean() {
        this._chkNsonType(Type.BOOLEAN);
        return this._dr.readBoolean();
    }

    readDouble() {
        this._chkNsonType(Type.DOUBLE);
        return this._dr.readDouble();
    }

    readInt() {
        this._chkNsonType(Type.INTEGER);
        return this._dr.readInt();
    }

    readLong(asBigInt = false) {
        this._chkNsonType(Type.LONG);
        return this._dr.readLong(asBigInt);
    }

    readString() {
        this._chkNsonType(Type.STRING);
        return this._dr.readString();
    }

    readDate() {
        this._chkNsonType(Type.TIMESTAMP);
        return this._dr.readDate();
    }

    readNumberAsString() {
        this._chkNsonType(Type.NUMBER);
        return this._dr.readString();
    }

    //Skip current value, assumes the type code has already been read.
    skipValue() {
        switch (this._type) {
        case Type.ARRAY:
        case Type.MAP: {
            const top = this._stackTop();
            assert(top);
            this._dr.offset = top.startPos + top.len;
            this._stack.pop();
            break;
        }
        // Timestamp and Number are written as strings.  Both string
        // and binary use length-prefixed encoding.
        case Type.STRING:
        case Type.BINARY:
        case Type.TIMESTAMP:
        case Type.NUMBER: {
            const len = this._dr.readInt();
            if (len > 0) {
                this._skipBytes(len);
            }
            break;
        }
        // fixed 1 byte length
        case Type.BOOLEAN:
            this._skipBytes(1);
            break;
        // fixed 8 byte length
        case Type.DOUBLE:
            this._skipBytes(8);
            break;
        // variable length integer
        case Type.INTEGER:
            this._dr.readInt();
            break;
        // variable length long
        case Type.LONG:
            this._dr.readLong();
            break;
        default:
            throw new NoSQLProtocolError(
                `Trying to skip unknown Nson type code: ${this._type}`);
        }
    }

}

module.exports = NsonReader;
