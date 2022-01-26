/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const util = require('util');
const NoSQLArgumentError = require('./error').NoSQLArgumentError;
const propertyByString = require('./utils').propertyByString;
const isPosInt32 = require('./utils').isPosInt32;

const RoundingModes = {
    UP: 0,
    DOWN: 1,
    CEILING: 2,
    FLOOR: 3,
    HALF_UP: 4,
    HALF_DOWN: 5,
    HALF_EVEN: 6,
    UNNECESSARY: 7
};

const DEFAULT_PRECISION = 20;

class NumberTypeHandler {

    constructor(cfg) {
        assert(cfg.dbNumber != null);
        try {
            this._initCons(cfg);

            //These can be customized in future to allow creation of number
            //instances by callable functions (instead of constructor). 
            this.isInstance = val => val instanceof this._cons;
            this.create = val => new this._cons(val);
            
            this._initMethod(cfg, 'stringValue', 1, [ 'toString' ], []);
            this._initMethod(cfg, 'compare', 2,
                [ 'comparedTo', 'compareTo', 'cmp', 'compare' ]);
            this._initMethod(cfg, 'valuesEqual', 2,
                [ 'equals', 'isEqualTo', 'eq' ], [], true);
            if (this.valuesEqual == null) {
                this.valuesEqual = (v1, v2) => this.compare(v1, v2) === 0;
            }
            this._initMethod(cfg, 'numberValue', 1, [ 'toNumber' ], [], true);
            if (this.numberValue == null) {
                this.numberValue = v => Number(this.stringValue(v));
            }
            this._initMethod(cfg, 'add', 2, [ 'plus', 'add' ]);
            this._initMethod(cfg, 'subtract', 2,
                [ 'minus', 'sub', 'subtract' ]);
            this._initMethod(cfg, 'multiply', 2,
                [ 'times', 'multipliedBy', 'multiply', 'mul' ]);
            this._initMethod(cfg, 'divide', 2,
                [ 'dividedBy', 'divide', 'div' ]);
            this._initRoundingModesMap(cfg);
            this._initGetRoundingMode(cfg);
            this._initGetPrecision(cfg);
            this._initRoundingMode(cfg);
            this._initPrecision(cfg);
        } catch(err) {
            throw new NoSQLArgumentError('Failed to initialize dbNumber \
configuration', cfg, err);
        }
    }

    get precision() {
        return this._precision;
    }

    get roundingMode() {
        return this._roundingMode;
    }

    _initCons(cfg) {
        switch(typeof cfg.dbNumber) {
        case 'function':
            this._cons = cfg.dbNumber;
            return;
        case 'string':
            this._cons = require(cfg.dbNumber);
            break;
        case 'object':
            if (cfg.dbNumber.module != null) {
                if (typeof cfg.dbNumber.module !== 'string') {
                    throw new NoSQLArgumentError('Invalid dbNumber.module \
property, must be string', cfg);
                }
                this._mod = require(cfg.dbNumber.module);
                if (cfg.dbNumber.Constructor == null) {
                    this._cons = this._mod;
                    break;
                } else if (typeof cfg.dbNumber.Constructor === 'string') {
                    this._cons = this._mod[cfg.dbNumber.Constructor];
                    break;
                }
            }
            this._cons = typeof cfg.dbNumber.Constructor === 'string' ?
                require(cfg.dbNumber.Constructor) : cfg.dbNumber.Constructor;
            break;
        default:
            throw new NoSQLArgumentError('Invalid dbNumber property', cfg);
        }
        if (this._cons == null) {
            throw new NoSQLArgumentError('Missing dbNumber constructor', cfg);
        }
        if (typeof this._cons !== 'function') {
            throw new NoSQLArgumentError('Invalid dbNumber constructor', cfg);
        }
    }

    _findFuncByProp(cfg, name, isStatic) {
        if (typeof cfg.dbNumber !== 'object') {
            return null;
        }
        const subName = isStatic ? 'static' : 'instance';
        const sub = cfg.dbNumber[subName];
        if (sub == null) {
            return null;
        }
        if (typeof sub !== 'object') {
            throw new NoSQLArgumentError(
                `Invalid dbNumber.${subName} property`, cfg);
        }
        const obj = isStatic ? this._cons : this._cons.prototype;
        let func = sub[name];
        if (func == null) {
            return null;
        }
        if (typeof func === 'string') {
            func = obj[func];
        }
        if (typeof func !== 'function') {
            throw new NoSQLArgumentError(`Property \
dbNumber.${subName}.${name} points to missing or invalid method of \
${this._cons.name}`, cfg);
        }
        return func;
    }

    _findFunc(cfg, name, cands, staticCands, retNull) {
        let func = this._findFuncByProp(cfg, name, false);
        if (func != null) {
            return { isStatic: false, func };
        }
        func = this._findFuncByProp(cfg, name, true);
        if (func != null) {
            return { isStatic: true, func };
        }
        if (cands != null) {
            for(let cand of cands) {
                func = this._cons.prototype[cand];
                if (typeof func === 'function') {
                    return { isStatic: false, func };
                }
            }
        }
        if (staticCands == null) {
            staticCands = cands;
        }
        if (staticCands != null) {
            for(let cand of staticCands) {
                func = this._cons[cand];
                if (typeof func === 'function') {
                    return { isStatic: true, func };
                }
            }
        }
        if (retNull) {
            return null;
        }
        throw new NoSQLArgumentError(`Could not find dbNumber method for \
${name}`, cfg);
    }

    _initMethod(cfg, name, numArgs, cands, staticCands, isSoft) {
        const meth = this._findFunc(cfg, name, cands, staticCands, isSoft);
        if (meth == null) {
            return;
        }
        if (meth.isStatic) {
            this[name] = meth.func.bind(this._cons);
        } else {
            //not certain if this optimization is needed or the default case
            //is sufficient
            switch(numArgs) {
            case 1:
                this[name] = v => meth.func.call(v);
                break;
            case 2:
                this[name] = (v1, v2) => meth.func.call(v1, v2);
                break;
            default:
                this[name] = (inst, ...args) => meth.func.call(inst, ...args);
                break;
            }
        }
    }

    _findRoundingModes(cfg) {
        const candObjs = [ this._cons ];
        if (this._mod != null) {
            candObjs.push(this._mod);
        }
        //First look at dbNumber.RoundingModes which should be either a
        //property name of rounding modes object or that object itself
        if (cfg.dbNumber.RoundingModes != null) {
            if (typeof cfg.dbNumber.RoundingModes === 'string') {
                for(let candObj of candObjs) {
                    const roundingModes = propertyByString(candObj,
                        cfg.dbNumber.RoundingModes);
                    if (roundingModes !== null &&
                        typeof roundingModes === 'object' ||
                        typeof roundingModes === 'function') {
                        return roundingModes;
                    }
                }
                throw new NoSQLArgumentError(`Missing or invalid value for \
dbNumber.RoundingModes property ${cfg.dbNumber.RoundingModes}`);
            }
            if (typeof cfg.dbNumber.RoundingModes !== 'object' &&
                typeof cfg.dbNumber.RoundingModes !== 'function') {
                throw new NoSQLArgumentError(`Invalid \
dbNumber.RoundingModes: ${util.inspect(cfg.dbNumber.RoundingModes)}`, cfg);
            }
            return cfg.dbNumber.RoundingModes;
        }
        //Otherwise check candidate property names on module or
        //constructor
        const candProps = [ 'RoundingModes', 'RoundingMode' ];
        for(let candObj of candObjs) {
            for(let candProp of candProps) {
                const roundingModes = candObj[candProp];
                if (roundingModes !== null &&
                    typeof roundingModes === 'object' ||
                    typeof roundingModes === 'function') {
                    return roundingModes;
                }
            }
        }
        //If still not found, assume that constructor itself contains rounding
        //mode constants
        return this._cons;
    }

    //create a Map mapping 3rd party rounding mode constants to Java's
    _initRoundingModesMap(cfg) {
        this._roundingModes = this._findRoundingModes(cfg);
        //Create a mapping from 3rd party rounding mode values to Java's
        this._roundingModesMap = new Map();
        for(let ent of Object.entries(RoundingModes)) {
            //Look for properties with and without ROUND_ prefix
            let val = this._roundingModes['ROUND_' + ent[0]];
            if (val == null) {
                val = this._roundingModes[ent[0]];
            }
            if (val != null) {
                this._roundingModesMap.set(val, ent[1]);
            }
        }
    }

    _initGetRoundingMode(cfg) {
        let rm;
        let rmFunc;
        if (cfg.dbNumber.getRoundingMode != null) {
            switch(typeof cfg.dbNumber.getRoundingMode) {
            case 'function':
                rmFunc = cfg.dbNumber.getRoundingMode;
                break;
            case 'string':
                rm = propertyByString(this._cons,
                    cfg.dbNumber.getRoundingMode);
                if (rm == null) {
                    throw new NoSQLArgumentError(`Missing value for \
    dbNumber.getRoundingMode property ${cfg.dbNumber.getRoundingMode}`, cfg);
                }
                rmFunc = cons => propertyByString(cons,
                    cfg.dbNumber.getRoundingMode);
                break;
            default:
                throw new NoSQLArgumentError(`Invalid \
dbNumber.getRoundingMode: ${util.inspect(cfg.dbNumber.getRoundingMode)}`);
            }
        } else {
            //If dbNumber.getRoundingMode is not set and rounding modes
            //mapping is not available, assume that the user just wants to set
            //dbNumber.roundingMode explicitly or use default
            if (this._roundingModesMap.size === 0) {
                return;
            }
            //Otherwise check candidate names
            let cands = [ 'rounding', 'roundingMode', 'ROUNDING_MODE',
                'RM' ];
            for(let cand of cands) {
                rm = this._cons[cand];
                if (rm != null) {
                    rmFunc = cons => cons[cand];
                    break;
                }
            }
            //If not found any way to get rounding mode, let the user set
            //dbNumber.roundingMode explicitly or use default
            if (rmFunc == null) {
                return;
            }
        }

        this._getRoundingMode = cons => {
            const rmVal = rmFunc(cons);
            const rm = this._roundingModesMap.get(rmVal);
            if (rm == null) {
                throw new NoSQLArgumentError(`Could not determine rounding \
mode with value ${util.inspect(rmVal)}, please check configuration \
properties dbNumber.RoundingModes and dbNumber.getRoundingMode`, cfg);
            }
            return rm;
        };
    }

    _initGetPrecision(cfg) {
        let prec;
        let precFunc;
        if (cfg.dbNumber.getPrecision != null) {
            switch(typeof cfg.dbNumber.getPrecision) {
            case 'function':
                precFunc = cfg.dbNumber.getPrecision;
                break;
            case 'string':
                prec = propertyByString(this._cons,
                    cfg.dbNumber.getPrecision);
                if (!isPosInt32(prec)) {
                    throw new NoSQLArgumentError(`Missing or invalid value \
for dbNumber.getRoundingMode property ${cfg.dbNumber.getPrecision}`, cfg);
                }
                precFunc = cons => propertyByString(cons,
                    cfg.dbNumber.getPrecision);
                break;
            default:
                throw new NoSQLArgumentError(`Invalid \
dbNumber.getPrecision: ${util.inspect(cfg.dbNumber.getPrecision)}`);
            }
        }

        if (precFunc == null) {
            const cands = [ 'precision', 'PRECISION' ];
            for(let cand of cands) {
                prec = this._cons[cand];
                if (isPosInt32(prec)) {
                    precFunc = cons => cons[cand];
                    break;
                }
            }
            if (precFunc == null) {
                return;
            }
        }

        this._getPrecision = cons => {
            let prec = precFunc(cons);
            if (!isPosInt32(prec)) {
                throw new NoSQLArgumentError(`Got invalid precision value: \
${util.inspect(prec)}, please check configuration property \
dbNumber.getPrecision`, cfg);
            }
            return prec;
        };
    }

    //get rounding mode constant in Java's format via _roundingModesMap
    _initRoundingMode(cfg) {
        if (cfg.dbNumber.roundingMode != null) {
            if (typeof cfg.dbNumber.roundingMode === 'string') {
                //check if dbNumber.roundingMode could be just a name of
                //the rounding mode enumeration constant (with or without
                //ROUND_ prefix)
                const rm = cfg.dbNumber.roundingMode.startsWith('ROUND_') ?
                    cfg.dbNumber.roundingMode.substring(6) :
                    cfg.dbNumber.roundingMode;
                if (rm in RoundingModes) {
                    this._roundingMode = RoundingModes[rm];
                    return;
                }
            }
            this._roundingMode = this._roundingModesMap.get(
                cfg.dbNumber.roundingMode);
            if (this._roundingMode == null) {
                throw new NoSQLArgumentError(`Could not determine rounding \
mode set by configuration property dbNumber.roundingMode with value \
${util.inspect(cfg.dbNumber.roundingMode)}, please check configuration \
properties dbNumber.roundingMode and dbNumber.RoundingModes`, cfg);
            }
            return;
        }
        if (this._getRoundingMode != null) {
            this._roundingMode = this._getRoundingMode(this._cons);
        } else {
            //if rounding mode cannot be found, use default ROUND_HALF_UP
            this._roundingMode = RoundingModes.HALF_UP;
        }
    }

    _initPrecision(cfg) {
        if (cfg.dbNumber.precision != null) {
            if (!isPosInt32(cfg.dbNumber.precision)) {
                throw new NoSQLArgumentError(`Invalid value of \
dbNumber.precision: ${cfg.dbNumber.precision}`, cfg);
            }
            this._precision = cfg.dbNumber.precision;
        } else if (this._getPrecision != null) {
            this._precision = this._getPrecision(this._cons);
        } else {
            this._precision = DEFAULT_PRECISION;
        }
    }

}

module.exports = NumberTypeHandler;
