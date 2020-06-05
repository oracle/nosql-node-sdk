/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const util = require('util');
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;
const PlanIterator = require('./common').PlanIterator;

/**
 * ConstIter represents a reference to a constant value in the query.
 * Such a reference will need to be "executed" at the driver side when
 * the constant appears in the OFFSET or LIMIT clause.
 */
class ConstIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
    }

    next() {
        if (this._done) {
            return false;
        }
        this.result = this._step.val;
        this._done = true;
        return true;
    }

}

/**
 * VarRefIter represents a reference to a non-external variable in the query.
 * It simply returns the value that the variable is currently bound to. This
 * value is computed by the variable's "domain iterator" (the iterator that
 * evaluates the domain expression of the variable). The domain iterator stores
 * the value in theResultReg of this VarRefIter.
 *
 * In the context of the driver, an implicit internal variable is used
 * to represent the results arriving from the proxy. All other expressions that
 * are computed at the driver operate on these results, so all such expressions
 * reference this variable. This is analogous to the internal variable used in
 * kvstore to represent the table alias in the FROM clause.
 */
class VarRefIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
    }

    //the value is already stored in domain iterator registry
}

/**
 * In general, ExternalVarRefIter represents a reference to an external variable
 * in the query. Such a reference will need to be "executed" at the driver side
 * when the variable appears in the OFFSET or LIMIT clause.
 * ExternalVarRefIter simply returns the value that the variable is currently
 * bound to. This value is set by the app via the methods of QueryRequest.
 */
class ExtVarRefIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
    }

    next() {
        if (this._done) {
            return false;
        }
        let val;
        if (this._qpExec._extVars) {
            val = this._qpExec._extVars[this._step.pos];
        }
        if (val == null) {
            throw this.illgalState(
                `Variable ${this._step.name} has not been set`);
        }
        this.result = val;
        this._done = true;
        return true;
    }

}

/**
 * FieldStepIter returns the value of a field in an input MapValue. It is
 * used by the driver to implement column references in the SELECT
 * list (see SFWIter).
 */
class FieldStepIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
        this._inputIter = qpExec.makeIterator(step.input);
        assert(this._inputIter && !this._inputIter.isAsync());
    }

    static validateStep(step) {
        this._validateStepInputSync(step);
    }

    next() {
        if (!this._inputIter.next()) {
            return false;
        }
        const res = this._inputIter.result;
        if (typeof res !== 'object') {
            throw this.illegalState(`Input value in field step is not \
object: ${util.inspect(res)}`);
        }
        if (!(this._step.fldName in res)) {
            return false;
        }
        const val = res[this._step.fldName];
        if (val === EMPTY_VALUE) {
            return false;
        }
        this.result = val;
        return true;
    }

    reset() {
        this._inputIter.reset();
    }

}

module.exports = {
    ConstIterator,
    VarRefIterator,
    ExtVarRefIterator,
    FieldStepIterator
};
