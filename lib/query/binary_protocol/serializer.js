/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

const assert = require('assert');
const Protocol = require('../../binary_protocol/protocol');
const NoSQLQueryError = require('../../error').NoSQLQueryError;
const DistributionKind = require('../common').DistributionKind;
const SQLFuncCode = require('../common').SQLFuncCode;
const PlanIterator = require('../common').PlanIterator;
const ReceiveIterator = require('../receive');
const SFWIterator = require('../sfw');
const ConstIterator = require('../value').ConstIterator;
const VarRefIterator = require('../value').VarRefIterator;
const ExtVarRefIterator = require('../value').ExtVarRefIterator;
const FieldStepIterator = require('../value').FieldStepIterator;
const FuncMinMaxIterator = require('../func').FuncMinMaxIterator;
const FuncSumIterator = require('../func').FuncSumIterator;
const ArithOpIterator = require('../func').ArithOpIterator;
const SortIterator = require('../sort').SortIterator;

/**
 * NOTE: The kvcode stored with each value in this enum matches the ordinal
 * of the corresponding PlanIterKind in kvstore.
 */
const StepType = {
    RECV: 17,
    SFW: 14,
    SORT: 47,
    CONST: 0,
    VAR_REF: 1,
    EXTERNAL_VAR_REF: 2,
    FIELD_STEP: 11,
    ARITH_OP: 8,
    FN_SUM: 39,
    FN_MIN_MAX: 41
};

class QueryPlanSerializer {

    static _deserializeBase(dr, res) {
        res.resPos = dr.readInt32BE(); //resultReg
        dr.readInt32BE(); //statePos, not used
        res.exprLoc = { //expression location in the query
            startLine: dr.readInt32BE(),
            startColumn: dr.readInt32BE(),
            endLine: dr.readInt32BE(),
            endColumn: dr.readInt32BE()
        };
        for(let p in res.exprLoc) {
            if (res.exprLoc[p] < 0) {
                throw NoSQLQueryError.badProto(`Query plan: received invalid \
value of property ${p} of expression location: ${res.exprLoc[p]}`);
            }
        }
    }

    static _deserializeSortSpecs(dr) {
        const fields = dr.readStringArray();
        const attrs = dr.readArray(() => ({
            isDesc: dr.readBoolean(),
            nullsLowest: dr.readBoolean()
        }));
        const fldCnt = fields ? fields.length : 0;
        const attrCnt = attrs ? attrs.length : 0;
        if (fldCnt !== attrCnt) {
            throw NoSQLQueryError.badProto(`Query plan, received \
non-matching arrays lengths of sort fields: ${fldCnt} and sort attributes: \
${attrCnt}`);
        }
        return attrCnt ? attrs.map((v, i) => Object.assign(v, {
            fieldName: fields[i],
            nullRank: v.nullsLowest ? -1 : 1 //easier to use for comparisons
        })) : null;
    }

    static _deserializeFuncCode(dr) {
        try {
            return SQLFuncCode.fromOrdinal(dr.readInt16BE());
        } catch(err) {
            throw NoSQLQueryError.badProto('Query plan: received invalid \
SQL finction code', null, err);
        }
    }

    static _deserializeSortStep(dr, res) {
        res.displayName = 'SORT';
        res.itCls = SortIterator;
        res.input = this.deserialize(dr);
        res.sortSpecs = this._deserializeSortSpecs(dr);
    }

    static _deserializeSFWStep(dr, res) {
        res.displayName = 'SFW';
        res.itCls = SFWIterator;
        res.colNames = dr.readStringArray();
        res.gbColCnt = dr.readInt32BE();
        res.fromVarName = dr.readString();
        res.isSelectStar = dr.readBoolean();
        res.colSteps = this.deserializeMultiple(dr);
        res.fromStep = this.deserialize(dr);
        res.offsetStep = this.deserialize(dr);
        res.limitStep = this.deserialize(dr);
    }

    static _deserializeReceiveStep(dr, res) {
        res.displayName = 'RECV';
        res.itCls = ReceiveIterator;
        try {
            res.distKind = DistributionKind.fromOrdinal(dr.readInt16BE());
        } catch(err) {
            throw NoSQLQueryError.badProto('Query plan: received invalid \
distribution kind for ReceiveOp', err);
        }
        res.sortSpecs = this._deserializeSortSpecs(dr);
        res.pkFields = dr.readStringArray();
    }

    static _deserializeConstStep(dr, res) {
        res.displayName = 'CONST';
        res.itCls = ConstIterator;
        res.val = Protocol.readFieldValue(dr);
    }

    static _deserializeVarRefStep(dr, res) {
        res.displayName = 'VAR_REF';
        res.itCls = VarRefIterator;
        res.name = dr.readString();
    }

    static _deserializeExtVarRefStep(dr, res) {
        res.displayName = 'EXTERNAL_VAR_REF';
        res.itCls = ExtVarRefIterator;
        res.name = dr.readString();
        res.pos = dr.readInt32BE();
        if (res.pos < 0) {
            throw NoSQLQueryError.badProto(`Query plan: received invalid
position for external variable ${res.name}: ${res.pos}`);
        }
    }

    static _deserializeFieldStep(dr, res) {
        res.displayName = 'FIELD_STEP';
        res.itCls = FieldStepIterator;
        res.input = this.deserialize(dr);
        res.fldName = dr.readString();
    }

    static _deserializeArithStep(dr, res) {
        res.itCls = ArithOpIterator;
        res.funcCode = this._deserializeFuncCode(dr);
        if (res.funcCode !== SQLFuncCode.OP_ADD_SUB &&
            res.funcCode !== SQLFuncCode.OP_MULT_DIV) {
            throw NoSQLQueryError.badProto(`Query plan: received invalid sql \
function code for ArithOpIterator: ${res.funcCode.name}`);
        }
        res.displayName = res.funcCode.name;
        res.args = this.deserializeMultiple(dr);
        res.ops = dr.readString();
        const argCnt = res.args ? res.args.length : 0;
        const opsCnt = res.ops ? res.ops.length : 0;
        if (argCnt !== opsCnt) {
            throw NoSQLQueryError.badProto(`Query plan: received \
non-matching counts of argumetns: ${argCnt} and ops: ${opsCnt} for ArithOp`);
        }
    }

    static _deserializeFuncSumStep(dr, res) {
        res.displayName = 'FN_SUM';
        res.itCls = FuncSumIterator;
        res.input = this.deserialize(dr);
    }

    static _deserializeFuncMinMaxStep(dr, res) {
        res.itCls = FuncMinMaxIterator;
        const code = this._deserializeFuncCode(dr);
        if (code !== SQLFuncCode.FN_MIN && code !== SQLFuncCode.FN_MAX) {
            throw NoSQLQueryError.badProto(`Query plan: received invalid sql \
function code for FuncMinMaxIterator: ${code.name}`);
        }
        res.funcCode = code;
        res.displayName = code.name;
        res.input = this.deserialize(dr);
    }

    static deserialize(dr) {
        const res = {};
        const stepType = dr.readByte();
        if (stepType === -1) {
            return null;
        }
        this._deserializeBase(dr, res);
        switch (stepType) {
        case StepType.SORT:
            this._deserializeSortStep(dr, res);
            break;
        case StepType.SFW:
            this._deserializeSFWStep(dr, res);
            break;
        case StepType.RECV:
            this._deserializeReceiveStep(dr, res);
            break;
        case StepType.CONST:
            this._deserializeConstStep(dr, res);
            break;
        case StepType.VAR_REF:
            this._deserializeVarRefStep(dr, res);
            break;
        case StepType.EXTERNAL_VAR_REF:
            this._deserializeExtVarRefStep(dr, res);
            break;
        case StepType.FIELD_STEP:
            this._deserializeFieldStep(dr, res);
            break;
        case StepType.ARITH_OP:
            this._deserializeArithStep(dr, res);
            break;
        case StepType.FN_SUM:
            this._deserializeFuncSumStep(dr, res);
            break;
        case StepType.FN_MIN_MAX:
            this._deserializeFuncMinMaxStep(dr, res);
            break;
        default:
            throw NoSQLQueryError.badProto(`Query plan: received invalid \
operation type: ${stepType}`);
        }

        assert(res.itCls && res.itCls.prototype instanceof PlanIterator);
        res.itCls.validateStep(res);
        return res;
    }

    static deserializeMultiple(dr) {
        return dr.readArray(() => this.deserialize(dr));
    }

}

module.exports = QueryPlanSerializer;
