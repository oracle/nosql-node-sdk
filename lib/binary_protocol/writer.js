/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const PackedInteger = require('./packed_integer');
const ResizableBuffer = require('./buffer');

/**
 * Utility classes to facilitate serialization/deserialization
 *
 * The numeric methods use packed_integer module which uses a format
 * that is always sorted.
 */

class DataWriter {
    constructor(buf) {
        this._buf = (buf instanceof ResizableBuffer) ? buf :
            new ResizableBuffer(buf);
    }

    get buffer() {
        return this._buf;
    }

    writeByte(value) {
        this._buf.writeUInt8(value, this._buf.length);
    }

    /**
     * Writes a packed integer to the buffer
     *
     * @param value the integer to be written
     */
    writeInt(value) {
        this._buf.ensureExtraCapacity(PackedInteger.MAX_LENGTH);
        this._buf.length = PackedInteger.writeSortedInt(this._buf.buffer,
            this._buf.length, value);
    }

    /**
     * Writes a packed long to the buffer
     *
     * @param value the long to be written
     */
    writeLong(value) {
        this._buf.ensureExtraCapacity(PackedInteger.MAX_LONG_LENGTH);
        this._buf.length = PackedInteger.writeSortedLong(this._buf.buffer,
            this._buf.length, value);
    }

    /**
     * Writes a string for reading by {@link #readString}, using standard UTF-8
     * format. The string may be null or empty.  This code differentiates
     * between the two, maintaining the ability to round-trip null and empty
     * string values.
     *
     * The format is the standard UTF-8 format documented by <a
     * href="http://www.ietf.org/rfc/rfc2279.txt">RFC 2279</a>.
     *
     * <p>Format:
     * <ol>
     * <li> ({@link #writePackedInt packed int}) <i>string length, or -1
     * for null</i>
     * <li> <i>[Optional]</i> ({@code byte[]}) <i>UTF-8 bytes</i>
     * </ol>
     *
     * @param value the string or null
     */
    writeString(value) {
        if (value == null) { //null or undefined
            return this.writeInt(-1);
        }
        assert(typeof value === 'string');
        const b = Buffer.from(value, 'utf8');
        this.writeInt(b.length);
        if (b.length > 0) {
            this._buf.appendBuffer(b);
        }
    }

    /**
     * Writes a possibly null binary as a {@link #writePackedInt
     * sequence length} followed by the array contents.
     *
     * @param array the byte array or null
     */
    writeBinary(value) {
        const len = (value == null) ? -1 : value.length;
        this.writeInt(len);
        if (len > 0) {
            this._buf.appendBuffer(value);
        }
    }

    //Equivalent to writeByteArrayWithInt() in BinaryProtocol.java
    writeBinary2(value) {
        const len = value ? value.length : 0;
        this.writeInt32BE(len);
        if (len > 0) {
            this._buf.appendBuffer(value);
        }
    }

    writeBoolean(value) {
        this.writeByte(value ? 1 : 0);
    }

    writeDouble(value) {
        this._buf.ensureExtraCapacity(8);
        this._buf.length = this._buf.buffer.writeDoubleBE(value,
            this._buf.length);
    }

    writeDate(value) {
        assert(value instanceof Date);
        let s = value.toISOString();
        if (s.endsWith('Z')) {
            s = s.slice(0, s.length - 1);
        }
        this.writeString(s);
    }

    writeInt16BE(value) {
        this._buf.writeInt16BE(value, this._buf.length);
    }

    writeInt32BE(value) {
        this._buf.writeInt32BE(value, this._buf.length);
    }

    reset() {
        this._buf.length = 0;
        return this;    
    }
}

module.exports = DataWriter;
