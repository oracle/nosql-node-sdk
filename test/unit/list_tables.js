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
const ServiceType = require('../../index').ServiceType;
const badOptions = require('./common').badOptions;
const badMillis = require('./common').badMillis;
const badNonNegInt32NotNull = require('./common').badNonNegInt32NotNull;
const Utils = require('./utils');
const LIST_TABLES_TESTS = require('./test_schemas').LIST_TABLES_TESTS;

const compartment = Utils.config.compartment;

const badOpts = [
    ...badOptions,
    ...badMillis.map(timeout => ({ timeout })),
    ...badNonNegInt32NotNull.map(startIndex => ({ startIndex, limit: 10 })),
    ...badNonNegInt32NotNull.map(limit => ({ limit }))
];

function testListTables(client, tbls, matchAll) {
    //Negative tests
    for(let badOpt of badOpts) {
        it(`listTables with invalid options: ${util.inspect(badOpt)}`,
            async function() {
                return expect(client.listTables(badOpt)).to.be.rejectedWith(
                    NoSQLArgumentError);
            });
    }

    //Positive tests
    const expTableNames = tbls.map(tbl => tbl.name).sort();
    expect(expTableNames.length).to.be.at.least(3,
        'Too few tables for listTables test (need >= 3)');

    it('listTables', async function() {
        const res = await client.listTables();
        expect(res.tables).to.be.an('array');
        const tbls = matchAll ? res.tables : res.tables.filter(
            tblName => expTableNames.indexOf(tblName) !== -1
        );
        expect(tbls).to.deep.equal(expTableNames);
        //TODO: remove if when lastIndex is implemented fully
        if (Utils.config.serviceType === ServiceType.CLOUDSIM) {
            expect(res.lastIndex).to.equal(res.tables.length);
        }
        const res2 = await client.listTables({
            timeout: 20000,
            compartment
        });
        expect(res2).to.deep.equal(res);
    });
    it('listTables with limit', async function() {
        const tableNames = (await client.listTables()).tables;
        let limit = Math.floor(tableNames.length / 2);
        let res = await client.listTables({ limit });
        expect(res.tables).to.be.an('array');
        expect(res.tables.length).to.equal(limit);
        expect(res.lastIndex).to.equal(limit);
        let resTableNames = res.tables;
        res = await client.listTables( {
            timeout: 10000,
            startIndex: limit,
            limit: limit + 5
        });
        expect(res.tables).to.be.an('array');
        expect(res.tables.length).to.equal(tableNames.length - limit);
        expect(res.lastIndex).to.equal(tableNames.length);
        resTableNames = resTableNames.concat(res.tables);
        expect(resTableNames).to.deep.equal(tableNames);
    });
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, function() {
        before(async function() {
            for(let tbl of test.tables) {
                await Utils.dropTable(client, tbl);
                await Utils.createTable(client, tbl);
            }
        });
        after(async function() {
            for(let tbl of test.tables) {
                await Utils.dropTable(client, tbl);
            }
        });
        testListTables(client, test.tables);
        it('', () => {});
    });
}

Utils.runSequential('listTables tests', doTest, LIST_TABLES_TESTS);
