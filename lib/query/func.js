/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const util = require('util');
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;
const PlanIterator = require('./common').PlanIterator;
const SQLFuncCode = require('./common').SQLFuncCode;
const compareNonNullAtomics = require('./compare').compareNonNullAtomics;
const isNumeric = require('./utils').isNumeric;

//Avoid ReferenceError(s) in case bigint is not supported.
const BigIntCons = typeof BigInt === 'function' ? BigInt : Number;

//Just in case it is not supported in some browsers.
if (!Math.trunc) {
    Math.trunc = function(val) {
        return val > 0 ? Math.floor(val) : Math.ceil(val);
    };
}

class AggrFuncIterator extends PlanIterator {

    constructor(qpExec, step) {
        super(qpExec, step);
        this._inputIter = qpExec.makeIterator(step.input);
        assert(this._inputIter && !this._inputIter.isAsync());
    }

    static validateStep(step) {
        this._validateStepInputSync(step);
    }

    reset(resetRes) {
        this._inputIter.reset();
        if (resetRes) {
            this._result = undefined;
        }
    }

    //Aggregate iterators do not use the result register

    get result() {
        return this._result;
    }

    set result(val) {
        this._result = val;
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
    }

    next() {
        for(;;) {
            if (!this._inputIter.next()) {
                return true;
            }
            const val = this._inputIter.result;
            if (val == null || val === EMPTY_VALUE) {
                continue;
            }
            if (this._result == null) {
                this._result = val;
            } else {
                const compRes = compareNonNullAtomics(this, val,
                    this._result);
                if (this._step.funcCode === SQLFuncCode.FN_MIN) {
                    if (compRes < 0) {
                        this._result = val;
                    }
                } else if (compRes > 0) {
                    this._result = val;
                }
            }
        }
    }

}

//3rd party number library may not support any operations with bigint, so we
//have to convert bigint to the 3rd party number object. Going through string
//ensures the precision is preserved.
function _bigint2dbnum(ctx, val) {
    return typeof val !== 'bigint' ?
        val : ctx._dbNumber.create(val.toString());
}

//Always create 3rd party number object, going through string for bigint to
//preserve precision.
function _val2dbnum(ctx, val) {
    return ctx._dbNumber.create(
        typeof val !== 'bigint' ? val : val.toString());
}

//Assuming this function will be inlined.
function _has1bigint(val1, val2) {
    return (typeof val1 === 'bigint') != (typeof val2 === 'bigint');
}

//This function assumes that one of val1, val2 is bigint and the other one is
//number.  Unfortunately we don't have the db type information for the value
//of type number to determine if both should be treated as db type Long or
//Double.  Assume that number value representing exact integer should be
//coerced to bigint if the other argument is bigint.
function _normalizeArgsWithBigint(val1, val2) {
    if (typeof val1 === 'bigint') {
        if (Number.isSafeInteger(val2)) {
            val2 = BigIntCons(val2);
        } else {
            val1 = Number(val1);
        }
    } else { //typeof val2 === 'bigint'
        if (Number.isSafeInteger(val1)) {
            val1 = BigIntCons(val1);
        } else {
            val2 = Number(val2);
        }
    }
    return { val1, val2 };
}

function _add(ctx, val1, val2) {
    if (ctx._dbNumber != null) {
        if (ctx._dbNumber.isInstance(val1)) {
            return ctx._dbNumber.add(val1, _bigint2dbnum(ctx, val2));
        }
        if (ctx._dbNumber.isInstance(val2)) {
            return ctx._dbNumber.add(val2, _bigint2dbnum(ctx, val1));
        }
    }
    if (_has1bigint(val1, val2)) {
        ({ val1, val2 } = _normalizeArgsWithBigint(val1, val2));
    }
    return val1 + val2;
}

function _sub(ctx, val1, val2) {
    if (ctx._dbNumber != null) {
        if (ctx._dbNumber.isInstance(val1)) {
            return ctx._dbNumber.subtract(val1, _bigint2dbnum(ctx, val2));
        }
        if (ctx._dbNumber.isInstance(val2)) {
            return ctx._dbNumber.subtract(_val2dbnum(ctx, val1), val2);
        }
    }
    if (_has1bigint(val1, val2)) {
        ({ val1, val2 } = _normalizeArgsWithBigint(val1, val2));
    }
    return val1 - val2;
}

function _mul(ctx, val1, val2) {
    if (ctx._dbNumber != null) {
        if (ctx._dbNumber.isInstance(val1)) {
            return ctx._dbNumber.multiply(val1, _bigint2dbnum(ctx, val2));
        }
        if (ctx._dbNumber.isInstance(val2)) {
            return ctx._dbNumber.multiply(val2, _bigint2dbnum(ctx, val1));
        }
    }
    if (_has1bigint(val1, val2)) {
        ({ val1, val2 } = _normalizeArgsWithBigint(val1, val2));
    }
    return val1 * val2;
}

//If any of the arguments is number, unfortunately we cannot determine if it
//came from int, long or double field.  We perform floating-point division if
//at least one of the arguments is number.  If both arguments are bigint, we
//perform integer division.
function _div(ctx, val1, val2) {
    if (ctx._dbNumber != null) {
        if (ctx._dbNumber.isInstance(val1)) {
            return ctx._dbNumber.divide(val1, _bigint2dbnum(ctx, val2));
        }
        if (ctx._dbNumber.isInstance(val2)) {
            return ctx._dbNumber.divide(_val2dbnum(ctx, val1), val2);
        }
    }
    if (_has1bigint(val1, val2)) {
        val1 = Number(val1);
        val2 = Number(val2);
    }
    //Perform integer division if both arguments are bigint, otherwise
    //perform floating-point division.
    return val1 / val2;
}

function _fpDiv(ctx, val1, val2) {
    if (ctx._dbNumber != null) {
        if (ctx._dbNumber.isInstance(val1)) {
            return ctx._dbNumber.divide(val1, _bigint2dbnum(ctx, val2));
        }
        if (ctx._dbNumber.isInstance(val2)) {
            return ctx._dbNumber.divide(_val2dbnum(ctx, val1), val2);
        }
    }
    //Bigints don't support floating point division, so we always convert them
    //to numbers.
    if (typeof val1 === 'bigint') {
        val1 = Number(val1);
    }
    if (typeof val2 === 'bigint') {
        val2 = Number(val2);
    }
    return val1 / val2;
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
    }

    next() {
        for(;;) {
            if (!this._inputIter.next()) {
                return true;
            }
            const val = this._inputIter.result;
            if (val == null || val === EMPTY_VALUE) {
                continue;
            }
            if (!isNumeric(this, val)) {
                throw this.illegalState(`Non-numeric input to SUM function: \
${util.inspect(val)}`);
            }
            if (this._result == null) {
                this._result = val;
            } else {
                this._result = _add(this, this._result, val);
            }
        }
    }

}

/*
 * Iterator to implement the arithmetic operators
 *
 * any_atomic? ArithOp(any?, ....)
 *
 * An instance of this iterator implements either addition/substraction among
 * two or more input values, or multiplication/division among two or more
 * input values. For example,
 * arg1 + arg2 - arg3 + arg4, or arg1 * arg2 * arg3 / arg4.
 *
 * The only arithmetic op that is strictly needed for the driver is the div
 * (real division) op, to compute an AVG aggregate function as the division of
 * a SUM by a COUNT. However, having all the arithmetic ops implemented allows
 * for expressions in the SELECT list that do arithmetic among aggregate
 * functions (for example: select a, sum(x) + sum(y) from foo group by a).
 */
class ArithOpIterator extends PlanIterator {
    
    constructor(qpExec, step) {
        super(qpExec, step);
        this._argIters = step.args.map(arg => {
            const it = qpExec.makeIterator(arg);
            if (it._isAsync) {
                throw this.illegalState(`Unexpected async input iterator \
${it._step.displayName} for ArithOpIterator`);
            }
            return it;
        });
    }

    /*
     * If step.funcCode == FuncCode.OP_ADD_SUB, step.ops is a string of "+"
     * and/or "-" chars, containing one such char per input value. For
     * example, if the arithmetic expression is (arg1 + arg2 - arg3 + arg4)
     * step.ops is "++-+".
     *
     * If step.funcCode == FuncCode.OP_MULT_DIV, step.ops is a string of "*",
     * "/", and/or "d" chars, containing one such char per input value. For
     * example, if the arithmetic expression is (arg1 * arg2 * arg3 / arg4)
     * step.ops is "***\/". The "d" char is used for the div operator.
     */

    _doOp(op, val1, val2) {
        if (this._step.funcCode === SQLFuncCode.OP_ADD_SUB) {
            switch(op) {
            case '+':
                return _add(this, val1, val2);
            case '-':
                return _sub(this, val1, val2);
            default:
                break;
            }
        } else {
            assert(this._step.funcCode === SQLFuncCode.OP_MULT_DIV);
            switch(op) {
            case '*':
                return _mul(this, val1, val2);
            case '/':
                return _div(this, val1, val2);
            case 'd': 
                return _fpDiv(this, val1, val2);
            default:
                break;
            }
        }
        throw this.illegalState(`Invalid operation ${op} for \
            function code ${this._step.funcCode.name}`);
    }

    next() {
        let res = (this._step.funcCode === SQLFuncCode.OP_ADD_SUB) ? 0 : 1;
        for(let i = 0; i < this._argIters.length; i++) {
            const it = this._argIters[i];
            if (!it.next()) {
                return false;
            }
            const val = it.result;
            if (val == null) {
                this.result = undefined;
                return true;
            }
            if (!isNumeric(this, val)) {
                throw this.illegalArg(`Non-numeric operand for arithmetic \
operation: ${util.inspect(val)}`);
            }
            res = this._doOp(this._step.ops[i], res, val);
        }
        this.result = res;
        return true;
    }

    reset() {
        for(let it of this._argIters) {
            it.reset();
        }
    }

}

module.exports = {
    FuncMinMaxIterator,
    FuncSumIterator,
    ArithOpIterator,
    add: _add
};
