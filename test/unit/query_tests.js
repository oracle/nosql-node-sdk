/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

//Continue from data_tests.js - advanced query

const QueryUtils = require('./query_utils');
const NumberUtils = require('./number_utils');
const ALL_TYPES_TABLE = require('./test_schemas').ALL_TYPES_TABLE;
const AllTypesTest = require('./data_tests').AllTypesTest;
const QUERY_TESTS = require('./data_tests').QUERY_TESTS;
const DEFAULT_LOCATION = require('./data_tests').DEFAULT_LOCATION;

const untypedJsonIdx = QueryUtils.getArgVal('--test-untyped-json-index',
    true);

const queryTest2 = {
    desc: 'query test 2, advanced queries',
    __proto__: new AllTypesTest(100, 20)
};

//For secondary indexes, we use colIden to give unique sort order.
ALL_TYPES_TABLE.indexes = [
    {
        name: 'idenIdx',
        fields: [ 'colIden' ]
    },
    {
        name: 'tsIdenIdx',
        fields: [ 'colTimestamp', 'colIden' ]
    },
    {
        name: 'recFldStrIdx',
        fields: [ 'colRecord.fldString' ]
    },
    {
        name: 'recFldStrIdenIdx',
        fields: [ 'colRecord.fldString', 'colIden' ]
    },
    {
        name: 'array2JsonYIdx',
        fields: [ 'colArray2[].y as INTEGER' ]
    },
    {
        name: 'enumIdx',
        fields: [ 'colEnum' ]
    },
    {
        name: 'jsonLocIdx',
        fields: [ 'colJSON.location as point' ]
    },
    {
        name: 'jsonXzbIdx',
        fields: [ 'colJSON.x as STRING', 'colJSON.z as STRING',
            'colJSON.b as BOOLEAN' ]
    },
    {
        name: 'numIdx',
        fields: [ 'colNumber' ]
    },
    {
        name: 'num2IdenIdx',
        fields: [ 'colNumber2', 'colIden' ]
    }
];

if (untypedJsonIdx) {
    ALL_TYPES_TABLE.indexes.push({
        name: 'jsonUIdenIdx',
        fields: [ 'colJSON.u as anyAtomic', 'colIden' ]
    }, {
        name: 'jsonXuzIdenIdx',
        fields: [ 'colJSON.x as anyAtomic', 'colJSON.u as anyAtomic',
            'colJSON.z as STRING', 'colIden' ]
    });
}

//find interesting offset-limit cases based on total number of results
function makeOffLim(cnt) {
    return [
        [ 0, cnt ],
        [ Math.round(cnt / 3), Math.round(cnt / 2) ],
        [ Math.round(cnt / 2), Math.round(cnt / 3) ],
        [ 0, 0 ],
        [ Math.round(cnt / 3), 0 ],
        [ 1, cnt - 1 ],
        [ cnt, 5 ],
        [ cnt * 10, 2 ],
        [ cnt - 1, cnt * 100 ]
    ];
}

function makeTestCasesForOffLim(expRows) {
    const testCases = [];
    const offLim = makeOffLim(expRows.length);
    for(let pair of offLim) {
        const off = pair[0];
        const lim = pair[1];
        testCases.push({
            desc: `Offset = ${off}, Limit = ${lim}`,
            bindings: {
                $off: off,
                $lim: lim
            },
            expectedRows: expRows.slice(off, off + lim)
        });
    }
    return testCases;
}

queryTest2.queries = [
    {
        desc: 'order by PK descending, select *, direct execution',
        stmt: 'SELECT * FROM __TABLE__ ORDER BY shardId DESC, pkString DESC',
        expectedRows: QueryUtils.sortRows(queryTest2.rows, 'shardId',
            'pkString').reverse()
    },
    (() => {
        const cols = [ 'colInteger', 'colNumber', 'colBoolean', 'colJSON',
            'colBinary', 'colArray' ];
        const ret = {
            desc: 'order by PK, projection, bindings for limit and offset',
            stmt: `DECLARE $off INTEGER; $lim INTEGER; SELECT \
${cols.join(', ')} FROM __TABLE__ ORDER BY shardId, pkString LIMIT $lim \
OFFSET $off`
        };
        const expRows = QueryUtils.projectRows(
            QueryUtils.sortRows(queryTest2.rows, 'shardId', 'pkString'),
            cols);
        ret.testCases = makeTestCasesForOffLim(expRows);
        return ret;
    })(),
    {
        desc: 'order by PK with expressions',
        stmt: 'SELECT shardId, pkString, colInteger + colLong as expr1, \
colDouble - colFloat as expr2 FROM __TABLE__ ORDER BY shardId, pkString',
        expectedRows: QueryUtils.projectRows(QueryUtils.sortRows(
            queryTest2.rows, 'shardId', 'pkString'), 'shardId', 'pkString',
        {
            as: 'expr1',
            args: [ 'colInteger', 'colLong' ],
            expr: args => args[0] + args[1]
        },
        {
            as: 'expr2',
            args: [ 'colDouble', 'colFloat' ],
            expr: args => args[0] - args[1]
        }),
        expectedFields: queryTest2.table.fields.slice(0, 2).concat(
            { name: 'expr1', type: 'LONG' },
            //we use FLOAT below because the overall precision of the
            //expression will be that of float, not double
            { name: 'expr2', type: 'FLOAT' })
    },
    {
        desc: 'order by PK with expressions',
        stmt: 'SELECT shardId, pkString, colInteger + colLong as expr1, \
colDouble * 1.2345 as expr2 FROM __TABLE__ ORDER BY shardId, pkString',
        expectedRows: QueryUtils.projectRows(QueryUtils.sortRows(
            queryTest2.rows, 'shardId', 'pkString'), 'shardId', 'pkString',
        {
            as: 'expr1',
            args: [ 'colInteger', 'colLong' ],
            expr: args => args[0] + args[1]
        },
        {
            as: 'expr2',
            args: [ 'colDouble' ],
            expr: args => args[0] * 1.2345
        }),
        expectedFields: queryTest2.table.fields.slice(0, 2).concat(
            { name: 'expr1', type: 'LONG' },
            { name: 'expr2', type: 'DOUBLE' })
    },
    {
        desc: 'select *, order by colIden idx descending',
        stmt: 'SELECT * FROM __TABLE__ ORDER BY colIden DESC',
        expectedRows: QueryUtils.sortRows(queryTest2.rows,
            queryTest2.colIdVal).reverse()
    },
    {
        desc: 'select expr order by colTimestamp, colIden',
        stmt: 'SELECT t.colRecord.fldNumber + t.colFloat as expr1 FROM \
__TABLE__ t ORDER BY colTimestamp, colIden',
        expectedRows: QueryUtils.projectRows(QueryUtils.sortRows(
            queryTest2.rows, 'colTimestamp', queryTest2.colIdVal), {
            as: 'expr1',
            args: [ 'colRecord.fldNumber', 'colFloat' ],
            expr: args => NumberUtils.add(args[0], args[1])
        }),
        expectedFields: [
            {
                name: 'expr1',
                type: {
                    name: 'NUMBER',
                    precision: NumberUtils.FLOAT_PRECISION,
                    roundingDelta: 1
                }
            }
        ]
    },
    (() => {
        const cols = [ 'colArray2', 'colNumber', 'colEnum',
            'colBinary', 'colMap' ];
        const ret = {
            desc: 'order by colRecord.fldString, colIden, \
projection, bindings for limit and offset',
            stmt: `DECLARE $off INTEGER; $lim INTEGER; SELECT \
${cols.join(', ')} FROM __TABLE__ t ORDER BY t.colRecord.fldString, \
t.colIden LIMIT $lim OFFSET $off`
        };
        const expRows = QueryUtils.projectRows(
            QueryUtils.sortRows(queryTest2.rows, 'colRecord.fldString',
                queryTest2.colIdVal),
            cols);
        ret.testCases = makeTestCasesForOffLim(expRows);
        return ret;
    })(),
    (() => {
        const cols = [ 'colArray2', 'colNumber', 'colEnum',
            'colBinary', 'colMap' ];
        const ret = {
            desc: 'order by colRecord.fldString, colIden descending, \
projection, bindings for limit and offset',
            stmt: `DECLARE $off INTEGER; $lim INTEGER; SELECT \
${cols.join(', ')} FROM __TABLE__ t ORDER BY t.colRecord.fldString DESC, \
t.colIden DESC LIMIT $lim OFFSET $off`
        };
        const expRows = QueryUtils.projectRows(
            QueryUtils.sortRows(queryTest2.rows, 'colRecord.fldString',
                queryTest2.colIdVal).reverse(),
            cols);
        ret.testCases = makeTestCasesForOffLim(expRows);
        return ret;
    })(),
    {
        desc: 'aggregates, no group by',
        stmt: 'SELECT max(pkString) as aggr1, min(colDouble) as aggr2, \
avg(colInteger) as aggr3 from __TABLE__',
        expectedRows: [ {
            aggr1: QueryUtils.max(queryTest2.rows, 'pkString'),
            aggr2: QueryUtils.min(queryTest2.rows, 'colDouble'),
            aggr3: QueryUtils.avg(queryTest2.rows, 'colInteger')
        } ],
        expectedFields: [
            { name: 'aggr1', type: 'STRING' },
            { name: 'aggr2', type: 'DOUBLE' },
            { name: 'aggr3', type: 'FLOAT' }
        ]
    },
    {
        desc: 'array index, duplicate elimination, select *, bindings',
        stmt: 'DECLARE $y INTEGER; SELECT * FROM __TABLE__ t WHERE \
t.colArray2.y >=ANY $y',
        unordered: true,
        testCases: [ 20, 100, 1000 ].map(y => ({
            bindings: { $y: y },
            expectedRows: queryTest2.rows.filter(row =>
                row.colArray2 != null &&
                row.colArray2.findIndex(v => v && v.y >= y) != -1)
        }))
    },
    {
        desc: 'simple group by partitions',
        stmt: 'SELECT shardId, max(pkString) as aggr1, sum(colInteger) as \
aggr2 FROM __TABLE__ GROUP BY shardId',
        expectedFields: [
            { name: 'shardId', type: 'INTEGER' },
            { name: 'aggr1', type: 'STRING' },
            { name: 'aggr2', type: 'INTEGER' }
        ],
        expectedRows: QueryUtils.groupBy(queryTest2.rows, [ 'shardId' ], [
            { as: 'aggr1', name: 'pkString', func: QueryUtils.max },
            { as: 'aggr2', name: 'colInteger', func: QueryUtils.sum }
        ])
    },
    {
        desc: 'simple group by shards',
        stmt: 'SELECT t.colRecord.fldString, count(*) as aggr1, \
min(t.colInteger) as aggr2, avg(t.colDouble) as aggr3, \
sum(t.colRecord.fldNumber) as aggr4 from __TABLE__ t GROUP BY \
t.colRecord.fldString',
        expectedFields: [
            { name: 'fldString', type: 'STRING' },
            { name: 'aggr1', type: 'INTEGER' },
            { name: 'aggr2', type: 'INTEGER' },
            { name: 'aggr3', type: 'DOUBLE' },
            {
                name: 'aggr4',
                type: {
                    name: 'NUMBER',
                    roundingDelta: 1
                }
            }
        ],
        expectedRows: QueryUtils.groupBy(queryTest2.rows,
            [ { as: 'fldString', name: 'colRecord.fldString' } ], [
                { as: 'aggr1', func: QueryUtils.count },
                { as: 'aggr2', name: 'colInteger', func: QueryUtils.min },
                { as: 'aggr3', name: 'colDouble', func: QueryUtils.avg },
                { as: 'aggr4', name: 'colRecord.fldNumber',
                    func: QueryUtils.sum }
            ])
    },
    {
        desc: 'geo_near with select *',
        stmt: `SELECT * FROM __TABLE__ t WHERE geo_near(t.colJSON.location, \
${JSON.stringify(DEFAULT_LOCATION)}, 50000)`,
        expectedRows: QueryUtils.geoNear(queryTest2.rows, 'colJSON.location',
            DEFAULT_LOCATION, 50000)
    },
    {
        desc: 'geo_within_distance order by PK',
        stmt: `SELECT t.colJSON.location.coordinates AS coordinates FROM \
__TABLE__ t WHERE geo_within_distance(t.colJSON.location, \
${JSON.stringify(DEFAULT_LOCATION)}, 100000) ORDER BY shardId, pkString`,
        expectedFields: [
            {
                name: 'coordinates',
                type: {
                    name: 'ARRAY',
                    elemType: 'DOUBLE'
                }
            }
        ],
        expectedRows: QueryUtils.projectRows(QueryUtils.sortRows(
            QueryUtils.geoWithinDistance(queryTest2.rows, 'colJSON.location',
                DEFAULT_LOCATION, 100000), 'shardId', 'pkString'),
        { as: 'coordinates', name: 'colJSON.location.coordinates' })
    },
    {
        desc: 'geo_near with bindings',
        stmt: 'DECLARE $loc JSON; $dist DOUBLE; SELECT t.pkString, t.colMap2, \
t.colArray2, t.colJSON.location as location FROM __TABLE__ t WHERE geo_near(\
t.colJSON.location, $loc, $dist)',
        expectedFields: queryTest2.table.fields.concat({
            name: 'location',
            type: 'JSON'
        }),
        testCases: [
            [ DEFAULT_LOCATION, 20000 ],
            [ DEFAULT_LOCATION, 0 ], //empty case, no distance
            [ QueryUtils.geoDestination(DEFAULT_LOCATION, 1000000, 180),
                50000], //empty case, destination too far
            [ DEFAULT_LOCATION, 1000000 ],
            //should be all records
            [ DEFAULT_LOCATION, queryTest2.rows.length * 20000 ]
        ].map(args => ({
            bindings: {
                $loc: args[0],
                $dist: args[1]
            },
            expectedRows: QueryUtils.projectRows(QueryUtils.geoNear(
                queryTest2.rows, 'colJSON.location', ...args), 'pkString',
            'colMap2', 'colArray2', {
                as: 'location',
                name: 'colJSON.location'
            })
        }))
    },
    {
        desc: 'group by JSON fields, test EMPTY',
        stmt: 'SELECT sum(t.colJSON.y) as aggr1, t.colJSON.b as col2 FROM \
__TABLE__ t GROUP BY t.colJSON.x, t.colJSON.z, t.colJSON.b',
        expectedFields: [
            { name: 'aggr1', type: 'INTEGER' },
            { name: 'col2', type: 'BOOLEAN' }
        ],
        expectedRows: QueryUtils.projectRows(QueryUtils.groupBy(
            queryTest2.rows, [ 'colJSON.x', 'colJSON.z',
                { name: 'colJSON.b', as: 'col2' }],
            [ { as: 'aggr1', name: 'colJSON.y', func: QueryUtils.sum } ]),
        'aggr1', 'col2')
    },
    {
        desc: 'group by shards with offset and limit, bindings',
        stmt: 'DECLARE $off INTEGER; $lim INTEGER; \
SELECT t.colRecord.fldString, max(t.colArray[0]) as aggr1, sum(t.colJSON.y) \
as aggr2 from __TABLE__ t GROUP BY t.colRecord.fldString \
LIMIT $lim OFFSET $off',
        expectedFields: [
            { name: 'fldString', type: 'STRING' },
            { name: 'aggr1', type: 'TIMESTAMP' },
            { name: 'aggr2', type: 'INTEGER' }
        ],
        testCases: makeTestCasesForOffLim(QueryUtils.groupBy(
            queryTest2.rows,
            [ { as: 'fldString', name: 'colRecord.fldString' } ],
            [
                { as: 'aggr1', name: 'colArray[0]', func: QueryUtils.max },
                { as: 'aggr2', name: 'colJSON.y', func: QueryUtils.sum }
            ]))
    },
    //number-related queries
    {
        desc: 'number averages, total',
        stmt: 'SELECT avg(colNumber) AS aggr1, avg(colNumber2) AS aggr2 FROM \
__TABLE__',
        expectedFields: [
            {
                name: 'aggr1',
                type: {
                    name: 'NUMBER',
                    roundingDelta: queryTest2.rows.length,
                    useDP: true
                }
            },
            {
                name: 'aggr2',
                type: {
                    name: 'NUMBER',
                    roundingDelta: queryTest2.rows.length,
                    useDP: true
                }
            }
        ],
        expectedRows: [ {
            aggr1: QueryUtils.avg(queryTest2.rows, 'colNumber'),
            aggr2: QueryUtils.avg(queryTest2.rows, 'colNumber2')
        } ]
    },
    {
        desc: 'number sum, min, max, group by partitions',
        stmt: 'SELECT shardId, sum(colNumber) AS aggr1, min(colNumber) \
AS aggr2, sum(colNumber2) AS aggr3, max(colNumber2) AS aggr4 FROM __TABLE__ \
GROUP BY shardId',
        expectedFields: [
            { name: 'shardId', type: 'INTEGER' },
            ...Array.from({ length: 4 }, (x, i) => ({
                name: 'aggr' + (i + 1),
                type: {
                    name: 'NUMBER',
                    roundingDelta: (i & 1) ? 0 : queryTest2.rowsPerShard
                }
            })) ],
        expectedRows: QueryUtils.groupBy(queryTest2.rows, [ 'shardId' ], [
            { as: 'aggr1', name: 'colNumber', func: QueryUtils.sum },
            { as: 'aggr2', name: 'colNumber', func: QueryUtils.min },
            { as: 'aggr3', name: 'colNumber2', func: QueryUtils.sum },
            { as: 'aggr4', name: 'colNumber2', func: QueryUtils.max }
        ])
    },
    {
        desc: 'driver-side expressions, group by partitions',
        stmt: 'SELECT shardId, min(colNumber) + min(colNumber2) AS aggr1, \
max(colNumber) - max(colNumber2) AS aggr2, min(colNumber) * max(colNumber) \
AS aggr3, sum(colNumber2) / sum(colNumber) AS aggr4 FROM __TABLE__ GROUP BY \
shardId',
        expectedFields: [
            { name: 'shardId', type: 'INTEGER' },
            ...Array.from({ length: 4 }, (x, i) => ({
                name: 'aggr' + (i + 1),
                type: {
                    name: 'NUMBER',
                    roundingDelta: i < 3 ? 1 : queryTest2.rowsPerShard + 1,
                    useDP: i === 3
                }
            })) ],
        expectedRows: QueryUtils.groupBy(queryTest2.rows, [ 'shardId' ], [
            {
                as: 'aggr1',
                name: [ 'colNumber', 'colNumber2' ],
                func: (rows, fields) =>
                    NumberUtils.add(QueryUtils.min(rows, fields[0]),
                        QueryUtils.min(rows, fields[1]))
            },
            {
                as: 'aggr2',
                name: [ 'colNumber', 'colNumber2' ],
                func: (rows, fields) =>
                    NumberUtils.sub(QueryUtils.max(rows, fields[0]),
                        QueryUtils.max(rows, fields[1]))
            },
            {
                as: 'aggr3',
                name: 'colNumber',
                func: (rows, field) =>
                    NumberUtils.mul(QueryUtils.min(rows, field),
                        QueryUtils.max(rows, field))
            },
            {
                as: 'aggr4',
                name: [ 'colNumber2', 'colNumber' ],
                func: (rows, fields) =>
                    NumberUtils.div(QueryUtils.sum(rows, fields[0]),
                        QueryUtils.sum(rows, fields[1]))
            },
        ])
    },
    {
        desc: 'driver-side expressions, group by shards',
        stmt: 'SELECT t.colRecord.fldString, \
sum(colNumber) / (sum(colNumber) + sum(colNumber2)) AS aggr1 FROM \
__TABLE__ t GROUP BY t.colRecord.fldString',
        expectedFields: [
            {
                name: 'fldString',
                type: 'STRING'
            },
            {
                name: 'aggr1',
                type: {
                    name: 'NUMBER',
                    roundingDelta: 6,
                    useDP: true
                }
            }
        ],
        expectedRows: QueryUtils.groupBy(queryTest2.rows,
            [ { as: 'fldString', name: 'colRecord.fldString' } ], [ {
                as: 'aggr1',
                name: [ 'colNumber', 'colNumber2' ],
                func: (rows, fields) =>
                    NumberUtils.div(QueryUtils.sum(rows, fields[0]),
                        NumberUtils.add(QueryUtils.sum(rows, fields[0]),
                            QueryUtils.sum(rows, fields[1])))
            } ])
    },
    {
        desc: 'select * order by number column',
        stmt: 'SELECT * FROM __TABLE__ ORDER BY colNumber2, colIden',
        expectedRows: QueryUtils.sortRows(queryTest2.rows, 'colNumber2',
            'colIden')
    },
    {
        desc: 'group by number column',
        stmt: 'SELECT colNumber, avg(colNumber2) AS aggr1 FROM \
__TABLE__ GROUP BY colNumber',
        expectedFields: [
            {
                name: 'colNumber',
                type: 'NUMBER'
            },
            {
                name: 'aggr1',
                type: {
                    name: 'NUMBER',
                    roundingDelta: 100,
                    useDP: true
                }
            }
        ],
        expectedRows: QueryUtils.groupBy(queryTest2.rows, [ 'colNumber' ], [
            { as: 'aggr1', name: 'colNumber2', func: QueryUtils.avg }
        ])
    }
];

if (untypedJsonIdx) {
    queryTest2.queries.push({
        desc: 'select * order by colJSON.u untyped index',
        stmt: 'SELECT * FROM __TABLE__ t ORDER BY t.colJSON.u, t.colIden',
        expectedRows: QueryUtils.sortRows(queryTest2.rows, 'colJSON.u',
            'colIden')
    }, {
        desc: 'select from order by colJSON x,u,z untyped index',
        stmt: 'SELECT t.colJSON.y FROM __TABLE__ t ORDER BY t.colJSON.x, \
t.colJSON.u, t.colJSON.z, colIden',
        expectedRows: QueryUtils.projectRows(QueryUtils.sortRows(
            queryTest2.rows, 'colJSON.x', 'colJSON.u', 'colJSON.z',
            'colIden'), 'colJSON.y')
    }, {
        desc: 'select * order by colJSON x,u,z untyped index',
        stmt: 'SELECT * FROM __TABLE__ t ORDER BY t.colJSON.x, \
t.colJSON.u, t.colJSON.z, colIden',
        expectedRows: QueryUtils.sortRows(
            queryTest2.rows, 'colJSON.x', 'colJSON.u', 'colJSON.z',
            'colIden')
    });
}

QUERY_TESTS.push(queryTest2);

module.exports = QUERY_TESTS;
