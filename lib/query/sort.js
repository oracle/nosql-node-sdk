/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const util = require('util');
const NoSQLQueryError = require('../error').NoSQLQueryError;
const PlanIterator = require('./common').PlanIterator;
const compareRows = require('./compare').compareRows;
const sizeof = require('./utils').sizeof;
const convertEmptyToNull = require('./utils').convertEmptyToNull;

/**
 * Sorts MapValues based on their values on a specified set of top-level
 * fields. It is used by the driver to implement the geo_near function,
 * which sorts results by distance.
 */
class SortIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
        this._inputIter = qpExec.makeIterator(step.input);
        this._rows = [];
        if (step.countMem) {
            this._mem = 0;
        }
        this._curr = -1;
    }

    static validateStep(step) {
        if (!step.input) {
            throw NoSQLQueryError.illegalState('Missing input iterator for \
SORT');
        }
    }

    unsupportedComp(val) {
        return this.illegalArg(`Sort expression returns value not suitable \
for comparison: ${util.inspect(val)}`);
    }

    async next() {
        if (this._curr === -1) {
            while(await this._inputIter.next()) {
                const row = this._inputIter.result;
                this._rows.push(row);
                if (this._step.countMem) {
                    const mem = sizeof(this, row);
                    this._mem += mem;
                    this._qpExec.incMem(mem);
                }
            }
            if (this._qpExec._needUserCont) {
                return false;
            }
            this._rows.sort((row1, row2) =>
                compareRows(this, row1, row2, this._step.sortSpecs));
            this._curr = 0;
        }
        if (this._curr < this._rows.length) {
            const res = this._rows[this._curr];
            convertEmptyToNull(res);
            this._rows[this._curr++] = null; //release memory for the row
            this.result = res;
            return true;
        }
        return false;
    }

    reset() {
        this._rows = [];
        this._curr = -1;
        if (this._step.countMem) {
            this._qpExec.decMem(this._mem);
            this._mem = 0;
        }
    }

}

SortIterator._isAsync = true;

module.exports = SortIterator;
