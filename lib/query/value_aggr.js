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
const util = require('util');
const SQLFuncCode = require('./common').SQLFuncCode;
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;
const isNumeric = require('./utils').isNumeric;
const sizeof = require('./utils').sizeof;
const normalizeNumeric = require('./utils').normalizeNumeric;
const resBuf2MapKey = require('./utils').resBuf2MapKey;
const add = require('./arith').add;
const compareNonNullAtomics = require('./compare').compareNonNullAtomics;
const compareFieldValuesTotalOrder =
    require('./compare').compareFieldValuesTotalOrder;
const BinaryProtocol = require('../binary_protocol/protocol');
const DataWriter = require('../binary_protocol/writer');

const MEM_OVERHEAD = '_ctx'.length + '_incMem'.length + '_aggrVal'.length;

class ValueAggregator {

    constructor(ctx, incMem) {
        this._ctx = ctx;
        this._incMem = incMem;
        this._aggrVal = this.constructor._initialValue();
        if (this._incMem) {
            this._incMem(MEM_OVERHEAD + sizeof(this._aggrVal));
        }
    }

    static _initialValue() {
        return undefined;
    }

    aggregate() {
        throw new Error(
            'Cannot call abstract method "aggregate" in class \
"ValueAggregator"');
    }

    get result() {
        return this._aggrVal;
    }

    reset() {
        this._aggrVal = this.constructor._initialValue();
    }
}

class SingleValueAggregator extends ValueAggregator {

    constructor(ctx, incMem) {
        super(ctx, incMem);
    }

    _aggregate() {
        throw new Error(
            'Cannot call abstract method "_aggregate" in class \
"SingleValueAggregator"');
    }

    aggregate(val) {
        const oldVal = this._aggrVal;
        this._aggregate(val);

        if (!this._incMem || oldVal === this._aggrVal ||
            //common case
            (typeof oldVal === 'number' && typeof newVal === 'number')) {
            return;
        }

        this._incMem(sizeof(this._ctx, this._aggrVal) -
            sizeof(this._ctx, oldVal));
    }
}

class MinMaxAggregator extends SingleValueAggregator {

    constructor(ctx, incMem, isMin) {
        super(ctx, incMem);
        this._isMin = isMin;
    }

    _supportsComp(val) {
        return isNumeric(this._ctx, val) || typeof val === 'boolean' ||
            typeof val === 'string' || val instanceof Date;
    }
    
    _isNewMinMax(val) {
        if (!this._supportsComp(val)) {
            return false;
        }
        if (this._aggrVal == undefined) {
            return true;
        }
        const compRes = compareNonNullAtomics(this, val, this._aggrVal);
        return this._isMin ? compRes < 0 : compRes > 0;
    }

    _aggregate(val) {
        if (this._isNewMinMax(val)) {
            this._aggrVal = val;
        }
    }

}

class SumAggregator extends SingleValueAggregator {
    constructor(ctx, incMem) {
        super(ctx, incMem);
    }

    _aggregate(val) {
        if (!isNumeric(this._ctx, val)) {
            return;
        }
        this._aggrVal = this._aggrVal != undefined ?
            add(this._ctx, this._aggrVal, val) : val;
    }
}

class CountAggregator extends SingleValueAggregator {
    constructor(ctx, incMem, funcCode) {
        super(ctx, incMem);
        this._funcCode = funcCode;
    }

    static _initialValue() {
        return 0;
    }

    _aggregate(val) {
        switch(this._funcCode) {
        case SQLFuncCode.FN_COUNT_STAR:
            break;
        case SQLFuncCode.FN_COUNT:
            if (val == undefined || val == EMPTY_VALUE) {
                return;
            }
            break;
        case SQLFuncCode.FN_COUNT_NUMBERS:
            if (!isNumeric(this._ctx, val)) {
                return;
            }
            break;
        default:
            assert(false);
            break;
        }

        this._aggrVal = add(this, this._aggrVal, 1);
    }
}

class CollectAggregator extends ValueAggregator {
    constructor(ctx, incMem, isDistinct, toSortResults) {
        super(ctx, incMem);
        if (isDistinct) {
            this._dup = new Set();
            this._dw = new DataWriter();
        }
        //Order of values in the result of array_collect is not defined. We
        //only sort in test mode to match actual with expected results.
        this._toSortResults = toSortResults;
    }

    static _initialValue() {
        return [];
    }

    _makeKey(val) {
        this._dw.reset();
        BinaryProtocol.writeFieldValue(this._dw, val, {
            _dbNumber: this._ctx._dbNumber,
            _writeSortedMaps: true,
            _replacer: normalizeNumeric
        });
        return resBuf2MapKey(this._dw.buffer);
    }

    get result() {
        return this._toSortResults ?
            super.result.sort((val1, val2) =>
                compareFieldValuesTotalOrder(this._ctx, val1, val2)) :
            super.result;
    }

    aggregate(val) {
        if (val == undefined || val == EMPTY_VALUE) {
            return;
        }
        
        if (!Array.isArray(val)) {
            throw this._ctx.illegalState(
                `Input value in collect step is not an array: \
${util.inspect(val)}`);
        }

        for(const elem of val) {
            if (this._dup) {
                const key = this._makeKey(elem);
                if (this._dup.has(key)) {
                    continue;
                }
                this._dup.add(key);
                if (this._incMem) {
                    this._incMem(sizeof(key));
                }
            }
            this._aggrVal.push(elem);
            if (this._incMem) {
                this._incMem(sizeof(elem));
            }
        }
    }

    reset() {
        super.reset();
        if (this._dup) {
            this._dup.clear();
            this._dw.reset();
        }
    }
}

module.exports = {
    ValueAggregator,
    MinMaxAggregator,
    SumAggregator,
    CountAggregator,
    CollectAggregator
};
