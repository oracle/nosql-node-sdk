/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const OpCode = require('../binary_protocol/constants').OpCode;
const Protocol = require('./protocol');
const Fields = require('./constants').Fields;

class SystemRequestSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.SYSTEM_REQUEST, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);

        if (Buffer.isBuffer(req.stmt)) {
            nw.writeBinaryField(Fields.STATEMENT, req.stmt);
        } else {
            const stmtBuf = Buffer.from(req.stmt);
            try {
                nw.writeBinaryField(Fields.STATEMENT, stmtBuf);
            } finally {
                stmtBuf.fill(0);
            }
        }

        nw.endMapField();
        nw.endMap();
    }

    static deserialize(dr, req) {
        return this.deserializeSystemResult(dr, req);
    }

}

class SystemStatusSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.SYSTEM_STATUS_REQUEST, serialVersion,
            req);
        nw.startMapField(Fields.PAYLOAD);
        nw.writeStringField(Fields.OPERATION_ID, req.adminResult.operationId);
        nw.writeStringField(Fields.STATEMENT, req.adminResult.statement);
        nw.endMapField();
        nw.endMap();
    }

    static deserialize(dr, req) {
        return this.deserializeSystemResult(dr, req);
    }

}

module.exports = {
    SystemRequestSerializer,
    SystemStatusSerializer
};
