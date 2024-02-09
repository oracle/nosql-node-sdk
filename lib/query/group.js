/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
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
const MinMaxAggregator = require('./value_aggr').MinMaxAggregator;
const SumAggregator = require('./value_aggr').SumAggregator;
const CountAggregator = require('./value_aggr').CountAggregator;
const CollectAggregator = require('./value_aggr').CollectAggregator;
const PlanIterator = require('./common').PlanIterator;
const SQLFuncCode = require('./common').SQLFuncCode;
const normalizeNumeric = require('./utils').normalizeNumeric;
const resBuf2MapKey = require('./utils').resBuf2MapKey;
const sizeof = require('./utils').sizeof;

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
            _writeSortedMaps: true,
            _replacer: normalizeNumeric
        };
        
        if (this._step.countMem) {
            this._incMem = mem => {
                this._mem += mem;
                this._qpExec.incMem(mem);
            };    
        }
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
            if (this._incMem) {
                this._incMem(sizeof(val));
            }
        }

        //initialize aggregators for aggregate columns
        for(; i < this._step.colNames.length; i++) {
            const colName = this._step.colNames[i];
            const funcCode = this._step.aggrFuncCodes[
                i - this._step.gbColCnt];
            switch(funcCode) {
            case SQLFuncCode.FN_MIN:
            case SQLFuncCode.FN_MAX:
                res[colName] = new MinMaxAggregator(this, this._incMem,
                    funcCode === SQLFuncCode.FN_MIN);
                break;
            case SQLFuncCode.FN_SUM:
                res[colName] = new SumAggregator(this, this._incMem);
                break;
            case SQLFuncCode.FN_COUNT_STAR:
            case SQLFuncCode.FN_COUNT:
            case SQLFuncCode.FN_COUNT_NUMBERS:
                res[colName] = new CountAggregator(this, this._incMem,
                    funcCode);
                break;
            case SQLFuncCode.FN_ARRAY_COLLECT:
            case SQLFuncCode.FN_ARRAY_COLLECT_DISTINCT:
                res[colName] = new CollectAggregator(this, this._incMem,
                    funcCode === SQLFuncCode.FN_ARRAY_COLLECT_DISTINCT,
                    this._qpExec.opt._testMode);
                break;
            default:
                //Validated during deserialization.
                assert(false);
                break;
            }
        }

        return res;
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
            BinaryProtocol.writeFieldValue(this._dw, val,
                this._serializerOpt);
        }
        return resBuf2MapKey(this._dw.buffer);
    }

    _aggregate(groupRow, inputRow) {
        for(let i = this._step.gbColCnt;
            i < this._step.colNames.length; i++) {
            const colName = this._step.colNames[i];
            groupRow[colName].aggregate(inputRow[colName]);
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
                    if (this._incMem) {
                        //The memory for the value will be incremented in
                        //_createGroupRow().
                        this._incMem(sizeof(this, key));
                    }
                    groupRow = this._createGroupRow(inputRow);
                    this._groupMap.set(key, groupRow);
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

        //In the result row, replace value aggregators with their results.
        for(let i = this._step.gbColCnt; i < this._step.colNames.length;
            i++) {
            const colName = this._step.colNames[i];
            val[colName] = val[colName].result;
        }

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
