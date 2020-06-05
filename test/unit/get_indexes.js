/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;
const badMillis = require('./common').badMillis;
const badStrings = require('./common').badStrings;
const badOptions = require('./common').badOptions;
const badTblNames = require('./common').badTblNames;
const Utils = require('./utils');
const GET_INDEXES_TESTS = require('./test_schemas').GET_INDEXES_TESTS;

const compartment = Utils.config.compartment;

function verifyIndexes(res, idx) {
    if (Array.isArray(idx)) {
        expect(res).to.be.an('array');
        expect(res.length).to.equal(idx.length);
        //make sure indexes are in the same order by index name
        idx.sort((v1, v2) => { return v1.name > v2.name ? 1 : -1; });
        res.sort((v1, v2) => { return v1.indexName >
            v2.indexName ? 1 : -1; });
        for(let i = 0; i < idx.length; i++) {
            verifyIndexes(res[i], idx[i]);
        }
        return;
    }
    expect(res.indexName).to.equal(idx.name);
    expect(res.fields).to.deep.equal(idx.fields);
}

function testGetIndexes(client, tbl, idxs) {
    //Negative tests
    for(let badTblName of badTblNames) {
        it(`getIndexes with invalid table name: ${util.inspect(badTblName)}`,
            async function() {
                return expect(client.getIndexes(badTblName)).to.be
                    .rejectedWith(NoSQLArgumentError);
            });
    }

    const badOpts = [
        ...badOptions,
        ...badMillis.map(timeout => ({ timeout})),
        ...badStrings.map(indexName => ({ indexName }))
    ];
    for(let badOpt of badOpts) {
        it(`getIndexes on table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.getIndexes(tbl.name, badOpt)).to.be
                .rejectedWith(NoSQLArgumentError);
        });
    }

    //Test with non-existent table
    it('getIndexes on non-existent table', async function() {
        return expect(client.getIndexes('nosuchtable')).to.eventually.be
            .rejected.and.satisfy(err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    //Positive tests
    it(`getIndexes on table ${tbl.name}`, async function() {
        const res = await client.getIndexes(tbl.name);
        verifyIndexes(res, idxs);
    });

    it(`getIndexes on table ${tbl.name} with timeout`, async function() {
        const res = await client.getIndexes(tbl.name, {
            timeout: 8000,
            compartment
        });
        verifyIndexes(res, idxs);
    });

    it(`getIndexes on table ${tbl.name} with index name ${idxs[0].name}`,
        async function() {
            const res = await client.getIndexes(tbl.name,
                { indexName: idxs[0].name });
            verifyIndexes(res, [ idxs[0] ]);
        });
}

function testGetIndex(client, tbl, idx) {
    //Negative tests
    for(let badTblName of badTblNames) {
        it(`getIndex with invalid table name: ${util.inspect(badTblName)}`,
            async function() {
                return expect(client.getIndex(badTblName, idx.name)).to.be
                    .rejectedWith(NoSQLArgumentError);
            });
    }

    for(let badIdxName of badTblNames) {
        it(`getIndex with invalid index name: ${util.inspect(badIdxName)}`,
            async function() {
                return expect(client.getIndex(tbl.name, badIdxName)).to.be
                    .rejectedWith(NoSQLArgumentError);
            });
    }

    const badOpts = [
        ...badOptions,
        ...badMillis.map(timeout => ({ timeout})),
    ];
    for(let badOpt of badOpts) {
        it(`getIndex on table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.getIndex(tbl.name, idx.name, badOpt)).to.be
                .rejectedWith(NoSQLArgumentError);
        });
    }

    //Test with non-existent table
    it('getIndex on non-existent table', async function() {
        return expect(client.getIndex('nosuchtable', idx.name)).to.eventually
            .be.rejected.and.satisfy(err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    //Test with non-existent index
    it(`getIndex on table ${tbl.name} with non-existent index name`,
        async function() {
            return expect(client.getIndex(tbl.name, 'nosuchindex')).to
                .eventually.be.rejected.and.satisfy(err =>
                    err instanceof NoSQLError &&
                    err.errorCode == ErrorCode.INDEX_NOT_FOUND);
        });

    //Positive tests
    it(`getIndex ${idx.name} on table ${tbl.name}`, async function() {
        const res = await client.getIndex(tbl.name, idx.name);
        verifyIndexes(res, idx);
    });

    it(`getIndex ${idx.name} on table ${tbl.name} with timeout`,
        async function() {
            const res = await client.getIndex(tbl.name, idx.name,
                { timeout: 8000, compartment });
            verifyIndexes(res, idx);
        });
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, function() {
        before(async function() {
            await Utils.dropTable(client, test.table);
            await Utils.createTable(client, test.table);
            for(let idx of test.indexes) {
                await Utils.createIndex(client, test.table, idx);
            }
        });
        after(async function() {
            await Utils.dropTable(client, test.table);
        });
        testGetIndexes(client, test.table, test.indexes);
        test.indexes.forEach(idx => testGetIndex(client, test.table, idx));
        it('', () => {});
    });
}

Utils.runSequential('getIndexes tests', doTest, GET_INDEXES_TESTS);
