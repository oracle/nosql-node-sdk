/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const DataWriter = require('../binary_protocol/writer');
const Type = require('../binary_protocol/constants').Type;

class NsonWriter {

    constructor(buf) {
        this._dw = new DataWriter(buf);
        this._stack = [];
    }

    _incrSize() {
        if (this._stack.length) {
            this._stack[this._stack.length - 1].size++;
        }
    }

    _startComplexValue() {
        this._stack.push({ off: this._dw.buffer.length, size: 0});
        this._dw.writeInt32BE(0); //size in bytes
        this._dw.writeInt32BE(0); //number of elements
    }

    _endComplexValue() {
        const elem = this._stack.pop();
        assert(elem);
        //Write byte size and number of elements into the space reserved.
        //Object starts at off + 4.
        this._dw.buffer.writeInt32BE(this._dw.buffer.length - elem.off - 4,
            elem.off);
        this._dw.buffer.writeInt32BE(elem.size, elem.off + 4);
        this._incrSize();
    }

    get dataWriter() {
        return this._dw;
    }

    get buffer() {
        return this._dw.buffer;
    }

    get length() {
        return this._dw.buffer.length;
    }

    reset() {
        this._stack.length = 0;
        this._dw.reset();
        return this;
    }

    writeFieldName(name) {
        this._dw.writeString(name);
    }

    writeBoolean(value) {
        this._dw.writeByte(Type.BOOLEAN);
        this._dw.writeBoolean(value);
        this._incrSize();
    }

    writeBooleanField(name, value) {
        this.writeFieldName(name);
        this.writeBoolean(value);
    }

    writeInt(value) {
        this._dw.writeByte(Type.INTEGER);
        this._dw.writeInt(value);
        this._incrSize();
    }

    writeIntField(name, value) {
        this.writeFieldName(name);
        this.writeInt(value);
    }

    writeLong(value) {
        this._dw.writeByte(Type.LONG);
        this._dw.writeLong(value);
        this._incrSize();
    }

    writeLongField(name, value) {
        this.writeFieldName(name);
        this.writeLong(value);
    }

    writeDouble(value) {
        this._dw.writeByte(Type.DOUBLE);
        this._dw.writeDouble(value);
        this._incrSize();
    }

    writeDoubleField(name, value) {
        this.writeFieldName(name);
        this.writeDouble(value);
    }

    writeString(value) {
        this._dw.writeByte(Type.STRING);
        this._dw.writeString(value);
        this._incrSize();
    }

    writeStringField(name, value) {
        this.writeFieldName(name);
        this.writeString(value);
    }

    writeBinary(value) {
        this._dw.writeByte(Type.BINARY);
        this._dw.writeBinary(value);
        this._incrSize();
    }

    writeBinaryField(name, value) {
        this.writeFieldName(name);
        this.writeBinary(value);
    }

    writeDate(value) {
        this._dw.writeByte(Type.TIMESTAMP);
        this._dw.writeDate(value);
        this._incrSize();
    }

    writeDateField(name, value) {
        this.writeFieldName(name);
        this.writeDate(value);
    }

    //write Nson NUMBER value supplied as string.
    writeStringAsNumber(value) {
        this._dw.writeByte(Type.NUMBER);
        this._dw.writeString(value);
        this._incrSize();
    }

    writeStringAsNumberField(name, value) {
        this.writeFieldName(name);
        this.writeStringAsNumber(value);
    }

    writeJsonNull() {
        this._dw.writeByte(Type.JSON_NULL);
        this._incrSize();
    }

    writeJsonNullField(name) {
        this.writeFieldName(name);
        this.writeJsonNull();
    }

    writeNull() {
        this._dw.writeByte(Type.NULL);
        this._incrSize();
    }

    writeNullField(name) {
        this.writeFieldName(name);
        this.writeNull();
    }

    writeEmpty() {
        this._dw.writeByte(Type.EMPTY);
        this._incrSize();
    }

    writeEmptyField(name) {
        this.writeFieldName(name);
        this.writeEmpty();
    }

    startArray() {
        this._dw.writeByte(Type.ARRAY);
        this._startComplexValue();
    }

    startArrayField(name) {
        this.writeFieldName(name);
        this.startArray();
    }

    endArray() {
        this._endComplexValue();
    }

    endArrayField() {
        this.endArray();
    }

    startMap() {
        this._dw.writeByte(Type.MAP);
        this._startComplexValue();
    }

    startMapField(name) {
        this.writeFieldName(name);
        this.startMap();
    }

    endMap() {
        this._endComplexValue();
    }

    endMapField() {
        this.endMap();
    }

}

module.exports = NsonWriter;
