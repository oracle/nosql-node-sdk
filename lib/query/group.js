/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const assert = require('assert');
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;
const BinaryProtocol = require('../binary_protocol/protocol');
const DataWriter = require('../binary_protocol/writer');
const PlanIterator = require('./common').PlanIterator;
const SQLFuncCode = require('./common').SQLFuncCode;
const compareNonNullAtomics = require('./compare').compareNonNullAtomics;
const add = require('./func').add;
const isNumeric = require('./utils').isNumeric;
const resBuf2MapKey = require('./utils').resBuf2MapKey;
const sizeof = require('./utils').sizeof;

function _supportsComp(ctx, val) {
    return isNumeric(ctx, val) || typeof val === 'boolean' ||
        typeof val === 'string' || val instanceof Date;
}

//Regarding _writeSortedMaps: for grouping columns of type MAP, RECORD or
//JSON, received from the server as js objects, we do not consider the order
//of their properties, so that 2 js objects that differ only in the order of
//their properties are considered equal and thus should generate identical
//group keys.  To achieve this, we serialize these objects in sorted order
//of their property names when creating a group key.

class GroupIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
        this._inputIter = qpExec.makeIterator(step.input);
        this._dw = new DataWriter();
        this._groupMap = new Map();
        if (step.countMem) {
            this._mem = 0;
        }
        this._serializerOpt = {
            _dbNumber: qpExec.opt._dbNumber,
            _writeSortedMaps: true
        };
    }

    _incMem(mem) {
        this._mem += mem;
        this._qpExec.incMem(mem);
    }

    _decMem(mem) {
        this._mem -= mem;
        this._qpExec.decMem(mem);
    }

    _updMem(oldVal, newVal) {
        //common case
        if (typeof oldVal === 'number' && typeof newVal === 'number') {
            return;
        }
        this._incMem(sizeof(this, newVal) - sizeof(this, oldVal));
    }

    _createGroupRow(row) {
        const res = {};
        let i;

        //initialize grouping columns
        for(i = 0; i < this._step.gbColCnt; i++) {
            const colName = this._step.colNames[i];
            const val = row[colName];
            //EMPTY_VALUE is only possible here for the distinct case,
            //otherwise this row will be skipped in next()
            res[colName] = val !== EMPTY_VALUE ? val : undefined;
        }

        //initialize aggregate columns
        for(; i < this._step.colNames.length; i++) {
            const colName = this._step.colNames[i];
            const funcCode = this._step.aggrFuncCodes[
                i - this._step.gbColCnt];
            res[colName] =
                funcCode === SQLFuncCode.FN_COUNT_STAR ||
                funcCode === SQLFuncCode.FN_COUNT ||
                funcCode === SQLFuncCode.FN_COUNT_NUMBERS ?
                    0 : undefined;
        }

        return res;
    }

    _isNewMinMax(funcCode, oldVal, newVal) {
        if (!_supportsComp(this, newVal)) {
            return false;
        }
        if (oldVal == null) {
            return true;
        }
        const compRes = compareNonNullAtomics(this, newVal, oldVal);
        return funcCode === SQLFuncCode.FN_MAX ?
            compRes > 0 : compRes < 0;
    }

    _makeGroupKey(row) {
        this._dw.reset();
        for(let i = 0; i < this._step.gbColCnt; i++) {
            let val = row[this._step.colNames[i]];
            if (val === EMPTY_VALUE) {

                if (!this._step.isDistinct) {
                    return;
                }
                val = undefined;
            }
            if (this._serializerOpt._dbNumber != null &&
                this._serializerOpt._dbNumber.isInstance(val)) {
                //Make sure equal numeric values whether represented as
                //dbNumber instance or JavaScript number results in the same
                //group key (some queries may have mixed types of numeric
                //grouping values).  This the case when dbNumber instance
                //can be losslessly converted to JavaScript number.
                const numVal = this._serializerOpt._dbNumber.numberValue(val);
                if (this._serializerOpt._dbNumber.valuesEqual(val, numVal)) {
                    val = numVal;
                }
            }
            BinaryProtocol.writeFieldValue(this._dw, val,
                this._serializerOpt);
        }
        return resBuf2MapKey(this._dw.buffer);
    }

    _aggregateCol(groupRow, colName, funcCode, val) {
        const oldVal = groupRow[colName];
        let newVal;
        switch(funcCode) {
        case SQLFuncCode.FN_MIN:
        case SQLFuncCode.FN_MAX:
            if (this._isNewMinMax(funcCode, oldVal, val)) {
                newVal = val;
            }
            break;
        case SQLFuncCode.FN_SUM:
            if (!isNumeric(this, val)) {
                break;
            }
            newVal = oldVal != null ? add(this, oldVal, val) : val;
            break;
        case SQLFuncCode.FN_COUNT_STAR:
            newVal = add(this, oldVal, 1);
            break;
        case SQLFuncCode.FN_COUNT:
            if (val != null && val != EMPTY_VALUE) {
                newVal = add(this, oldVal, 1);
            }
            break;
        case SQLFuncCode.FN_COUNT_NUMBERS:
            if (isNumeric(this, val)) {
                newVal = add(this, oldVal, 1);
            }
            break;
        default:
            assert(false);
            break;
        }
        if (newVal !== undefined) {
            groupRow[colName] = newVal;
            if (this._step.countMem) {
                this._updMem(oldVal, newVal);
            }
        }
    }

    _aggregate(groupRow, inputRow) {
        for(let i = this._step.gbColCnt;
            i < this._step.colNames.length; i++) {
            const colName = this._step.colNames[i];
            const val = inputRow[colName];
            const funcCode =
                this._step.aggrFuncCodes[i - this._step.gbColCnt];
            this._aggregateCol(groupRow, colName, funcCode, val);
        }
    }

    async next() {
        if (this._resIter == null) {
            while(await this._inputIter.next()) {
                const inputRow = this._inputIter.result;
                const key = this._makeGroupKey(inputRow);
                if (key == null) {
                    continue;
                }
                let groupRow = this._groupMap.get(key);
                if (groupRow == null) {
                    groupRow = this._createGroupRow(inputRow);
                    this._groupMap.set(key, groupRow);
                    if (this._step.countMem) {
                        this._incMem(sizeof(this, key) +
                            sizeof(this, groupRow));
                    }
                    if (this._step.isDistinct) {
                        this.result = groupRow;
                        return true;
                    }
                }
                this._aggregate(groupRow, inputRow);
            }
            if (this._qpExec._needUserCont || this._step.isDistinct) {
                return false;
            }
            this._resIter = this._groupMap.entries();
        }

        const res = this._resIter.next();
        if (res.done) {
            return false;
        }

        const key = res.value[0];
        const val = res.value[1];
        this.result = val;
        if (this._step.removeRes) {
            this._groupMap.delete(key);
        }

        return true;
    }

    reset() {
        this._groupMap.clear();
        if (this._step.countMem) {
            this._qpExec.decMem(this._mem);
            this._mem = 0;
        }
        this._resIter = null;
    }

}

GroupIterator._isAsync = true;

module.exports = GroupIterator;
