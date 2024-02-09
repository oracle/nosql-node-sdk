/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';
const Utils = require('./utils');
const supportsMultiTableWriteMany = require('./common')
    .supportsMultiTableWriteMany;
const AllTypesTest = require('./data_tests').AllTypesTest;
const AllTypesWithChildTableTest = require('./data_tests')
    .AllTypesWithChildTableTest;

const compartment = Utils.config.compartment;

const WRITE_MANY_TESTS = [
    {
        desc: 'writeMany test 1',
        __proto__: new AllTypesTest(20, 100),
        //__proto__: new AllTypesTest(0, 100),
        testCases: [
            {
                desc: 'put even, delete odd, success',
                ops: Utils.range(20).map((v, fromStart) =>
                    !(fromStart & 1) ? { put: { fromStart } } :
                        { delete: { fromStart } }),
                success: true
            },
            {
                desc: 'one put, new row, success',
                ops: [ { put: { fromStart: 1 }, exactMatch: true } ],
                success: true
            },
            {
                desc: 'one delete, existing row, success',
                ops: [ { delete: { fromStart: 1 } } ],
                success: true
            },
            {
                desc: 'two puts, one ifAbsent, fail',
                ops: [
                    {
                        put: { fromStart: 0 },
                        ifAbsent: true,
                        abortOnFail: true,
                        _shouldFail: true
                    },
                    {
                        put: { fromEnd: 0 }
                    }
                ],
                success: false
            },
            {
                desc: 'put 10 new, abortOnFail in opt, success',
                rows: Utils.range(10).map(fromEnd => ({ fromEnd })),
                opt: {
                    abortOnFail: true,
                    timeout: 20000,
                    ifAbsent: true,
                    compartment
                },
                success: true
            },
            {
                desc: 'delete 10, abortOnFail in opt, success',
                keys: Utils.range(10).map(fromStart => ({ fromStart })),
                opt: {
                    abortOnFail: true
                },
                success: true
            },
            {
                desc: 'delete 10 past the end, abortOnFail in opt, fail',
                keys: Utils.range(-4, 6).map(fromEnd => ({ fromEnd })),
                opt: {
                    compartment,
                    abortOnFail: true
                },
                success: false
            },
            {
                desc: 'delete 10 past the end, abortOnFail not set, success',
                keys: Utils.range(-4, 6).map(fromEnd => ({
                    fromEnd,
                    [Utils._shouldFail]: fromEnd >= 0
                })),
                opt: {
                    timeout: 15000
                },
                success: true
            },
            {
                desc: 'ifPresent: true, no updates, success, returnExisting: \
true',
                ops: Utils.range(5).map(fromEnd => ({
                    put: { fromEnd },
                    ifPresent: true,
                    _shouldFail: true
                })),
                opt: {
                    //returnExisting: true - pending proxy bugfix
                },
                success: true
            },
            {
                desc: 'ifPresent: true, abortOnFail overrides opt, fail, \
returnExisting: true',
                ops: Utils.range(5).map(fromEnd => ({
                    ifPresent: true,
                    put: { fromEnd },
                    abortOnFail: fromEnd >= 3
                })),
                opt: {
                    returnExisting: true,
                    abortOnFail: false,
                    timeout: 30000
                },
                success: false
            },
            {
                desc: 'ifPresent and abortOnFail true on last, fail, \
returnExisting: true',
                ops: Utils.range(7).map(fromEnd => ({
                    ifPresent: fromEnd === 6,
                    put: { fromEnd },
                    abortOnFail: fromEnd === 6
                })),
                opt: {
                    returnExisting: true,
                },
                success: false
            },
            {
                desc: 'putMany, ifPresent: true in opt, no updates, success',
                rows: Utils.range(5).map(fromEnd => ({
                    fromEnd,
                    [Utils._shouldFail]: true
                })),
                opt: {
                    ifPresent: true,
                    compartment
                },
                success: true
            },
            {
                desc: 'putMany, ifPresent: true in opt, over rowIdEnd \
boundary, some updates, success',
                rows: Utils.range(-5, 5).map(fromEnd => ({
                    fromEnd,
                    [Utils._shouldFail]: fromEnd >= 0
                })),
                opt: {
                    ifPresent: true,
                    exactMatch: false,
                },
                success: true
            },
            {
                desc: 'putMany, ifAbsent and returnExisting are true in \
opt, over rowIdEnd boundary, some updates, success',
                rows: Utils.range(-5, 5).map(fromEnd => ({
                    fromEnd,
                    [Utils._shouldFail]: fromEnd < 0
                })),
                opt: {
                    ifAbsent: true,
                    //returnExisting: true - pending proxy bugfix
                },
                success: true
            },
            {
                desc: 'put even, delete odd with correct matchVersion, \
success',
                ops: Utils.range(20).map((v, fromStart) =>
                    !(fromStart & 1) ? {
                        put: { fromStart },
                        matchVersion: { fromStart }
                    } : {
                        delete: { fromStart },
                        matchVersion: { fromStart }
                    }),
                success: true
            },
            {
                desc: 'putMany with incorrect matchVersion of row 5 in opt, \
1 update, success',
                rows: Utils.range(0, 8).map(fromStart => ({
                    fromStart,
                    [Utils._shouldFail]: fromStart != 5
                })),
                opt: {
                    matchVersion: { fromStart: 5 }
                },
                success: true
            },
            {
                desc: 'putMany with incorrect matchVersion and \
returnExisting in opt, no updates, success',
                rows: Utils.range(1, 8).map(fromStart => ({
                    fromStart,
                    [Utils._shouldFail]: true
                })),
                opt: {
                    matchVersion: { fromStart: 0 },
                    //returnExisting: true - pending proxy bugfix
                },
                success: true
            },
            {
                desc: 'putMany with incorrect matchVersion, returnExisting \
and abortOnFail in opt, no updates, fail',
                rows: Utils.range(1, 8).map(fromStart => ({ fromStart })),
                opt: {
                    matchVersion: { fromStart: 0 },
                    returnExisting: true,
                    abortOnFail: true
                },
                success: false
            },
            {
                desc: 'put with different ttls followed by delete, success',
                ops: Utils.range(0, 5).map(fromStart => ({
                    put: { fromStart },
                    ttl: { days: fromStart + 1 }
                })).concat(Utils.range(5, 10).map(fromStart  => ({
                    delete: { fromStart },
                    matchVersion: { fromStart }
                }))),
                opt: {
                    abortOnFail: true
                },
                success: true
            },
            {
                desc: 'putMany, across rowIdEnd, same TTL in opt, success',
                rows: Utils.range(-5, 5).map(fromEnd => ({ fromEnd })),
                opt: {
                    ttl: { hours: 10 },
                },
                success: true
            }
        ]
    }
];

if (supportsMultiTableWriteMany(Utils.kvVersion)) {
    WRITE_MANY_TESTS.push({
        desc: 'writeMany test with child table 1',
        __proto__: new AllTypesWithChildTableTest(10, 100),
        testCases: [
            {
                desc: 'put even, delete odd from child table, success',
                ops: Utils.range(20).map(fromStart =>
                    !(fromStart & 1) && fromStart < 10 ?
                        { put: { fromStart } } :
                        { delete: { fromStart }, isChild: true }),
                success: true
            },
            {
                desc: 'put odd for child table, delete even, success',
                ops: Utils.range(15).map(fromStart =>
                    (fromStart & 1) || fromStart >= 10 ?
                        { put: { fromStart }, isChild: true } :
                        { delete: { fromStart } }),
                success: true
            },
            {
                desc: 'two puts, one ifAbsent, fail',
                ops: [
                    {
                        put: { fromStart: 0 },
                        ifAbsent: true,
                        abortOnFail: true,
                        _shouldFail: true
                    },
                    {
                        put: { fromStart: 0 },
                        isChild: true
                    }
                ],
                success: false
            },
            {
                desc: 'put new rows for parent and child tables, \
abortOnFail in opt, success',
                ops: Utils.range(5).map(fromEnd => ({
                    put: { fromEnd }
                })).concat(Utils.range(17).map(fromEnd =>({
                    put: { fromEnd },
                    isChild: true
                }))),
                opt: {
                    abortOnFail: true,
                    timeout: 30000,
                    ifAbsent: true,
                    compartment
                },
                success: true
            },
            {
                desc: 'delete from parent and child tables, abortOnFail in \
opt, success',
                ops: Utils.range(5).map(fromStart => ({
                    delete: { fromStart }
                })).concat(Utils.range(17).map(fromStart =>({
                    delete: { fromStart },
                    isChild: true
                }))),
                opt: {
                    abortOnFail: true
                },
                success: true
            },
            {
                desc: 'ifPresent: true, abortOnFail for child table \
overrides opt, fail',
                ops: Utils.range(5).map(fromEnd => ({
                    ifPresent: true,
                    put: { fromEnd },
                })).concat(Utils.range(5).map(fromEnd => ({
                    ifPresent: true,
                    put: { fromEnd },
                    isChild: true,
                    abortOnFail: fromEnd >= 3
                }))),
                opt: {
                    abortOnFail: false,
                    timeout: 30000
                },
                success: false
            },
            {
                desc: 'put rows, ifPresent: true in opt, no updates, success',
                ops: Utils.range(5).map(fromEnd => ({
                    put: { fromEnd },
                    _shouldFail: true
                })).concat(Utils.range(5).map(fromEnd => ({
                    put: { fromEnd },
                    isChild: true,
                    _shouldFail: true
                }))),
                opt: {
                    ifPresent: true,
                    compartment
                },
                success: true
            },
            {
                desc: 'put rows, ifPresent: true in opt, over rowIdEnd \
boundary, some updates, success',
                ops: Utils.range(-5, 5).map(fromEnd => ({
                    put: { fromEnd },
                    _shouldFail: fromEnd >= 0
                })).concat(Utils.range(-5, 5).map(fromEnd => ({
                    put: { fromEnd },
                    _shouldFail: fromEnd >= 0,
                    isChild: true
                }))),
                opt: {
                    ifPresent: true,
                    exactMatch: false,
                },
                success: true
            },
            {
                desc: 'put even, delete odd from child table with correct \
matchVersion, success',
                ops: Utils.range(20).map((v, fromStart) =>
                    !(fromStart & 1) ? {
                        put: { fromStart },
                        matchVersion: { fromStart }
                    } : {
                        delete: { fromStart },
                        matchVersion: { fromStart },
                        isChild: true
                    }),
                success: true
            },
            {
                desc: 'put with incorrect matchVersion for child table, \
returnExisting and abortOnFail in opt, no updates, fail',
                ops: Utils.range(1, 8).map(fromStart => ({
                    put: { fromStart },
                    isChild: true
                })).concat(Utils.range(1, 3).map(fromStart => ({
                    put: { fromStart },
                    matchVersion: { fromStart } // correct matchVersion
                }))),
                opt: {
                    matchVersion: { fromStart: 0 }, // incorrect matchVersion
                    returnExisting: true,
                    abortOnFail: true
                },
                success: false
            },
            {
                desc: 'put to child table with different ttls followed by \
delete, success',
                ops: Utils.range(0, 5).map(fromStart => ({
                    put: { fromStart },
                    ttl: { days: fromStart + 1 },
                    isChild: true
                })).concat(Utils.range(5, 10).map(fromStart  => ({
                    delete: { fromStart },
                    matchVersion: { fromStart }
                }))),
                opt: {
                    abortOnFail: true
                },
                success: true
            }
        ]
    });
}

module.exports = WRITE_MANY_TESTS;
