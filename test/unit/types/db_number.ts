/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";
import { Decimal } from "decimal.js";
import { DBNumberConfig, DBNumberConstructor, NumberLibConfig, NumberLibMethods, RoundingModesMap } from "../../../";

function testDBNumberConfig(nlCfg: NumberLibConfig) {
    let cfg: DBNumberConfig;
    
    cfg = "decimal.js";
    cfg = class { constructor(val: string|number) {} }
    cfg = Decimal;
    cfg = nlCfg;

    // @ts-expect-error Invalid type for DBNumberConfig.
    cfg = 1;
    // @ts-expect-error Invalid type for DBNumberConfig.
    cfg = true;
    // @ts-expect-error Invalid type for DBNumberConstructor.
    cfg = class { constructor(val: number) {} }
    // @ts-expect-error Invalid type for NumLibConfig.
    cfg = { module: "decimal.js" };
}

function testNumberLibConfig(methods: NumberLibMethods) {
    let cfg: NumberLibConfig;

    cfg = { Constructor: Decimal };
    cfg.Constructor = "Decimal";
    cfg.module = "module";
    cfg.static = methods;
    cfg.instance = methods;
    cfg.precision = 10;
    cfg.roundingMode = 8;
    cfg.roundingMode = "HALF_UP";
    
    cfg = { Constructor: Decimal };
    cfg.getPrecision = "precision";
    cfg.getPrecision = () => Decimal.precision;
    cfg.getPrecision = (cons: DBNumberConstructor) => Decimal.precision;
    cfg.getRoundingMode = "rounding";
    cfg.getRoundingMode = () => Decimal.rounding;
    cfg.getRoundingMode = (cons: DBNumberConstructor) => Decimal.rounding;
    cfg.getRoundingMode = () => "UP";
    cfg.RoundingModes = "modes";
    cfg.RoundingModes = { UP: 1, DOWN: 2 };
    
    // @ts-expect-error Missing constructor.
    cfg = {};
    // @ts-expect-error Invalid constructor.
    cfg = { Constructor: () => new Decimal(1) };
    // @ts-expect-error Invalid type for module.
    cfg.module = Buffer.alloc(100);
    // @ts-expect-error Invalid type for static.
    cfg.static = true;
    // @ts-expect-error Invalid method name in NumberLibMethods.
    cfg.static = { sub: "sub" };
    // @ts-expect-error Invalid type for instance.
    cfg.instance = "instance";
    // @ts-expect-error Too many arguments for add in NumberLibMethods.
    cfg.instance = { add: (x: Decimal, y: Decimal, z: Decimal) =>
        new Decimal(2) };
    // @ts-expect-error Invalid type for precision.
    cfg.precision = "10";
    // @ts-expect-error Invalid type for getPrecision.
    cfg.getPrecision = 10;
    // @ts-expect-error Invalid argument type for getPrecision.
    cfg.getPrecision = (d: Decimal) => Decimal.precision;
    // @ts-expect-error Invalid type for getRoundingMode.
    cfg.getRoundingMode = 1;
    // @ts-expect-error Invalid argument type for getRoundingMode.
    cfg.getRoundingMode = (d: Decimal) => Decimal.rounding;
    // @ts-expect-error Invalid type for RoundingModes.
    cfg.RoundingModes = 10;
    // @ts-expect-error Invalid property in RoundingModesMap.
    cfg.RoundingModes = { UNSUPPORTED: 10 };
}

let v: object = new Decimal(1);


function testNumberLibMethods() {
    let methods: NumberLibMethods = {};
    
    methods.compare = "compare";
    methods.compare = (a: Decimal, b: Decimal) => 0;
    methods.valuesEqual = "equals";
    methods.valuesEqual = (a, b) => true;
    methods.add = "add";
    methods.add = (a: Decimal, b: Decimal) => a.plus(b);
    methods.subtract = "subtract";
    methods.subtract = (a: Decimal, b: Decimal) => a.minus(b);
    methods.multiply = "multiply";
    methods.multiply = (a: Decimal, b: Decimal) => a.mul(b);
    methods.divide = "divide";
    methods.divide = (a: Decimal, b: Decimal) => a.div(b);

    // @ts-expect-error Invalid type for compare.
    methods.compare = 1;
    // @ts-expect-error Invalid type for compare.
    methods.compare = (a: Decimal, b: Decimal) => true;
    // @ts-expect-error Invalid type for valuesEqual.
    methods.valuesEqual = true;
    // @ts-expect-error Invalid type for valuesEqual.
    methods.valuesEqual = (a, b, c) => true;
    // @ts-expect-error Invalid type for valuesEqual.
    methods.valuesEqual = (a, b) => 0;
    // @ts-expect-error Invalid type for add.
    methods.add = 1;
    // @ts-expect-error Invalid type for add.
    methods.add = (a, b, c) => new Decimal(1);
    // @ts-expect-error Invalid type for add.
    methods.add = { add: "add" };
    // @ts-expect-error Invalid type for subtract.
    methods.subtract = 2;
    // @ts-expect-error Invalid type for subtract.
    methods.subtract = (a, b, c, d) => new Decimal(1);
    // @ts-expect-error Invalid type for multiply.
    methods.multiply = true;
    // @ts-expect-error Invalid type for multiply.
    methods.multiply = (a, b, c, d) => new Decimal(1);
    // @ts-expect-error Invalid type for divide.
    methods.divide = {};
    // @ts-expect-error Invalid type for divide.
    methods.divide = (a, b, c) => new Decimal(1);
}

function testRoundingModesMap() {
    let map: RoundingModesMap = {};
    expectTypeOf(map.UP).toBeUnknown();
    expectTypeOf(map.DOWN).toBeUnknown();
    expectTypeOf(map.CEILING).toBeUnknown();
    expectTypeOf(map.FLOOR).toBeUnknown();
    expectTypeOf(map.HALF_UP).toBeUnknown();
    expectTypeOf(map.HALF_DOWN).toBeUnknown();
    expectTypeOf(map.HALF_EVEN).toBeUnknown();

    // @ts-expect-error Invalid property of RoundingModesMap.
    map.up = 1;
}
