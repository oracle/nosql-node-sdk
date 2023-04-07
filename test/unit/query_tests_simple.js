/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const _ttl = require('./common')._ttl;
const Utils = require('./query_utils');
const ALL_TYPES_TABLE = require('./test_schemas').ALL_TYPES_TABLE;
const AllTypesTest = require('./data_tests').AllTypesTest;
const makeObjectForJSON = require('./data_tests').makeObjectForJSON;
const makeRowAllTypes = require('./data_tests').makeRowAllTypes;
const NUM_SPECIAL = require('./data_tests').NUM_SPECIAL;
const currentTimeMillis = require('./data_tests').currentTimeMillis;

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
        isUpdate: true,
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
        isUpdate: true,
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
        isUpdate: true,
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
            expectedFields: [ { name: 'NumRowsInserted', type: 'INTEGER '} ],
            isUpdate: true
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
        isUpdate: true,
        updatedRows: Utils.range(queryTest1.rows.length)
    },
    (() => {
        const retCols = [ 'shardId', 'pkString', 'colEnum', 'colMap',
            'colJSON'];
        const ret = {
            desc: 'delete with where and returing',
            stmt: 'DELETE FROM __TABLE__ t WHERE t.colRecord.fldString > \
"a" RETURNING ' + retCols.join(', '),
            unordered: true,
            isUpdate: true,
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
            expectedFields: [ { name: 'colFixedBinary', type: 'BINARY' } ],
            isUpdate: true,
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

module.exports = QUERY_TESTS;
