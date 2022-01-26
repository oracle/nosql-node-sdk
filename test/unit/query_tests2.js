/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

//Continue from data_tests.js - advanced query

const QueryUtils = require('./query_utils');
const AllTypesTest = require('./data_tests').AllTypesTest;

const QUERY_TESTS = require('./query_tests').slice();

const queryTest2 = QUERY_TESTS[1];

const queryTest3 = {
    desc: 'query test 3, generalized sort, group by, distinct',
    __proto__: new AllTypesTest(100, 20)
};

queryTest3.indexes = [
    {
        name: 'recFldArrayIdx',
        fields: [ 'colRecord.fldArray[]' ]
    }
];

//Note that for now we can only reuse testcases from queryTest2 because
//queryTest3 has the same set of rows as queryTest2 (because queryTest2.rows
//is used in the test cases).   This limitation can be removed if needed.

queryTest3.queries = [
    queryTest2.queries[4], //[0]
    queryTest2.queries[5], //[1]
    queryTest2.queries[6], //[2]
    queryTest2.queries[7], //[3]
    queryTest2.queries[8], //[4]
    queryTest2.queries[15], //[5]
    queryTest2.queries[23], //[6]
    queryTest2.queries[24], //[7]
    queryTest2.queries[25], //[8]
    queryTest2.queries[11], //[9]
    {
        desc: '[10] group by shards with array idx, dup elim, all aggr funcs',
        stmt: 'SELECT t.colRecord.fldString, count(t.colBoolean) as aggr1, \
min(t.colInteger) as aggr2, avg(t.colDouble) as aggr3, \
sum(size(t.colRecord.fldArray)) as aggr4, count(*) as aggr5, \
max(t.colNumber2) as aggr6 from __TABLE__ t \
WHERE t.colRecord.fldArray[] <ANY 1000 GROUP BY t.colRecord.fldString',
        unordered: true,
        expectedFields: [
            { name: 'fldString', type: 'STRING' },
            { name: 'aggr1', type: 'INTEGER' },
            { name: 'aggr2', type: 'INTEGER' },
            { name: 'aggr3', type: 'DOUBLE' },
            { name: 'aggr4', type: 'INTEGER' },
            { name: 'aggr5', type: 'INTEGER' },
            { name: 'aggr6', type: 'NUMBER' }
        ],
        expectedRows: QueryUtils.groupBy(
            queryTest3.rows.filter(row => row.colRecord &&
                row.colRecord.fldArray && row.colRecord.fldArray.length),
            [ { as: 'fldString', name: 'colRecord.fldString' } ], [
                { as: 'aggr1', field: 'colBoolean', func: QueryUtils.count },
                { as: 'aggr2', field: 'colInteger', func: QueryUtils.min },
                { as: 'aggr3', field: 'colDouble', func: QueryUtils.avg },
                {
                    as: 'aggr4',
                    field: {
                        args: [ 'colRecord.fldArray' ],
                        expr: args => args[0].length
                    },
                    func: QueryUtils.sum
                },
                { as: 'aggr5', func: QueryUtils.count },
                { as: 'aggr6', field: 'colNumber2', func: QueryUtils.max }
            ])
    },
    {
        desc: '[11] Group by with order by',
        stmt: 'SELECT colEnum, colBoolean, \
sum(colDouble) as aggr1 from __TABLE__ t GROUP BY colEnum, colBoolean \
ORDER BY colBoolean, colEnum',
        expectedFields: [
            { name: 'colEnum', type: 'STRING' },
            { name: 'colBoolean', type: 'BOOLEAN' },
            { name: 'aggr1', type: 'DOUBLE' }
        ],
        expectedRows: QueryUtils.sortRows(QueryUtils.groupBy(queryTest3.rows,
            [ 'colEnum', 'colBoolean' ],
            [ { as: 'aggr1', field: 'colDouble', func: QueryUtils.sum } ]),
        'colBoolean', 'colEnum')
    },
    {
        desc: '[12] Group by non-atomic colJSON',
        stmt: 'SELECT colJSON, max(colTimestamp) as aggr1 from __TABLE__ \
GROUP BY colJSON',
        unordered: true,
        expectedFields: [
            { name: 'colJSON', type: 'JSON' },
            { name: 'aggr1', type: 'TIMESTAMP' }
        ],
        expectedRows: QueryUtils.groupBy(queryTest3.rows, [ 'colJSON' ],
            [ { as: 'aggr1', field: 'colTimestamp', func: QueryUtils.max } ])
    },
    {
        desc: '[13] Group by non-atomic colMap2',
        stmt: 'SELECT colMap2, count(*) as aggr1 from __TABLE__ GROUP BY \
colMap2',
        unordered: true,
        expectedFields: [
            { name: 'colMap2', type: { name: 'MAP', elemType: 'BINARY' } },
            { name: 'aggr1', type: 'INTEGER' }
        ],
        expectedRows: QueryUtils.groupBy(
            queryTest3.rows, [ 'colMap2' ],
            [ { as: 'aggr1', func: QueryUtils.count } ])
    },
    {
        desc: '[14] Group by non-atomic colJSON2, grouping, empty vals',
        stmt: 'SELECT t.colJSON2.z.a.b as gb1, t.colJSON2.y.b as gb2, \
sum(t.colJSON2.x.a) as aggr1, max(t.colLong) as aggr2 FROM __TABLE__ t \
GROUP BY t.colJSON2.z.a.b, t.colJSON2.y.b',
        unordered: true,
        expectedFields: [
            { name: 'gb1', type: 'JSON' },
            { name: 'gb2', type: 'JSON' },
            { name: 'aggr1', type: 'INTEGER' },
            { name: 'aggr2', type: 'LONG' }
        ],
        expectedRows: QueryUtils.groupBy(queryTest3.rows, [
            { as: 'gb1', name: 'colJSON2.z.a.b' },
            { as: 'gb2', name: 'colJSON2.y.b' }
        ], [
            { as: 'aggr1', field: 'colJSON2.x.a', func: QueryUtils.sum },
            { as: 'aggr2', field: 'colLong', func: QueryUtils.max }
        ])
    },
    queryTest2.queries[26], //[15] distinct
    queryTest2.queries[27], //[16] distinct
    queryTest2.queries[28], //[17] distinct
    {
        desc: '[18] Same as queryTest2.queries[16] but also with order by',
        stmt: 'DECLARE $off INTEGER; $lim INTEGER; \
SELECT t.colRecord.fldString, max(t.colArray[0]) as aggr1, sum(t.colJSON.y) \
as aggr2 from __TABLE__ t GROUP BY t.colRecord.fldString ORDER BY \
t.colRecord.fldString DESC LIMIT $lim OFFSET $off',
        expectedFields: [
            { name: 'fldString', type: 'STRING' },
            { name: 'aggr1', type: 'TIMESTAMP' },
            { name: 'aggr2', type: 'INTEGER' }
        ],
        testCases: queryTest2.makeTestCasesForOffLim(QueryUtils.groupBy(
            queryTest2.rows,
            [ { as: 'fldString', name: 'colRecord.fldString' } ],
            [
                { as: 'aggr1', field: 'colArray[0]', func: QueryUtils.max },
                { as: 'aggr2', field: 'colJSON.y', func: QueryUtils.sum }
            ]).reverse())
    },
    {
        desc: '[19] Distinct with non-atomic values, test EMPTY',
        stmt: 'SELECT DISTINCT t.colJSON2.z as col1, t.colMap2 as col2, \
t.colJSON2.y as col3 FROM __TABLE__ t',
        unordered: true,
        expectedFields: [
            { name: 'col1', type: 'JSON' },
            { name: 'col2', type: { name: 'MAP', elemType: 'BINARY '} },
            { name: 'col3', type: 'JSON' }
        ],
        expectedRows: QueryUtils.distinct(queryTest3.rows, [
            { as: 'col1', name: 'colJSON2.z' },
            { as: 'col2', name: 'colMap2' },
            { as: 'col3', name: 'colJSON2.y'}
        ])
    }
];

QUERY_TESTS.push(queryTest3);

const queryTest4 = {
    desc: 'query test 4, test memory consumption functionality',
    __proto__: new AllTypesTest(100, 20)
};

queryTest4.indexes = queryTest3.indexes.concat([
    {
        name: 'array2JsonYIdx',
        fields: [ 'colArray2[].y as INTEGER' ]
    }
]);

queryTest4.queries = [
    Object.assign({
        maxMemFail: 10000,
        maxMem: 200000
    }, queryTest2.queries[0]), //[0] ALL_PARTITIONS query
    Object.assign({
        maxMemFail: 1000,
        maxMem: 10000
    }, queryTest2.queries[9]), //[1] duplicate elimination
    Object.assign({
        maxMemFail: 100000,
        maxMem: 300000
    }, queryTest2.queries[4]), //[2] sorting, no index
    Object.assign({
        maxMemFail: 100000,
        maxMem: 300000
    }, queryTest2.queries[25]), //[3] sorting, by json fields, no index
    Object.assign({
        maxMemFail: 400,
        maxMem: 2000
    }, queryTest2.queries[11]), //[4] group by, no index
    Object.assign({
        maxMemFail: 1500,
        maxMem: 4000
    }, queryTest3.queries[13]), //[5] group by non-atomic column, no index
    Object.assign({
        maxMemFail: 2000,
        maxMem: 6000
    }, queryTest3.queries[10]), //[6] group by (no index) with dup elim
    Object.assign({
        maxMemFail: 500,
        maxMem: 2000
    }, queryTest3.queries[11]) //[7] group by with order by, no index
];

//Note that because success or failure of this test may depend on the memory
//values specified for each query, we don't include this test into the test
//suite by default.  If there are changes to records for AllTypesTest, these
//values may have to be adjusted.

if (QueryUtils.getArgVal('--test-index') != null ||
    QueryUtils.getArgVal('--query-memory-test')) {
    QUERY_TESTS.push(queryTest4);
}

module.exports = QUERY_TESTS;
