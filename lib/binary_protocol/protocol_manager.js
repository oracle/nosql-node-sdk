/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');

const ResizableBuffer = require('./buffer');
const DataReader = require('./reader');
const DataWriter = require('./writer');
const BinaryProtocol = require('./protocol');
const serializers = require('./serializers');

const V3 = 3;
const V2 = 2;

//We wish to handle multiple concurrent requests and at the same time
//reuse the buffers (instead of allocating new buffer for
//each new request).
const _freeBuffers = [];

class ProtocolManager {

    static _serialVersion = V3;

    static get serialVersion() {
        return this._serialVersion;
    }

    static decrementSerialVersion() {
        if (this._serialVersion === V3) {
            this._serialVersion = V2;
            return true;
        }
        return false;
    }

    static get contentType() {
        return 'application/octet-stream';
    }

    static get encoding() {
        return null;
    }

    static getBuffer() {
        if (!_freeBuffers.length) {
            return new ResizableBuffer();
        }
        const buf = _freeBuffers.pop();
        assert(buf._free);
        buf._free = false;
        buf.clear();
        return buf;
    }

    static releaseBuffer(buf) {
        assert(!buf._free);
        buf._free = true;
        _freeBuffers.push(buf);
    }

    static addChunk(buf, chunk) {
        buf.appendBuffer(chunk);
    }

    static getWriter(buf) {
        //Is this too much optimization?
        return !buf._dw ? (buf._dw = new DataWriter(buf)) : buf._dw.reset();
    }

    //Request content in a form suitable to write to stream.
    static getContent(buf) {
        return buf.slice();
    }

    //Content length in bytes.
    static getContentLength(buf) {
        return buf.length;
    }

    static getReader(buf) {
        return !buf._dr ? (buf._dr = new DataReader(buf)) : buf._dr.reset();
    }

    static startWrite() {}

    static startRead(reader, req) {
        const sc = reader.readByte();
        if (sc !== 0) {
            throw BinaryProtocol.mapError(sc, reader.readString(), req);
        }
    }

    static serializer(op) {
        return this._serializers[op];
    }

}

//Serializers

ProtocolManager._serializers = {
    GetOp: serializers.GetSerializer,
    PutOp: serializers.PutSerializer,
    DeleteOp: serializers.DeleteSerializer,
    MultiDeleteOp: serializers.MultiDeleteSerializer,
    WriteMultipleOp: serializers.WriteMultipleSerializer,
    TableDDLOp: serializers.TableRequestSerializer,
    TableLimitsOp: serializers.TableRequestSerializer,
    GetTableOp: serializers.GetTableSerializer,
    TableUsageOp: serializers.TableUsageSerializer,
    GetIndexesOp: serializers.GetIndexesSerializer,
    ListTablesOp: serializers.ListTablesSerializer,
    PrepareOp: serializers.PrepareSerializer,
    QueryOp: serializers.QuerySerializer,
    AdminDDLOp: serializers.SystemRequestSerializer,
    AdminStatusOp: serializers.SystemStatusSerializer
};

module.exports = ProtocolManager;
