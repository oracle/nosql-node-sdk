/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const PlanIterator = require('./common').PlanIterator;
const SQLFuncCode = require('./common').SQLFuncCode;
const MinMaxAggregator = require('./value_aggr').MinMaxAggregator;
const SumAggregator = require('./value_aggr').SumAggregator;
const CollectAggregator = require('./value_aggr').CollectAggregator;

class AggrFuncIterator extends PlanIterator {

    _aggregator;

    constructor(qpExec, step) {
        super(qpExec, step);
        this._inputIter = qpExec.makeIterator(step.input);
        assert(this._inputIter && !this._inputIter.isAsync());
    }

    static validateStep(step) {
        this._validateStepInputSync(step);
    }

    next() {
        for(;;) {
            if (!this._inputIter.next()) {
                return true;
            }
            const val = this._inputIter.result;
            this._aggregator.aggregate(val);
        }
    }

    reset(resetRes) {
        this._inputIter.reset();
        if (resetRes) {
            this._aggregator.reset();
        }
    }

    //Aggregate function iterators do not use the result register.
    get result() {
        return this._aggregator.result;
    }

    //This should never be called for aggregate function iterators.
    set result(val) {
        assert(false);
    }
}

/*
 * any_atomic min(any*)
 * any_atomic max(any*)
 *
 * Implements the MIN/MAX aggregate functions. It is needed by the driver
 * to compute the total min/max from the partial mins/maxs received from the
 * proxy.
 */
class FuncMinMaxIterator extends AggrFuncIterator {
    constructor(qpExec, step) {
        super(qpExec, step);
        this._aggregator = new MinMaxAggregator(this, undefined,
            step.funcCode === SQLFuncCode.FN_MIN);
    }
}

/*
 *  any_atomic sum(any*)
 *
 * Implements the SUM aggregate function. It is needed by the driver to
 * re-sum partial sums and counts received from the proxy.
 */
class FuncSumIterator extends AggrFuncIterator {
    constructor(qpExec, step) {
        super(qpExec, step);
        this._aggregator = new SumAggregator(this);
    }
}

class FuncCollectIterator extends AggrFuncIterator {
    constructor(qpExec, step) {
        super(qpExec, step);
        this._mem = 0;
        this._aggregator = new CollectAggregator(this, val => {
            this._mem += val;
            this._qpExec.incMem(val);
        }, step.isDistinct, this._qpExec.opt._testMode);
    }
}

module.exports = {
    FuncMinMaxIterator,
    FuncSumIterator,
    FuncCollectIterator
};
