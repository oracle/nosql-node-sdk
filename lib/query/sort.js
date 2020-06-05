/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const util = require('util');
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;
const NoSQLQueryError = require('../error').NoSQLQueryError;
const PlanIterator = require('./common').PlanIterator;
const sizeof = require('./utils').sizeof;

function _compVal(val1, val2) {
    if (typeof val1 === 'number') {
        //NaN is equal to itself and is greater than everything else
        if (isNaN(val1)) {
            return isNaN(val2) ? 0 : 1;
        }
        if (isNaN(val2)) {
            return -1;
        }
    }
    return val1 > val2 ? 1 : (val1 == val2 ? 0 : -1);
}

function _supportsComp(val) {
    return typeof val in [ 'boolean', 'number', 'string' ] ||
        val instanceof Date;
}

function _unsupportedComp(ctx, val) {
    return ctx.illegalState(`Value of unsupported type for comparison: \
${util.inspect(val)}`);
}

function _isNumeric(ctx, val) {
    return typeof val === 'number' || (ctx._dbNumber != null &&
        ctx._dbNumber.isInstance(val));
}

//For untyped Json indexes we assume: numeric < string < boolean.  We allow
//this kind of comparison for sorting in ReceiveIterator and SortIterator.

function compareAtomics(ctx, val1, val2) {
    switch(typeof val1) {
    case 'number':
        if (typeof val2 === 'number') {
            return _compVal(val1, val2);
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val2)) {
            return -ctx._dbNumber.compare(val2, val1);
        }
        if (ctx._untypedJsonComp && (typeof val2 === 'string' ||
            typeof val2 === 'boolean')) {
            return -1;
        }
        break;
    case 'string': case 'boolean':
        if (typeof val1 === typeof val2) {
            return _compVal(val1, val2);
        }
        if (ctx._untypedJsonComp) {
            if (typeof val2 === 'string' || _isNumeric(ctx, val2)) {
                return 1;
            }
            if (typeof val2 === 'boolean') {
                return -1;
            }
        }
        break;
    case 'object':
        if (val1 instanceof Date) {
            if (val2 instanceof Date) {
                return _compVal(val1.getTime(), val2.getTime());
            }
            break;
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val1)) {
            if (ctx._dbNumber.isInstance(val2) || typeof val2 === 'number') {
                return ctx._dbNumber.compare(val1, val2);
            }
            if (ctx._untypedJsonComp && (typeof val2 === 'string' ||
                typeof val2 === 'boolean')) {
                return -1;
            }
            break;
        }
    default:
        throw _unsupportedComp(ctx, val1);
    }
    if (!_supportsComp(val2)) {
        throw _unsupportedComp(ctx, val2);
    }
    return NaN;
}

//compare in ascending order only
//compareRows() will reverse for descending order
function compareFieldValues(ctx, val1, val2, nullRank) {
    if (val1 === null) {
        return val2 === null ? 0 : nullRank;
    } else if (val1 === EMPTY_VALUE) {
        if (val2 === EMPTY_VALUE) {
            return 0;
        }
        return val2 === null ? -1 : nullRank;
    } else if (val2 === null || val2 === EMPTY_VALUE) {
        return -nullRank;
    }
    return compareAtomics(ctx, val1, val2);
}

function compareRows(ctx, row1, row2, sortSpecs) {
    for(let ss of sortSpecs) {
        let compRes = compareFieldValues(ctx, row1[ss.fieldName],
            row2[ss.fieldName], ss.isDesc ? -ss.nullRank : ss.nullRank);
        if (ss.isDesc) {
            compRes = -compRes;
        }
        if (compRes) {
            return compRes;
        }
    }
    return 0;
}

/**
 * Sorts MapValues based on their values on a specified set of top-level
 * fields. It is used by the driver to implement the geo_near function,
 * which sorts results by distance.
 */
class SortIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
        this._untypedJsonComp = true;
        this._inputIter = qpExec.makeIterator(step.input);
        this._rows = [];
        this._mem = 0;
        this._curr = -1;
    }

    static validateStep(step) {
        if (!step.input) {
            throw NoSQLQueryError.illegalState('Missing input iterator for \
SORT');
        }
    }

    async next() {
        if (this._curr === -1) {
            while(await this._inputIter.next()) {
                const row = this._inputIter.result;
                this._rows.push(row);
                const mem = sizeof(this, row);
                this._mem += mem;
                this._qpExec.incMem(mem);
            }
            if (this._qpExec._needUserCont) {
                return false;
            }
            this._rows.sort((row1, row2) =>
                compareRows(this, row1, row2, this._step.sortSpecs));
            this._curr = 0;
        }
        if (this._curr < this._rows.length) {
            this.result = this._rows[this._curr++];
            return true;
        }
        return false;
    }

    reset() {
        this._qpExec.decMem(this._mem);
        this._rows = [];
        this._mem = 0;
        this._curr = -1;
    }

}

SortIterator._isAsync = true;

module.exports = {
    compareAtomics,
    compareRows,
    SortIterator
};
