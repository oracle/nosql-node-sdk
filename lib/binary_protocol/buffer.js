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

/**
 * Utility classes to facilitate serialization/deserialization
 *
 * The numeric methods use packed_integer module which uses a format
 * that is always sorted.
 */

class ResizableBuffer {
    constructor(arg) {
        switch(typeof arg) {
        case 'undefined':
            this._buf = Buffer.allocUnsafe(1024);
            break;
        case 'number':
            this._buf = Buffer.allocUnsafe(arg);
            break;
        case 'object':
            if (arg instanceof Buffer) {
                this._buf = arg;
                break;
            }
        default:
            assert(false);
        }
        this._len = 0;
    }

    _checkBound(off) {
        assert(off >= 0);
        if (off >= this._len) {
            throw new RangeError(
                `Index ${off} out of bounds for length ${this._len}`);
        }
    }

    _checkBounds(start, end) {
        assert(start >= 0  && end >= 0 && start <= end);
        if (end > this._len) {
            throw new RangeError(
                `[${start}, ${end}] out of bounds for length ${this._len}`);
        }
    }

    _ensureCapacity(cap) {
        if (this._buf.length < cap) {
            const newCap = Math.max(this._buf.length * 2, cap);
            const b = Buffer.allocUnsafe(newCap);
            this._buf.copy(b, 0, 0, this._len);
            this._buf = b;
        }
    }

    get buffer() {
        return this._buf;
    }

    get length() {
        return this._len;
    }

    set length(value) {
        this._ensureCapacity(value);
        this._len = value;
    }

    clear() {
        this._len = 0;
        return this;
    }

    readUInt8(off) {
        this._checkBound(off);
        return this._buf.readUInt8(off);
    }

    readInt8(off) {
        this._checkBound(off);
        return this._buf.readInt8(off);
    }

    writeUInt8(value, off) {
        const newCap = off + 1;
        this._ensureCapacity(newCap);
        this._buf.writeUInt8(value, off);
        if (this._len < newCap) {
            this._len = newCap;
        }
    }

    writeInt16BE(value, off) {
        const newCap = off + 2;
        this._ensureCapacity(newCap);
        this._buf.writeInt16BE(value, off);
        if (this._len < newCap) {
            this._len = newCap;
        }
    }

    readInt16BE(off) {
        this._checkBounds(off, off + 2);
        return this._buf.readInt16BE(off);
    }

    readInt32BE(off) {
        this._checkBounds(off, off + 4);
        return this._buf.readInt32BE(off);
    }

    writeInt32BE(value, off) {
        const newCap = off + 4;
        this._ensureCapacity(newCap);
        this._buf.writeInt32BE(value, off);
        if (this._len < newCap) {
            this._len = newCap;
        }
    }

    readDoubleBE(off) {
        this._checkBounds(off, off + 8);
        return this._buf.readDoubleBE(off);
    }

    slice(start = 0, end = start + this._len) {
        this._checkBounds(start, end);
        return this._buf.slice(start, end);
    }

    readBuffer(off, len) {
        this._checkBounds(off, off + len);
        const b = Buffer.allocUnsafe(len);
        this._buf.copy(b, 0, off, off + len);
        return b;
    }

    writeBuffer(buf, off) {
        const newCap = off + buf.length;
        this._ensureCapacity(newCap);
        buf.copy(this._buf, off, 0, buf.length);
        if (this._len < newCap) {
            this._len = newCap;
        }
    }

    appendBuffer(value) {
        this.writeBuffer(value, this._len);
    }

    ensureExtraCapacity(extra) {
        this._ensureCapacity(this._len + extra);
    }
}

module.exports = ResizableBuffer;
