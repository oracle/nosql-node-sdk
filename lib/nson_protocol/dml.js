/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const OpCode = require('../binary_protocol/constants').OpCode;
const Protocol = require('./protocol');
const ErrorCode = require('../error_code');
const NoSQLError = require('../error').NoSQLError;
const PutOp = require('../ops').PutOp;
const Op = require('../ops').Op;
const Fields = require('./constants').Fields;

class GetSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.GET, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        this.writeConsistency(nw, req.opt.consistency);
        this.writeKey(nw, req.key, req.opt);
        nw.endMapField();
        nw.endMap();
    }

    static deserialize(nr, req) {
        return this.deserializeResponse(nr, req, (field, res) => {
            if (field !== Fields.ROW) {
                return false;
            }

            this.readMap(nr, field => {
                switch (field) {
                case Fields.VALUE:
                    res.row = this.readRow(nr, req.opt);
                    return true;
                case Fields.ROW_VERSION:
                    res.version = this.readRowVersion(nr);
                    return true;
                case Fields.EXPIRATION:
                    res.expirationTime = this.readDateAsLong(nr);
                    return true;
                case Fields.MODIFIED:
                    res.modificationTime = this.readDateAsLong(nr);
                    return true;
                default:
                    return false;
                }
            });

            return true;
        }, { row: null }); //value if row doesn't exist
    }

}

class PutSerializer extends Protocol {

    static _opcode(opt) {
        if (opt.ifAbsent) {
            return OpCode.PUT_IF_ABSENT;
        }
        if (opt.ifPresent) {
            return OpCode.PUT_IF_PRESENT;
        }
        if (opt.matchVersion) {
            return OpCode.PUT_IF_VERSION;
        }
        return OpCode.PUT;
    }

    static _serializePutOp(nw, op) {
        this.checkWriteBooleanField(nw, Fields.EXACT_MATCH,
            op.opt.exactMatch);
        this.checkWriteBooleanField(nw, Fields.UPDATE_TTL,
            PutOp.needUpdateTTL(op));

        if (op.opt.ttl != null) {
            nw.writeStringField(Fields.TTL, this.ttlToString(op.opt.ttl));
        }

        this.checkWriteIntField(nw, Fields.IDENTITY_CACHE_SIZE,
            op.opt.identityCacheSize);

        if (op.opt.matchVersion != null) {
            this.writeRowVersion(nw, op.opt.matchVersion);
        }

        this.writeValue(nw, op.row, op.opt);
    }

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, this._opcode(req.opt), serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        this.serializeWriteRequest(nw, req);
        this._serializePutOp(nw, req);
        nw.endMapField();
        nw.endMap();
    }

    static deserialize(nr, req) {
        return this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.ROW_VERSION:
                res.version = this.readRowVersion(nr);
                res.success = true;
                return true;
            case Fields.RETURN_INFO:
                this.deserializeReturnInfo(nr, res, req.opt);
                return true;
            case Fields.GENERATED:
                res.generatedValue = this.readFieldValue(nr, req.opt);
                return true;
            default:
                return false;
            }
        }, { success: false });
    }
}

class DeleteSerializer extends Protocol {

    static _opcode(opt) {
        return opt.matchVersion ? OpCode.DELETE_IF_VERSION :
            OpCode.DELETE;
    }

    static _serializeDeleteOp(nw, op) {
        if (op.opt.matchVersion != null) {
            this.writeRowVersion(nw, op.opt.matchVersion);
        }
        this.writeKey(nw, op.key, op.opt);
    }

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, this._opcode(req.opt), serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        this.serializeWriteRequest(nw, req);
        this._serializeDeleteOp(nw, req);
        nw.endMapField();
        nw.endMap();
    }

    static deserialize(nr, req) {
        return this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.SUCCESS:
                res.success = nr.readBoolean();
                return true;
            case Fields.RETURN_INFO:
                this.deserializeReturnInfo(nr, res, req.opt);
                return true;
            default:
                return false;
            }
        }, { success: false });
    }

}

class MultiDeleteSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        this.writeHeader(nw, OpCode.MULTI_DELETE, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        this.writeDurability(nw, req.opt.durability);
        this.checkWriteIntField(nw, Fields.MAX_WRITE_KB, req.opt.maxWriteKB);

        if (req.opt.continuationKey != null) {
            nw.writeBinaryField(Fields.CONTINUATION_KEY,
                req.opt.continuationKey);
        }

        if (req.opt.fieldRange != null) {
            this.writeFieldRange(nw, req.opt.fieldRange, req.opt);
        }

        this.writeKey(nw, req.key, req.opt);
        nw.endMapField();
        nw.endMap();
    }

    static deserialize(nr, req) {
        return this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.NUM_DELETIONS:
                res.deletedCount = nr.readInt();
                return true;
            case Fields.CONTINUATION_KEY:
                res.continuationKey = nr.readBinary();
                return true;
            default:
                return false;
            }
        });
    }

}

class WriteMultipleSerializer extends Protocol {

    static serialize(nw, req, serialVersion) {
        nw.startMap();
        //req.tableName is set for single-table requests but not for
        //multi-table requests.
        this.writeHeader(nw, OpCode.WRITE_MULTIPLE, serialVersion, req);
        nw.startMapField(Fields.PAYLOAD);
        this.writeDurability(nw, req.opt.durability);
        nw.writeIntField(Fields.NUM_OPERATIONS, req.ops.length);
        
        nw.startArrayField(Fields.OPERATIONS);
        let i = 0;

        for(const op of req.ops) {
            const start = nw.length;
            nw.startMap();
            this.checkWriteStringField(nw, Fields.TABLE_NAME, op.tableName);

            if (op.put) {
                nw.writeIntField(Fields.OP_CODE, PutSerializer._opcode(
                    op.opt));
                PutSerializer._serializePutOp(nw, op);
            } else {
                assert(op.delete);
                nw.writeIntField(Fields.OP_CODE, DeleteSerializer._opcode(
                    op.opt));
                DeleteSerializer._serializeDeleteOp(nw, op);
            }

            this.checkWriteBooleanField(nw, Fields.RETURN_ROW,
                op.opt.returnExisting);
            this.checkWriteBooleanField(nw, Fields.ABORT_ON_FAIL,
                op.opt.abortOnFail);
            nw.endMap();

            const opLen = nw.length - start;
            if (opLen > Op.REQUEST_SIZE_LIMIT) {
                throw new NoSQLError(ErrorCode.REQUEST_SIZE_LIMIT_EXCEEDED,
                    `Operation size ${opLen} exceeds the limit of \
${this.REQUEST_SIZE_LIMIT} for ${op.put ? 'put' : 'delete'} operation at \
index ${i}`, null, req);
            }

            i++;
        }

        nw.endArrayField();
        nw.endMapField();
        nw.endMap();
    }

    static _readOpResult(nr, opt) {
        const res = {};
        Protocol.readMap(nr, field => {
            switch (field) {
            case Fields.SUCCESS:
                res.success = nr.readBoolean();
                return true;
            case Fields.ROW_VERSION:
                res.version = Protocol.readRowVersion(nr);
                return true;
            case Fields.GENERATED:
                res.generatedValue = Protocol.readFieldValue(nr, opt);
                return true;
            case Fields.RETURN_INFO:
                Protocol.deserializeReturnInfo(nr, res, opt);
                return true;
            default:
                return false;
            }
        });

        return res;
    }

    static deserialize(nr, req) {
        return this.deserializeResponse(nr, req, (field, res) => {
            switch (field) {
            case Fields.WM_SUCCESS:
                res.results = this.readArray(nr, this._readOpResult, req.opt);
                return true;
            case Fields.WM_FAILURE:
                this.readMap(nr, field => {
                    switch (field) {
                    case Fields.WM_FAIL_INDEX:
                        res.failedOpIndex = nr.readInt();
                        return true;
                    case Fields.WM_FAIL_RESULT:
                        res.failedOpResult = this._readOpResult(nr, req);
                        return true;
                    default:
                        return false;
                    }
                });
                return true;
            default:
                return false;
            }
        });
    }

}

module.exports = {
    GetSerializer,
    PutSerializer,
    DeleteSerializer,
    MultiDeleteSerializer,
    WriteMultipleSerializer
};
