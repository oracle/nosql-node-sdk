/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;

const _id = require('./common')._id;
const _ttl = require('./common')._ttl;
const _version = require('./common')._version;
const Utils = require('./query_utils');
const NumberUtils = require('./number_utils');

const compartment = Utils.config.compartment;

const ALL_TYPES_TABLE = require('./test_schemas').ALL_TYPES_TABLE;

const NUM_SPECIAL = [ Infinity, -Infinity, NaN, 0, undefined ];

//This has to be constant for the duration of the test so that we can
//verify row values later.
const currentTimeMillis = Date.now();

const DEFAULT_LOCATION = { //Oracle HQ
    type: 'point',
    coordinates: [ -122.264640, 37.529637 ]
};

//To be extended.
function makeObjectForJSON(i) {
    if (!(i % 7)) {
        return null;
    }
    const ret = {
        x: 'a',
        y: 10 + i,
        u: !(i % 4) ? //use for comparsion between different types
            100.01 + i :
            ((i % 4) === 1 ?
                'abcde' + i :
                ((i % 4) === 2 ?
                    (i % 10) < 5 : new Date(currentTimeMillis))),
        z: new Date(currentTimeMillis + (i % 6) * 123456),
        location: (i % 5) ? Utils.geoDestination(DEFAULT_LOCATION,
            ((i + 1) % 8) * 12000 + i * 10.987, i * 2) : null
    };
    if (i % 3) {
        ret.b = (i % 3 === 2);
    }
    return ret;
}

//this JSON col will have its full values repeated, unlike the previous one
function makeObjectForJSON2(i) {
    if (!(i % 17)) {
        return null;
    }
    const j = i % 8;
    const ret = {
        x: {
            a: j ? j + 1000 : j < 5, //number or boolean
            b: Array.from({ length: j }, (v, k) => 'a'.repeat(10-k)),
            c: j < 3 ? 'c'.repeat(j * 5) : null
        },
        y: {
            a: 'abc'.repeat(j % 4),
            b: (j % 4) ? [ j % 4, j % 4 ] : 'abc',
            c: j % 2
        }
    };
    if (j % 2) {
        ret.z = {
            k: j < 5 ? NumberUtils.makeNumber1(j, null) : 'abc'.repeat(j),
            a: {
                b: {
                    c: j % 4 ? new Array(20 - j).fill(j) : null
                }
            }
        };
    }
    
    return ret;
}

const INT_MAX = 0x7fffffffn;
const INT_MIN = -0x80000000n;
const LONG_MAX = 0x7fffffffffffffffn;
const LONG_MIN = -0x8000000000000000n;

const INT_EDGE_CASES = [ 0, -1, Number(INT_MAX), Number(INT_MIN) ];

function getIntValue(i, opt) {
    const edgeCaseCnt = opt && opt.simpleColInteger ?
        0 : INT_EDGE_CASES.length;
    let k = i % (edgeCaseCnt + 16);
    if (k < edgeCaseCnt) {
        return INT_EDGE_CASES[k];
    }
    
    k -= edgeCaseCnt;
    if (k === 0) {
        return undefined;
    }
    if (k < 8) {
        return (k + 1) * (((k % 3) === 0) ? -1 : 1);
    }
    return (0x70000000 + k) * (((k % 2) === 0) ? -1 : 1);
}

const LONG_EDGE_CASES = [ 0n, -1n, LONG_MAX, LONG_MIN, INT_MAX, INT_MIN,
    INT_MAX + 1n, INT_MIN - 1n, 0x10000000n + 121n, -0x10000000n - 119n,
    BigInt(Number.MAX_SAFE_INTEGER),
    BigInt(Number.MAX_SAFE_INTEGER + 1),
    BigInt(Number.MIN_SAFE_INTEGER),
    BigInt(Number.MIN_SAFE_INTEGER - 1),
    BigInt(Math.floor(Number.MAX_SAFE_INTEGER / 0x10000000) * 0x10000000 +
        121),
    BigInt(Math.ceil(Number.MAX_SAFE_INTEGER / 0x10000000) * 0x10000000 +
        121),
    BigInt(Math.ceil(Number.MIN_SAFE_INTEGER / 0x10000000) * 0x10000000 -
        119),
    BigInt(Math.floor(Number.MIN_SAFE_INTEGER / 0x10000000) * 0x10000000 -
        119),
    (LONG_MAX / 0x10000000n) * 0x10000000n + 121n,
    (LONG_MIN / 0x10000000n + 1n) * 0x10000000n - 119n,
];

function getLongArray(i) {
    switch(i % 9) {
    case 0:
        return undefined;
    case 1:
        return [];
    case 2:
        return [ LONG_MAX, Number(LONG_MIN) ];
    case 3:
        return LONG_EDGE_CASES;
    case 4:
        return LONG_EDGE_CASES.map(val => Number(val));
    case 5:
        return Utils.range((i % 8) + 8).map(
            val => LONG_MAX - BigInt(val));
    case 6:
        return Utils.range((i % 5) + 10).map(
            val => Number(LONG_MAX) - (val * 0x1000));
    case 7:
        return Utils.range((i % 4) + 7).map(
            val => LONG_MIN + BigInt(val * Number(INT_MAX)));
    case 8:
        return Utils.range((i % 4) + 7).map(
            val => Number(LONG_MIN) + ((val + 1) * Number(INT_MAX)));
    }
}

function getLongMap(i) {
    const arr = getLongArray(i);
    if (!arr) {
        return undefined;
    }
    return new Map(Array.from({ length: arr.length },
        (v, j) => [`key${j}`, arr[j]]));
}

function getLongValue(i, opt) {
    const min = opt && opt.simpleColLong ?
        BigInt(Number.MIN_SAFE_INTEGER) : LONG_MIN;
    const max = opt && opt.simpleColLong ?
        BigInt(Number.MAX_SAFE_INTEGER) : LONG_MAX;
    return ((i + 1) & 1) ? Number.MIN_SAFE_INTEGER + i * 99 :
        ((i + 1) & 3) ? max - BigInt((i + 1) * 654321) :
            ((i + 1) & 7) ? min + BigInt((i + 1) * 12345) :
                undefined;
}

const ROWS_PER_SHARD = 20;

function makeRowAllTypes(i, rowsPerShard = ROWS_PER_SHARD, opt = null) {
    return {
        [_id]: i,
        [_ttl]: !(i & 1) ? ((i & 2) ? { hours: i + 1 } :
            { days: (i + 1) % 6 }) : undefined,
        shardId: Math.floor(i / rowsPerShard),
        pkString: 'id'.repeat(i % 20).concat(i),
        colBoolean: (i & 1) ? undefined: !(i & 3),
        colInteger: getIntValue(i, opt),
        colLong: getLongValue(i, opt),
        colFloat: (i & 1) ? (1 + 0.0001 * i) * 1e38 : undefined,
        //It looks like Float doesn't handle these now on the server side:
        //NUM_SPECIAL[i % NUM_SPECIAL.length]
        colDouble: (i % rowsPerShard > (rowsPerShard / 2)) ?
            NUM_SPECIAL[i % NUM_SPECIAL.length] :
            (!(i & 3) ? -1 : 1) * 1e-308 * (i + 1) * 0.00012345,
        colNumber: NumberUtils.makeNumber1(i),
        colNumber2: NumberUtils.makeNumber2(i),
        colBinary: (i & 7) ? Buffer.allocUnsafe(((i - 1) * 7) % 256).fill(i) :
            undefined,
        colFixedBinary: Buffer.allocUnsafe(64).fill(`${i}`),
        colEnum: ((i + 2) & 3) ? ALL_TYPES_TABLE.enumColValues[i %
            ALL_TYPES_TABLE.enumColValues.length] : undefined,
        //Do we need to support nanoseconds?
        colTimestamp: ((i+2) & 7) ? new Date(currentTimeMillis +
            (( i & 1) ? -1: 1) * i * 1000000000 + i) : undefined,
        colRecord: (i & 7) ? {
            fldString: (i & 3) ? 'a'.repeat(i % 5) : undefined,
            fldNumber: ((i + 1) & 3) ?
                NumberUtils.asNumber(`${i % 123}.${i}e${i % 299}`) :
                undefined,
            fldArray: ((i + 2) & 3) ? new Array(i % 10).fill(i) : undefined
        } : undefined,
        colArray: ((i + 2) & 7) ? new Array(i % 20).fill(
            new Date(currentTimeMillis + i).toISOString()) : undefined,
        colArray2 : ((i + 3) % 16) ? Array.from({ length: (i % 5) * 3 },
            (v, j) => makeObjectForJSON(i + j)) : undefined,
        colMap : getLongMap(i),
        colMap2: ((i + 5) & 7) ? Object.assign({},
            ...Array.from({ length: i % 10}, (v, j) => ({ ['abc'.repeat(j)]:
            Buffer.allocUnsafe(j).fill(j)}))) : undefined,
        colJSON: makeObjectForJSON(i),
        colJSON2: makeObjectForJSON2(i)
    };
}

let modifyAllTypesSeq = 0;

//For now we don't pass opt, since it is used only in query tests.
function modifyRowAllTypes(row) {
    const seq = ++modifyAllTypesSeq;
    const modifiedRow = Utils.deepCopy(row);
    const row2 = makeRowAllTypes(row[_id] + seq + 20);
    modifiedRow.colBoolean = !row.colBoolean;
    if (modifiedRow.colInteger != null) {
        modifiedRow.colInteger += modifiedRow.colInteger < INT_MAX ? 1 : -1;
    }
    if (typeof modifiedRow.colLong === 'bigint') {
        modifiedRow.colLong += modifiedRow.colLong < LONG_MAX ? 1n : -1n;
    } else if (modifiedRow.colLong != null) {
        modifiedRow.colLong = Math.trunc(modifiedRow.colLong / 3);
    }
    for(let col of [ 'colFloat', 'colDouble', 'colNumber', 'colBinary',
        'colFixedBinary', 'colEnum', 'colTimestamp', 'colRecord', 'colArray',
        'colArray2', 'colMap', 'colMap2', 'colJSON']) {
        modifiedRow[col] = row2[col];
    }
    return modifiedRow;
}

class DataTest {
    constructor(table, makeRow, modifyRow, cnt, start = 0) {
        this.table = table;
        this.makeRow = makeRow;
        this.modifyRow = modifyRow;
        this.rowIdStart = start;
        this.rowIdEnd = start + cnt; //exclusive
        this.rows = new Array(cnt);
        this.byId = new Map();
        for(let i = 0; i < cnt; i++) {
            const row = this.makeRow(start + i);
            this.rows[i] = row;
            //Useful in future for tests with non-continuous range of ids
            this.byId.set(row[_id], row);
        }
        if (table.idFld) {
            this.colIdVal = table.idFld.idVal;
        }
    }

    ptr2id(ptr) {
        if (typeof ptr === 'number') {
            return ptr;
        }
        if (ptr.id != null) {
            return ptr.id;
        }
        if (ptr.fromStart != null) {
            return this.rowIdStart + ptr.fromStart;
        }
        expect(ptr.fromEnd).to.exist;
        return this.rowIdEnd + ptr.fromEnd;
    }

    ptr2row(ptr, returnOriginal = false) {
        const id = this.ptr2id(ptr);
        const row = this.byId.get(id);
        return row ? (returnOriginal ? row : this.modifyRow(row)) :
            this.makeRow(id);
    }

    ptr2pk(ptr) {
        return Utils.makePrimaryKey(this.table, this.ptr2row(ptr, true));
    }

    ptr2version(ptr) {
        return this.ptr2row(ptr, true)[_version];
    }

}

class AllTypesTest extends DataTest {
    constructor(cnt, rowsPerShard = ROWS_PER_SHARD, start = 0, opt = null) {
        super(ALL_TYPES_TABLE, id => makeRowAllTypes(id, rowsPerShard, opt),
            modifyRowAllTypes, cnt, start);
        this.rowsPerShard = rowsPerShard;
    }

    get maxRowKB() { return 4; }

    rowFromShard(shardId, rowIdx = 0) {
        return this.makeRow(this.rowsPerShard * shardId + rowIdx);
    }
}

const GET_TESTS = [
    {
        desc: 'get test 1',
        __proto__: new AllTypesTest(20)
    }
];

const PUT_TESTS = [
    {
        desc: 'put test 1',
        __proto__: new AllTypesTest(10)
    }
];

const DELETE_TESTS = [
    {
        desc: 'delete test 1',
        __proto__: new AllTypesTest(15)
    }
];

const DELETE_RANGE_TESTS = [
    {
        desc: 'delete test 1',
        __proto__: new AllTypesTest(ROWS_PER_SHARD + 8),
        testCases: [
            {
                desc: 'All keys in the shard, no field range',
                key: { shardId: 0 },
                rowIds: new Set(Utils.range(ROWS_PER_SHARD))
            },
            {
                desc: 'One key only, no field range',
                key: { shardId: 0, pkString: 'id1' },
                rowIds: new Set([ 1 ])
            },
            {
                desc: 'One key only, non-existing',
                key: { shardId: 0, pkString: 'nosuchvalue' },
                rowIds: new Set()
            },
            {
                desc: 'Field range, non-existing',
                key: { shardId: 0 },
                fieldRange: {
                    fieldName: 'pkString',
                    startWith: 'nosuchvalue',
                    //endWith: 'nosuchvalueeither'
                    endsWith: 'nosuch'
                },
                rowIds: new Set()
            },
            {
                desc: 'Field range, left and right inclusive',
                key: { shardId: 0 },
                fieldRange: {
                    fieldName: 'pkString',
                    startWith: 'id1',
                    endWith: 'idididididididid8'
                },
                rowIds: new Set(Utils.range(1, 9))
            },
            {
                desc: 'Field range, left, right exclusive',
                key: { shardId: 0 },
                fieldRange: {
                    fieldName: 'pkString',
                    startAfter: 'id1',
                    endBefore: 'idididididididid8'
                },
                rowIds: new Set(Utils.range(2, 8))
            },
            {
                desc: 'Field range, left inclusive, right exclusive',
                key: { shardId: 0 },
                fieldRange: {
                    fieldName: 'pkString',
                    startWith: 'id1',
                    endBefore: 'idididididididid8'
                },
                rowIds: new Set(Utils.range(1, 8))
            },
            {
                desc: 'Field range, left exclusive, right inclusive',
                key: { shardId: 0 },
                fieldRange: {
                    fieldName: 'pkString',
                    startWith: 'id1',
                    endBefore: 'idididididididid8'
                },
                rowIds: new Set(Utils.range(1, 8))
            },
        ]
    }
];

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
                    shouldFail: fromEnd >= 0
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
                    shouldFail: true
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
                    shouldFail: fromEnd >= 0
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
                    shouldFail: fromEnd < 0
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
                    shouldFail: fromStart != 5
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
                    shouldFail: true
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

const queryTest1 = {
    desc: 'query test 1',
    __proto__: new AllTypesTest(20, 100)
};

queryTest1.queries = [
    {
        desc: 'select *, direct execution',
        stmt: 'SELECT * FROM __TABLE__',
        expectedRows: queryTest1.rows,
        unordered: true
    },
    {
        desc: 'selection and projection, direct execution',
        stmt: 'SELECT colInteger, colNumber as numField, colArray, colMap2, \
colJSON FROM __TABLE__ WHERE colBoolean = true ORDER BY shardId, pkString',
        expectedRows: Utils.range(0, 20, 4).map(i => Utils.projectRow(
            queryTest1.makeRow(i), [ 'colInteger',
                { name: 'colNumber', as: 'numField' }, 'colArray',
                'colMap2', 'colJSON'])),
        //it's ok to have extra fields from table in expectedFields since
        //the they will not be present in both expected and returned rows
        expectedFields: queryTest1.table.fields.concat({
            name: 'numField',
            type: 'NUMBER'
        })
    },
    {
        desc: 'select * with bindings',
        stmt: 'DECLARE $fldInt INTEGER; SELECT * FROM __TABLE__ WHERE \
colInteger < $fldInt',
        unordered: true,
        testCases: [
            {
                desc: 'empty result',
                bindings: { $fldInt: -0x80000000 }
            },
            {
                desc: 'has results',
                bindings: { $fldInt: 0x70000000 },
                expectedRows: queryTest1.rows.filter(
                    row => row.colInteger < 0x70000000)
            }
        ]
    },
    {
        desc: 'select columns with bindings',
        stmt: 'DECLARE $fldString STRING; SELECT shardId, pkString FROM \
__TABLE__ t WHERE t.colJSON.x = $fldString',
        unordered: true,
        testCases: [
            {
                desc: 'empty result',
                bindings: { $fldString: 'abc' }
            },
            {
                desc: '17 rows',
                bindings: { $fldString: 'a' },
                expectedRows: Utils.range(0, 20).filter(i => i % 7).map(i => ({
                    shardId: 0,
                    pkString: 'id'.repeat(i % 20).concat(i)
                }))
            }
        ]
    },
    {
        desc: 'update single row',
        stmt: 'DECLARE $fldPKString STRING; $fldDouble DOUBLE; UPDATE \
__TABLE__ t SET t.colDouble = $fldDouble, SET t.colJSON.x = "X" WHERE \
shardId = 0 AND pkString = $fldPKString',
        expectedFields: [ { name: 'NumRowsUpdated', type: 'INTEGER '} ],
        testCases: [
            {
                desc: 'update non-existent row, no updates',
                bindings: {
                    $fldPKString: 'blahblah',
                    $fldDouble: 1.2345e100
                },
                expectedRows: [ { NumRowsUpdated: 0 } ],
            },
            {
                desc: 'update existing row, 1 update',
                bindings: {
                    $fldPKString: 'idid2',
                    $fldDouble: -9873.25e-100
                },
                expectedRows: [ { NumRowsUpdated: 1 } ],
                updatedRows: [
                    Object.assign(Utils.deepCopy(queryTest1.rows[2]), {
                        colDouble: -9873.25e-100,
                        colJSON: Object.assign(makeObjectForJSON(2), {
                            x: 'X'
                        })
                    })
                ]
            }
        ]
    },
    {
        desc: 'update TTL direct',
        stmt: 'UPDATE __TABLE__ $t SET TTL 5 DAYS WHERE shardId = 0 AND \
pkString = "0" RETURNING remaining_days($t) AS remainingDays',
        expectedRows: [ { remainingDays: 5 } ],
        expectedFields: [ { name: 'remainingDays', type: 'INTEGER '} ],
        updateTTL: true,
        updatedRows: [ Object.assign(Utils.deepCopy(queryTest1.rows[0]), {
            [_ttl]: { days: 5 }
        }) ]
    },
    {
        desc: 'insert direct',
        stmt: 'INSERT INTO __TABLE__(shardId, pkString, colInteger, \
colTimestamp) VALUES(10, "new_pk_string1", 1, "1990-01-01")',
        expectedRows: [ { NumRowsInserted: 1 } ],
        expectedFields: [ { name: 'NumRowsInserted', type: 'INTEGER '} ],
        updatedRows: [
            Object.assign(Utils.makeNullRow(ALL_TYPES_TABLE), {
                shardId: 10,
                pkString: 'new_pk_string1',
                colInteger: 1,
                colTimestamp: new Date('1990-01-01')
            })
        ]
    },
    //TODO: the following can be developed into a template to generate many
    //insert testcases by providing different combinations of table.fields
    //indexes (of course primary key fields should always be included)
    (() => {
        const ret = {
            desc: 'insert with bindings',
            stmt: 'DECLARE $shardId INTEGER; $pkString STRING; $colBoolean \
BOOLEAN; $colNumber NUMBER; $colBinary BINARY; $colJSON JSON; INSERT \
INTO __TABLE__(shardId, pkString, colBoolean, colNumber, colBinary, colJSON) \
VALUES($shardId, $pkString, $colBoolean, $colNumber, $colBinary, $colJSON)',
            expectedFields: [ { name: 'NumRowsInserted', type: 'INTEGER '} ]
        };
        const colNames = [ 'shardId', 'pkString', 'colBoolean', 'colNumber',
            'colBinary', 'colJSON' ];
        const newRow = makeRowAllTypes(10000);
        ret.bindings = Object.fromEntries(colNames.map(colName =>
            [ '$' + colName, newRow[colName] ]));
        ret.expectedRows = [ { NumRowsInserted: 1 } ];
        ret.updatedRows = [
            Object.assign(Utils.makeNullRow(ALL_TYPES_TABLE),
                Utils.projectRow(newRow, colNames))
        ];
        return ret;
    })(),
    {
        desc: 'simple delete all',
        stmt: 'DELETE FROM __TABLE__',
        expectedRows: [
            { numRowsDeleted: queryTest1.rows.length }
        ],
        expectedFields: [ { name: 'numRowsDeleted', type: 'LONG'} ],
        updatedRows: Utils.range(queryTest1.rows.length)
    },
    (() => {
        const retCols = [ 'shardId', 'pkString', 'colEnum', 'colMap',
            'colJSON'];
        const ret = {
            desc: 'delete with where and returing',
            stmt: 'DELETE FROM __TABLE__ t WHERE t.colRecord.fldString > \
"a" RETURNING ' + retCols.join(', '),
            unordered: true
        };
        ret.updatedRows = Utils.range(queryTest1.rows.length).filter(i =>
            (i % 4 != 0 && i % 5 >= 2));
        ret.expectedRows = ret.updatedRows.map(i => Utils.projectRow(
            queryTest1.rows[i], retCols));
        return ret;
    })(),
    (() => {
        const ret = {
            desc: 'delete with bindings',
            stmt: 'DECLARE $fldDouble DOUBLE; $fldDate TIMESTAMP; DELETE \
FROM __TABLE__ AS t WHERE t.colDouble = $fldDouble AND t.colArray[] >ANY $fldDate \
RETURNING colFixedBinary',
            expectedFields: [ { name: 'colFixedBinary', type: 'BINARY' } ]
        };
        ret.testCases = [];
        let tc = {
            desc: 'no rows deleted',
            bindings: {
                $fldDouble: 1,
                $fldDate: new Date(currentTimeMillis)
            }
        };
        ret.testCases.push(tc);
        tc = {
            desc: 'all rows with colDouble=Infinity',
            bindings: {
                $fldDouble: Infinity,
                $fldDate: new Date(currentTimeMillis)
            },
            updatedRows: Utils.range(queryTest1.rows.length).filter(i =>
                (i % queryTest1.rowsPerShard > queryTest1.rowsPerShard / 2 &&
                    i % NUM_SPECIAL.length === 0))
        };
        tc.expectedRows = tc.updatedRows.map(i =>
            ({ colFixedBinary: queryTest1.rows[i].colFixedBinary }));
        ret.testCases.push(tc);
        tc = {
            desc: 'all rows with colDouble = NaN and id > 10',
            bindings: {
                $fldDouble: NaN,
                $fldDate: new Date(currentTimeMillis + 10)
            },
            updatedRows: Utils.range(queryTest1.rows.length).filter(i =>
                (i > 10 && i % queryTest1.rowsPerShard >
                    queryTest1.rowsPerShard / 2 &&
                    i % NUM_SPECIAL.length === 2))
        };
        tc.expectedRows = tc.updatedRows.map(i =>
            ({ colFixedBinary: queryTest1.rows[i].colFixedBinary }));
        ret.testCases.push(tc);
        return ret;
    })()
];

const QUERY_TESTS = [ queryTest1 ];

module.exports = {
    AllTypesTest,
    DEFAULT_LOCATION,
    GET_TESTS,
    PUT_TESTS,
    DELETE_TESTS,
    DELETE_RANGE_TESTS,
    WRITE_MANY_TESTS,
    QUERY_TESTS
};
