/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const Decimal = require('decimal.js');
const expect = require('chai').expect;
const EMPTY_VALUE = require('../../lib/constants').EMPTY_VALUE;
const NumberTypeHandler = require('../../lib/db_number');
const NsonReader = require('../../lib/nson_protocol/reader');
const NsonWriter = require('../../lib/nson_protocol/writer');
const NsonProtocol = require('../../lib/nson_protocol/protocol');

const DOUBLE_ZERO = Symbol('DOUBLE_ZERO');

const NSON_COMPAT_TESTS = [
    {
        desc: 'compat-test1',
        nson: `BgAAAkAAAAAYiGludF92YWx1ZQT5BFmGaW50X21heAT7f///hoZpbnRfbWluBAS
AAAB3iWxvbmdfdmFsdWUF/By+mRmbh2xvbmdfbWF4Bf9/////////hodsb25nX21pbgUAgAAAAAAAA
HeLZG91YmxlX3ZhbHVlAz/zwIMSbpeNiWRvdWJsZV9tYXgDf+////////+JZG91YmxlX21pbgMAAAA
AAAAAAYlkb3VibGVfTmFOA//4AAAAAAAAi251bWJlcl92YWx1ZQmJMjE0NzQ4MzY0N4tzdHJpbmdfd
mFsdWUHhmFiY2RlZmeJdGltZV92YWx1ZQiXMjAxNy0wNy0xNVQxNToxODo1OS4xMjNainRpbWVfdmF
sdWUxCJcyMDE3LTA3LTE1VDE1OjE4OjU5LjEyM1qKdGltZV92YWx1ZTIIlzE5MjctMDctMDVUMTU6M
Dg6MDkuMTAwWop0aW1lX3ZhbHVlMwiXMTkyNy0wNy0wNVQwMDowMDowMC4wMDBainRpbWVfdmFsdWU
0CJcxOTI3LTA3LTA1VDAwOjAwOjAwLjAwMFqJdHJ1ZV92YWx1ZQIBimZhbHNlX3ZhbHVlAgCJbnVsb
F92YWx1ZQuKZW1wdHlfdmFsdWUMi2JpbmFyeV92YWx1ZQGbYWJjZGVmZ0FCQ0RFRkdhYmNkZWZnQUJ
DREVGR4htYXBfdmFsdWUGAAAADwAAAAKAYQSAgGIHgmRlZophcnJheV92YWx1ZQAAAAAOAAAABQSAB
IEEggSDBIQ=`,
        value: {
            int_value: 1234,
            int_max: 2147483647,
            int_min: -2147483648,
            long_value: 123456789012n,
            long_max: 9223372036854775807n,
            long_min: -9223372036854775808n,
            double_value: 1.2345,
            double_max: 1.7976931348623157E308,
            double_min: 4.9E-324,
            double_NaN: NaN,
            number_value: new Decimal(2147483647),
            string_value: 'abcdefg',
            time_value: new Date('2017-07-15T15:18:59.123Z'),
            time_value1: new Date('2017-07-15T15:18:59.123Z'),
            time_value2: new Date('1927-07-05T15:08:09.100Z'),
            time_value3: new Date('1927-07-05T00:00:00.000Z'),
            time_value4: new Date('1927-07-05T00:00:00.000Z'),
            true_value: true,
            false_value: false,
            null_value: undefined,
            empty_value: EMPTY_VALUE,
            binary_value: Buffer.from(
                'YWJjZGVmZ0FCQ0RFRkdhYmNkZWZnQUJDREVGRw==', 'base64'),
            map_value: {
                a: 1,
                b: 'def'
            },
            array_value: [ 1, 2, 3, 4, 5 ]
        }
    }
];

const opt = {
    _dbNumber: new NumberTypeHandler({ dbNumber: Decimal }),
    longAsBigInt: true,
    _writeCustomFldVal: (nw, val) => {
        if (val === DOUBLE_ZERO) {
            nw.writeDouble(0);
            return true;
        }
        return false;
    }
};

function testNsonCompat(test) {
    it('', function() {
        const nson = test.nson.replace(/\s/g, '');
        const nsonBytes = Buffer.from(nson, 'base64');
        const nr = new NsonReader(nsonBytes);
        nr.next();
        const valueFromNson = NsonProtocol.readFieldValue(nr, opt);
        expect(valueFromNson).to.deep.equal(test.value);

        const nw = new NsonWriter();
        NsonProtocol.writeFieldValue(nw, valueFromNson, opt);
        const valueToNson = nw.buffer.slice().toString('base64');
        expect(valueToNson).to.equal(nson);
    });
}

describe('Nson compatibility tests', function() {
    for(const test of NSON_COMPAT_TESTS) {
        testNsonCompat(test);
    }
});
