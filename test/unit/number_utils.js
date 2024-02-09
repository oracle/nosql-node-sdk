/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));

const expect = require('chai').expect;
const Decimal = require('decimal.js');
const Utils = require('./utils');

const LONG_MAX = 0x7fffffffffffffffn;
const LONG_MIN = -0x8000000000000000n;
const LONG_RANGE = 0x10000000000000000n; // 2^64

const ModBase = {
    stringValue: (val) => val.toString()
};

const NumberModules = {};

function addModule(modName, config) {
    if (Utils.moduleExists(modName)) {
        const cons = require(modName);
        if (typeof config === 'function') {
            config = config(cons);
        }
        NumberModules[modName] = Object.assign({
            __proto__: ModBase,
            cons
        }, config);
    }
}

//Note that we cannot use exponent with absolute value higher than
//Integer.MAX_VALUE used in Java's BigDecimal

addModule('decimal.js', cons => ({
    precision: cons.precision,
    roundingMode: cons.rounding
})),

addModule('decimal.js-light', cons => ({
    precision: cons.precision,
    roundingMode: cons.rounding
})),

addModule('bignumber.js', cons => ({
    precision: 20,
    roundingMode: cons.config().ROUNDING_MODE,
    decimalPlaces: cons.config().DECIMAL_PLACES
}));

addModule('big.js', cons => ({
    precision: 20,
    roundingMode: cons.RM,
    decimalPlaces: cons.DP
}));

/*
 * Has a bug where some values get constructed with '-' sign in the middle.
addModule('js-big-decimal', {
    stringValue: val => val.getValue(),
    precision: 20,
    decimalPlaces: 8
});
*/

class NumberUtils {
    
    static _init() {
        if (Utils.config.dbNumber) {
            let modName = Utils.config.dbNumber;
            if (typeof modName === 'object') {
                modName = modName.Constructor;
            }
            expect(modName).to.be.a('string');
            expect(NumberModules).to.have.property(modName);
            this._mod = NumberModules[modName];
            if (Utils.config.dbNumber.precision != null) {
                this.precision = Utils.config.dbNumber.precision;
            } else {
                this.precision = this._mod.precision;
            }
            if (Utils.config.dbNumber.roundingMode != null) {
                this.roundingMode = Utils.config.dbNumber.roundingMode;
            } else {
                this.roundingMode = this._mod.roundingMode;
            }
            Decimal.precision = this.precision;
        } else {
            this.precision = NumberUtils.DOUBLE_PRECISION;
        }
    }

    //Assumes each arg is either number or bigint.
    static _getBuildInCons(val1, val2) {
        if (typeof val1 === 'bigint') {
            return (typeof val2 === 'bigint' || Number.isSafeInteger(val2)) ?
                BigInt : Number;
        }
        return (typeof val2 === 'bigint' && Number.isSafeInteger(val1)) ?
            BigInt : Number;
    }

    static isBuiltInNum(val) {
        return typeof val === 'number' || typeof val === 'bigint';
    }

    static isNumber(val) {
        if (NumberUtils.isBuiltInNum(val)) {
            return true;
        }
        if (NumberUtils._mod == null) {
            return false;
        }
        //We use Decimal to compute expected query results
        return val instanceof NumberUtils._mod.cons || val instanceof Decimal;
    }

    static isNaN(val) {
        return typeof val === 'number' ? isNaN(val) : false;
    }

    static verifyNumber(val, val0, info) {
        if (this._mod) {
            expect(val).to.be.an.instanceOf(this._mod.cons);
            val = new Decimal(this._mod.stringValue(val));
            if (!(val0 instanceof Decimal)) {
                val0 = new Decimal(this._mod.stringValue(val0));
            }
        } else {
            expect(val).to.be.a('number');
            val = new Decimal(val);
            if (!(val0 instanceof Decimal)) {
                val0 = new Decimal(val0);
            }
        }
        const precision = info.precision ? info.precision :
            NumberUtils.precision;
        if (!info.roundingDelta) {
            expect(!info.useDP).to.equal(true); //test self-check
            val = val.toPrecision(precision);
            val0 = val0.toPrecision(precision);
            return expect(val).to.equal(val0);
        }

        //If either value is 0 (but not both), we don't have enough
        //information to compare exponents.  This could happen as a result
        //of subtraction of differntly rounded values or as a result of
        //division for libraries that round to decimal places.  The best we
        //can do is just to compare absolute value of non-zero value with
        //expected delta.
        if (!val.isZero() && !val0.isZero()) {
            let exp = val.e;
            let exp0 = val0.e;
            if (exp !== exp0) { //marginal case, e.g. 9.9999 rounds to 10
                expect(Math.abs(exp - exp0)).to.equal(1);
                if (exp > exp0) {
                    exp--;
                } else {
                    exp0--;
                }
            }
            //normalize values
            val = val.dividedBy('1e' + exp);
            val0 = val0.dividedBy('1e' + exp0);
        }
        const delta = Decimal.abs(Decimal.sub(val, val0));
        let delta0 = new Decimal('1e' + (1 - precision));
        if (info.roundingDelta > 1) {
            delta0 = delta0.times(info.roundingDelta);
        }
        if (info.useDP && this._mod && this._mod.decimalPlaces) {
            //For libraries like bignumber.js and big.js, division is rounded
            //to decimal places (we use useDP=true for these cases), we adjust
            //expected delta accordingly
            delta0 = Decimal.max(delta0, '1e-' + this._mod.decimalPlaces);
        }
        expect(delta.comparedTo(delta0)).to.be.at.most(0);
    }

    static cmp(val1, val2) {
        if (NumberUtils.isBuiltInNum(val1) &&
            NumberUtils.isBuiltInNum(val2)) {
            //Note: when not using longAsBigInt option but having very big
            //LONG values, the below works for array_collect(distinct) and
            //count(distinct) operators, but would be problematic when the
            //comparisons are done on the server, such as group by using
            //secondary index on a LONG column.
            //To do: when such cases arises, introduce a parameter controling
            //this behavior, this would have to be passed through several
            //layers depending on the test case (need to know if secondary
            //index on the LONG column was used).
            //Alternatively, we may need to change the behavior of the driver
            //to always use longAsBigInt as far as query calculations are
            //concerned, and only convert the final results to Number if
            //longAsBigInt option was not specified in the config. This way,
            //when using very big LONG values (> MAX_SAFE_INTEGER) the results
            //will be more consistent with languages that support type long.
            //This needs to be discussed.
            if (!Utils.config.longAsBigInt) {
                val1 = Number(val1);
                val2 = Number(val2);
            }
            return val1 > val2 ? 1 : (val1 < val2 ? -1 : 0);
        }
        if (!(val1 instanceof Decimal)) {
            val1 = new Decimal(NumberUtils.asString(val1));
        }
        return val1.comparedTo(NumberUtils.asString(val2));
    }

    static add(val1, val2) {
        if (NumberUtils.isBuiltInNum(val1) &&
            NumberUtils.isBuiltInNum(val2)) {
            const cons = NumberUtils._getBuildInCons(val1, val2);
            return cons(val1) + cons(val2);
        }
        return Decimal.add(NumberUtils.asString(val1),
            NumberUtils.asString(val2));
    }

    static sub(val1, val2) {
        if (NumberUtils.isBuiltInNum(val1) &&
            NumberUtils.isBuiltInNum(val2)) {
            const cons = NumberUtils._getBuildInCons(val1, val2);
            return cons(val1) - cons(val2);
        }
        return Decimal.sub(NumberUtils.asString(val1),
            NumberUtils.asString(val2));
    }

    static mul(val1, val2) {
        if (NumberUtils.isBuiltInNum(val1) &&
            NumberUtils.isBuiltInNum(val2)) {
            const cons = NumberUtils._getBuildInCons(val1, val2);
            return cons(val1) * cons(val2);
        }
        return Decimal.mul(NumberUtils.asString(val1),
            NumberUtils.asString(val2));
    }

    static wrapInt(val) {
        if (val > 0x7fffffff) {
            return (val + 0x80000000) % 0x100000000 - 0x80000000;
        }
        if (val < -0x80000000) {
            return (val - 0x7fffffff) % 0x100000000 + 0x7fffffff;
        }
        return val;
    }

    static wrapLong(val) {
        const cons = typeof val === 'bigint' ? BigInt : Number;

        if (val > cons(LONG_MAX)) {
            return (val - cons(LONG_MIN)) % cons(LONG_RANGE) + cons(LONG_MIN);
        }
        if (val < cons(LONG_MIN)) {
            return (val - cons(LONG_MAX)) % cons(LONG_RANGE) + cons(LONG_MAX);
        }
        return val;
    }

    static div(val1, val2, isInt) {
        if (NumberUtils.isBuiltInNum(val1) &&
            NumberUtils.isBuiltInNum(val2)) {
            if (!isInt || typeof val1 !== 'bigint' ||
                typeof val2 !== 'bigint') {
                val1 = Number(val1);
                val2 = Number(val2);
            }
            return val1 / val2;
        }
        return Decimal.div(NumberUtils.asString(val1),
            NumberUtils.asString(val2));
    }

    static asString(val) {
        if (this._mod && val instanceof this._mod.cons) {
            return this._mod.stringValue(val);
        }
        if (typeof val === 'string') {
            return val;
        }
        return val.toString();
    }

    static asNumber(val) {
        if (typeof val === 'number') {
            return val;
        }
        val = this.asString(val);
        return this._mod ? new this._mod.cons(val) : Number(val);
    }

    static makeNumber1(id, def) {
        if (!(id % 7)) {
            return def;
        }
        id = id % 27;
        const maxExp = this._mod ? 16384 : this.DOUBLE_MAX_EXPONENT;
        let val = new Decimal(id).squareRoot();
        let exp =  Math.floor(maxExp / 3) - id - 2;
        if (id % 2) {
            exp = -exp;
        }
        val = val.times('1e' + exp);
        if (!(id % 5)) {
            val = val.negated();
        }
        return this.asNumber(val);
    }

    static makeNumber2(id, def) {
        if (!(id % 8)) {
            return def;
        }
        const maxExp = this._mod ? 8192 : this.DOUBLE_MAX_EXPONENT;
        let val = new Decimal(id * 1000000).naturalExponential();

        const expDelta = val.e - Math.floor(maxExp / 3);
        if (expDelta > 0) {
            val = val.dividedBy('1e' + expDelta);
        }
        if (id % 2) {
            val = val.negated();
        }
        return this.asNumber(val);
    }

}

//significant decimal digits in float and double
NumberUtils.FLOAT_PRECISION = 7;
NumberUtils.DOUBLE_PRECISION = 15;
NumberUtils.DOUBLE_MAX_EXPONENT = 308;

NumberUtils._init();

module.exports = NumberUtils;
