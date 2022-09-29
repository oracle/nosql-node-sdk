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
const ALL_TYPES_TABLE = require('./test_schemas').ALL_TYPES_TABLE;
const ALL_TYPES_CHILD_TABLE = require('./test_schemas').ALL_TYPES_CHILD_TABLE;

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

//For now using a simple model with fixed number of child rows per parent.
const CHILD_ROWS_PER_PARENT = 3;

function makeChildRowAllTypes(j, rowsPerShard = ROWS_PER_SHARD) {
    //id of corresponding parent row
    const i = Math.floor(j / CHILD_ROWS_PER_PARENT);
    return {
        [_id]: j,
        shardId: Math.floor(i / rowsPerShard),
        pkString: 'id'.repeat(i % 20).concat(i),
        childId: j,
        colNumber: NumberUtils.makeNumber1(j + 100),
        colJSON: makeObjectForJSON(j + 1002)
    };
}

function modifyChildRowAllTypes(row) {
    const seq = ++modifyAllTypesSeq;
    const modifiedRow = Utils.deepCopy(row);
    const row2 = makeChildRowAllTypes(row[_id] + seq + 20);
    modifiedRow.colNumber = row2.colNumber;
    modifiedRow.colJSON = row2.colJSON;
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

    isMultiTable() {
        return false;
    }

    getTest() { //overriden in AllTypesWithChildTableTest
        return this;
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

class AllTypesChildTableTest extends DataTest {
    constructor(cnt, rowsPerShard = ROWS_PER_SHARD, start = 0) {
        super(ALL_TYPES_CHILD_TABLE,
            id => makeChildRowAllTypes(id, rowsPerShard),
            modifyChildRowAllTypes, cnt, start);
    }
}

class AllTypesWithChildTableTest extends AllTypesTest {
    constructor(cnt, rowsPerShard = ROWS_PER_SHARD, start = 0, opt = null) {
        super(cnt, rowsPerShard, start, opt);
        this.child = new AllTypesChildTableTest(cnt * CHILD_ROWS_PER_PARENT,
            rowsPerShard, start * CHILD_ROWS_PER_PARENT);
    }

    getTest(tableName) {
        if (tableName == null || tableName === ALL_TYPES_TABLE.name) {
            return this;
        }
        //test self-check
        expect(tableName).to.equal(ALL_TYPES_CHILD_TABLE.name);
        return this.child;
    }

    //In future, we may customize this per test case.
    isMultiTable() {
        return true;
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

module.exports = {
    AllTypesTest,
    AllTypesWithChildTableTest,
    makeObjectForJSON,
    makeRowAllTypes,
    makeChildRowAllTypes,
    modifyChildRowAllTypes,
    NUM_SPECIAL,
    currentTimeMillis,
    ROWS_PER_SHARD,
    DEFAULT_LOCATION,
    GET_TESTS,
    PUT_TESTS,
    DELETE_TESTS
};
