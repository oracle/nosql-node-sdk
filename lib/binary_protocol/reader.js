/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const PackedInteger = require('./packed_integer');
const ResizableBuffer = require('./buffer');
const NoSQLProtocolError = require('../error').NoSQLProtocolError;
const stringToUTCDate = require('../utils').stringToUTCDate;

class DataReader {
    constructor(buf) {
        this._buf = (buf instanceof ResizableBuffer) ? buf :
            new ResizableBuffer(buf);
        this._off = 0;
    }

    _readByte() {
        return this._buf.readInt8(this._off++);
    }

    _handleEOF(e, ...args) {
        if (e.name == 'RangeError') {
            let msg = 'End of stream reached';
            if (args.length > 0) {
                msg += ` while reading ${args[0]}`;
                if (args.length > 1) {
                    msg += ` of length ${args[1]}`;
                }
            }
            throw new NoSQLProtocolError(msg);
        } else {
            throw e;
        }
    }

    _readBuffer(len) {
        try {
            const ret = this._buf.readBuffer(this._off, len);
            this._off += len;
            return ret;
        } catch(e) {
            this._handleEOF(e, 'binary', len);
        }
    }

    get offset() {
        return this._off;
    }

    set offset(val) {
        assert(val >= 0);
        if (val > this._buf.length) {
            throw new NoSQLProtocolError(`End of stream reached: offset \
${val} is past length ${this._buf.length}`);
        }
        this._off = val;
    }

    /**
     * Reads a packed integer from the buffer and returns it.
     *
     * @return the integer that was read
     * @throws NoSQLError if the input format is invalid or end of input is
     * reached
     */
    readInt() {
        try {
            //We pass ResizableBuffer instead of Buffer so that EOF checking
            //is performed when reading bytes.
            let { value, off } = PackedInteger.readSortedInt(
                this._buf, this._off);
            this._off = off;
            return value;
        } catch(e) {
            this._handleEOF(e, 'packed int');
        }
    }

    /**
     * Reads a packed long from the buffer and returns it.
     *
     * @return the long that was read
     * @throws NoSQLError if the input format is invalid or end of input is
     * reached
     */
    readLong() {
        try {
            let { value, off } = PackedInteger.readSortedLong(
                this._buf, this._off);
            this._off = off;
            return value;
        } catch(e) {
            this._handleEOF(e, 'packed long');
        }
    }

    /**
     * Reads a string written by {@link #writeString}, using standard UTF-8
     *
     * @return a string or null
     * @throws NoSQLError if the input format is invalid or end of input is
     * reached
     */
    readString() {
        const len = this.readInt();
        if (len < -1) {
            throw new NoSQLProtocolError(`Invalid string length: ${len}`);
        }
        if (len == -1) {
            return null;
        }
        if (len == 0) {
            return '';
        }
        try {
            const nextOff = this._off + len;
            const ret = this._buf.slice(this._off, nextOff).toString('utf8');
            this._off = nextOff;
            return ret;
            
        } catch(e) {
            this._handleEOF(e, 'string', len);
        }
    }

    readArray(readItem) {
        const len = this.readInt();
        if (len < -1) {
            throw new NoSQLProtocolError(`Invalid array length: ${len}`);
        }
        if (len == -1) {
            return null;
        }
        const a = new Array(len);
        for(let i = 0; i < len; i++) {
            a[i] = readItem();
        }
        return a;
    }

    readStringArray() {
        return this.readArray(this.readString.bind(this));
    }

    /**
     * Reads a possibly null binary as a {@link #readPackedInt
     * sequence length} followed by the array contents.
     *
     * @return array the array or null
     * @throws NoSQLError if the input format is invalid or end of input is
     * reached
     */
    readBinary() {
        const len = this.readInt();
        if (len < -1) {
            throw new NoSQLProtocolError(`Invalid binary length: ${len}`);
        }
        if (len == -1) {
            return null;
        }
        if (len == 0) {
            return Buffer.allocUnsafe(0);
        }
        return this._readBuffer(len);
    }

    //Equivalent to readByteArrayWithInt() in BinaryProtocol.java
    readBinary2() {
        const len = this.readInt32BE();
        if (len <= 0) {
            return Buffer.allocUnsafe(0);
        }
        return this._readBuffer(len);
    }

    readIntArray() {
        return this.readArray(this.readInt.bind(this));
    }

    readByte() {
        try {
            return this._readByte();
        } catch(e) {
            this._handleEOF(e, 'byte');
        }
    }

    readBoolean() {
        try {
            return Boolean(this._readByte());
        } catch(e) {
            this._handleEOF(e, 'boolean');
        }
    }

    readDouble() {
        try {
            const ret = this._buf.readDoubleBE(this._off);
            this._off += 8;
            return ret;
        } catch(e) {
            this._handleEOF(e, 'double');
        }
    }

    readDate() {
        const s = this.readString();
        if (s === null) {
            return null;
        }
        return stringToUTCDate(s);
    }

    readInt16BE() {
        try {
            const ret = this._buf.readInt16BE(this._off);
            this._off += 2;
            return ret;
        } catch(e) {
            this._handleEOF(e, 'short');
        }
    }

    readInt32BE() {
        try {
            const ret = this._buf.readInt32BE(this._off);
            this._off += 4;
            return ret;
        } catch(e) {
            this._handleEOF(e, 'integer');
        }
    }

    reset() {
        this._off = 0;
        return this;
    }

    toString(encoding = 'utf8') {
        return this._buf.toString(encoding);
    }
}

module.exports = DataReader;
