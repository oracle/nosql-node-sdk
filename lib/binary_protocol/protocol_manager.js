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

const ResizableBuffer = require('./buffer');
const DataReader = require('./reader');
const DataWriter = require('./writer');
const BinaryProtocol = require('./protocol');
const serializers = require('./serializers');

//We wish to handle multiple concurrent requests and at the same time
//reuse the buffers (instead of allocating new buffer for
//each new request).
const _freeBuffers = [];

class ProtocolManager {

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

    static getDataWriter(buf) {
        //Is this too much optimization?
        return !buf._dw ? (buf._dw = new DataWriter(buf)) : buf._dw.reset();
    }

    static getData(dw) {
        return dw.buffer.slice();
    }

    static getByteLength(data) {
        return data.length;
    }

    static getDataReader(buf) {
        return !buf._dr ? (buf._dr = new DataReader(buf)) : buf._dr.reset();
    }

    static getResponseCode(dr) {
        return dr.readByte();
    }

    static responseSuccessful(rc) {
        return rc === 0;
    }

    static createError(rc, dr) {
        return BinaryProtocol.mapError(rc, dr.readString());
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
