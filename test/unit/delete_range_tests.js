/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const Utils = require('./query_utils');
const AllTypesTest = require('./data_tests').AllTypesTest;
const ROWS_PER_SHARD = require('./data_tests').ROWS_PER_SHARD;

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

module.exports = DELETE_RANGE_TESTS;
