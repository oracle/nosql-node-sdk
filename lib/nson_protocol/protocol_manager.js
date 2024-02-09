/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const BinaryProtocolManager = require('../binary_protocol/protocol_manager');
const NsonWriter = require('./writer');
const NsonReader = require('./reader');
const ErrorCode = require('../error_code');
const NoSQLUnsupportedProtocolError = require('../error')
    .NoSQLUnsupportedProtocolError;
const TableSerializers = require('./table');
const DMLSerializers = require('./dml');
const QuerySerializers = require('./query');
const AdminSerializers = require('./admin');

const V4 = 4;

class ProtocolManager extends BinaryProtocolManager {

    static get serialVersion() {
        return V4;
    }

    static decrementSerialVersion() {
        return false;
    }

    static getWriter(buf) {
        //Is this too much optimization?
        return !buf._nw ? (buf._nw = new NsonWriter(buf)) : buf._nw.reset();
    }

    static getReader(buf) {
        return !buf._nr ? (buf._nr = new NsonReader(buf)) : buf._nr.reset();
    }

    //Nson request always starts with serial version.
    static startWrite(writer) {
        writer.dataWriter.writeInt16BE(this.serialVersion);
    }

    //In Nson, the error information is part of the top-level Nson map.
    static startRead(reader, req) {
        const dr = reader.dataReader;
        var code = dr.readByte();

        //If the client is connected to a pre-V4 server, the following
        //error codes can be returned by the pre-V4 servers:
        //V3: UNSUPPORTED_PROTOCOL (24)
        //V2: BAD_PROTOCOL_MESSAGE (17)
        //Neither of these currently maps to any valid Nson type, so we
        //know the server is not speaking V4 protocol. We can throw
        //NoSQLUnsupportedProtocolError so that the protocol serial
        //version will be decremented accordingly.
        if (code === ErrorCode.UNSUPPORTED_PROTOCOL.ordinal ||
            code === ErrorCode.BAD_PROTOCOL_MESSAGE.ordinal) {
            throw new NoSQLUnsupportedProtocolError(
                `Unsupported protocol version ${this.serialVersion}`, null,
                req);
        }

        dr.offset = 0;
    }

}

//Serializers

ProtocolManager._serializers = {
    GetOp: DMLSerializers.GetSerializer,
    PutOp: DMLSerializers.PutSerializer,
    DeleteOp: DMLSerializers.DeleteSerializer,
    MultiDeleteOp: DMLSerializers.MultiDeleteSerializer,
    WriteMultipleOp: DMLSerializers.WriteMultipleSerializer,
    TableDDLOp: TableSerializers.TableRequestSerializer,
    TableLimitsOp: TableSerializers.TableRequestSerializer,
    TableTagsOp: TableSerializers.TableRequestSerializer,
    AddReplicaOp: TableSerializers.ReplicaOpSerializer,
    DropReplicaOp: TableSerializers.ReplicaOpSerializer,
    GetTableOp: TableSerializers.GetTableSerializer,
    TableUsageOp: TableSerializers.TableUsageSerializer,
    ReplicaStatsOp: TableSerializers.ReplicaStatsSerializer,
    GetIndexesOp: TableSerializers.GetIndexesSerializer,
    ListTablesOp: TableSerializers.ListTablesSerializer,
    PrepareOp: QuerySerializers.PrepareSerializer,
    QueryOp: QuerySerializers.QuerySerializer,
    AdminDDLOp: AdminSerializers.SystemRequestSerializer,
    AdminStatusOp: AdminSerializers.SystemStatusSerializer,
};

module.exports = ProtocolManager;
