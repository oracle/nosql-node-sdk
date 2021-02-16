/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const NoSQLQueryError = require('../error').NoSQLQueryError;
const isPosInt32OrZero = require('../utils').isPosInt32OrZero;
const PlanIterator = require('./common').PlanIterator;
const fieldValuesEqual = require('./compare').fieldValuesEqual;

/**
 * SFWIterator is used for:
 * (a) project out result columns that do not appear in the SELECT list of
 *     the query, but are included in the results fetched from the proxy,
 *     because the are order-by columns or primary-key columns used for
 *     duplicate elimination.
 * (b) For group-by and aggregation queries, regroup and reaggregate the
 *     partial gropus/aggregates received from the proxy.
 * (c) implement offset and limit.
 */
class SFWIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
        this._fromIter = qpExec.makeIterator(step.fromStep);
        this._colIters = new Array(step.colSteps.length);
        for(let i = 0; i < this._colIters.length; i++) {
            const it =  qpExec.makeIterator(step.colSteps[i]);
            assert(!it.isAsync());
            this._colIters[i] = it;
        }

        this._offsetIter = qpExec.makeIterator(step.offsetStep);
        assert(!this._offsetIter || !this._offsetIter.isAsync());
        this._limitIter = qpExec.makeIterator(step.limitStep);
        assert(!this._limitIter || !this._limitIter.isAsync());
        
        this._offset = this._offsetIter ? this._getOffset() : 0;
        this._limit = this._limitIter ? this._getLimit() : -1;
        this._resCnt = 0;
    }

    static validateStep(step) {
        if (!step.fromStep) {
            throw NoSQLQueryError.illegalState('Missing fromIterator in SFW');
        }
        if (!step.colSteps || !step.colSteps.length) {
            throw NoSQLQueryError.illegalState('Missing column iterators in \
SFW');
        }
        if (step.isSelectStar && step.colSteps.length !== 1) {
            throw NoSQLQueryError.illegalState('Multiple column iterators for \
selectStar in SFW');
        }
        for(let s of step.colSteps) {
            assert(s.itCls);
            if (s.itCls._isAsync) {
                throw this.illegalState(`Unexpected async column iterator \
${s.displayName} for SFW`);
            }
        }
        if (step.offsetStep != null) {
            assert(step.offsetStep.itCls);
            if (step.offsetStep.itCls._isAsync) {
                throw this.illegalState(`Unexpected async offset iterator \
${step.offsetStep.displayName} for SFW`);
            }
        }
        if (step.limitStep !=  null) {
            assert(step.limitStep.itCls);
            if (step.limitStep && step.limitStep.itCls._isAsync) {
                throw this.illegalState(`Unexpected async offset iterator \
${step.limitStep.displayName} for SFW`);
            }
        }
    }

    _getOffset() {
        if (!this._offsetIter.next()) {
            throw this.illegalState('Offset iterator has no results');
        }
        const off = this._offsetIter.result;
        if (!isPosInt32OrZero(off)) {
            throw this.illegalArg(`Invalid offset: ${off}`,
                this._offsetIter._step.exprLoc);
        }
        return off;
    }

    _getLimit() {
        if (!this._limitIter.next()) {
            throw this.illegalState('Limit iterator has not results');
        }
        const lim = this._limitIter.result;
        if (!isPosInt32OrZero(lim)) {
            throw this.illegalArg(`Invalid limit: ${lim}`,
                this._limitIter._step.exprLoc);
        }
        return lim;
    }

    _aggregateCol(it) {
        if (!it.next()) {
            throw this.illegalState('Aggregate iterator reached end',
                it._step.exprLoc);
        }
        it.reset();
    }

    _aggregateRow() {
        for(let i = this._step.gbColCnt; i < this._colIters.length; i++) {
            this._aggregateCol(this._colIters[i]);
        }
    }

    /*
     * This method checks whether the current input tuple (a) starts the
     * first group, i.e. it is the very 1st tuple in the input stream, or
     * (b) belongs to the current group, or (c) starts a new group otherwise.
     * The method returns true in case (c), indicating that an output tuple
     * is ready to be returned to the consumer of this SFW. Otherwise, false
     * is returned.
     */
    _groupInputRow() {
        let i;
        /*
         * If this is the very first input row, start the first group and
         * go back to compute next input row.
         */
        if (!this._gbRow) {
            this._gbRow = new Array(this._step.gbColCnt);
            for(i = 0; i < this._gbRow.length; i++) {
                this._gbRow[i] = this._colIters[i].result;
            }
            this._aggregateRow();
            return false;
        }
        //Compare the current input row with the current group row
        for(i = 0; i < this._gbRow.length; i++) {
            if (!fieldValuesEqual(this, this._colIters[i].result,
                this._gbRow[i])) {
                break;
            }
        }
        /*
         * If the input row is in current group, update the aggregate
         * functions and go back to compute the next input row.
         */
        if (i === this._gbRow.length) {
            this._aggregateRow();
            return false;
        }

        /*
         * Input row starts new group. We must finish up the current group,
         * produce result, and init the new group.
         */
        const res = {};
        for(i = 0; i < this._gbRow.length; i++) {
            res[this._step.colNames[i]] = this._gbRow[i];
            //init new group by column values
            this._gbRow[i] = this._colIters[i].result;
        }
        for(i = this._gbRow.length; i < this._colIters.length; i++) {
            const it = this._colIters[i];
            res[this._step.colNames[i]] = it.result;
            it.reset(true);
            //aggregate column values for new row
            this._aggregateCol(it);
        }
        this.result = res;
        return true;
    }

    _produceLastGroup() {
        //Ignore last group if we haven't started grouping yet, execution
        //needs user continuation (group not ready yet) or if we haven't
        //skipped the offset yet
        if (!this._gbRow || this._qpExec._needUserCont || this._offset) {
            return false;
        }
        const res = {};
        let i;
        for(i = 0; i < this._gbRow.length; i++) {
            res[this._step.colNames[i]] = this._gbRow[i];
        }
        for(i = this._gbRow.length; i < this._colIters.length; i++) {
            res[this._step.colNames[i]] = this._colIters[i].result;
        }
        this.result = res;
        this._lastGroupDone = true;
        return true;
    }

    //non-grouping next
    async _simpleNext() {
        if (!(await this._fromIter.next())) {
            return false;
        }
        //Skip if offset has not been reached yet
        if (this._offset > 0) {
            return true;
        }
        //In case of selectStar this iterator shares result registry with
        //the 1st column iterator which will contain the result.
        if (this._step.isSelectStar) {
            if (!this._colIters[0].next()) {
                throw this.illegalState('Column iterator has no results in \
SFWIterator for selectStar');
            }
            this._colIters[0].reset();
            return true;
        }
        //Create result record from colIters results.
        const res = {};
        for(let i = 0; i < this._colIters.length; i++) {
            const it = this._colIters[i];
            //it.next() may return false if this is for JSON field and
            //that field doesn't exist in the current record
            const hasRes = it.next();
            res[this._step.colNames[i]] = hasRes ? it.result : undefined;
            it.reset();
        }
        this.result = res;
        return true;
    }

    async _groupingNext() {
        if (this._lastGroupDone) {
            return false;
        }
        for(;;) {
            if (!(await this._fromIter.next())) {
                return this._produceLastGroup();
            }
            //Compute the exprs of group by columns
            let i;
            for(i = 0; i < this._step.gbColCnt; i++) {
                const it = this._colIters[i];
                //it.next() may return false if this is for JSON field and
                //that field doesn't exist in the current record
                if (!(await it.next())) {
                    it.reset();
                    break;
                }
                it.reset();
            }
            //skip records with non-existing JSON fields in the group by
            //columns
            if (i < this._step.gbColCnt) {
                continue;
            }
            if (this._groupInputRow()) {
                return true;
            }
        }
    }

    async next() {
        if (this._limit >= 0 && this._resCnt >= this._limit) {
            return false;
        }
        //loop to skip offset results
        for(;;) {
            const hasRes = await (this._step.gbColCnt < 0 ?
                this._simpleNext() :
                this._groupingNext());
            if (!hasRes) {
                return false;
            }
            if (!this._offset) {
                this._resCnt++;
                return true;
            }
            this._offset--;
        }
    }

    //should not be called
    reset() {
        throw this.illegalState(
            'Reset should not be called for SFWIterator');
    }

}

SFWIterator._isAsync = true;

module.exports = SFWIterator;
