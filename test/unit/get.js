/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const Consistency = require('../../index').Consistency;
const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;
const badMillis = require('./common').badMillis;
const badConsistencies = require('./common').badConsistencies;
const badTblNames = require('./common').badTblNames;
const badDriverKeys = require('./common').badDriverKeys;
const getBadServerKeys = require('./common').getBadServerKeys;
const badOptions = require('./common').badOptions;
const Utils = require('./utils');
const GET_TESTS = require('./data_tests').GET_TESTS;

const compartment = Utils.config.compartment;

const badOpts = [
    ...badOptions,
    ...badMillis.map(timeout => ({ timeout })),
    ...badConsistencies.map(consistency => ({
        consistency
    }))
];

function testGetNegative(client, tbl, key) {
    for(let badTblName of badTblNames) {
        it(`get with invalid table name: ${badTblName}`, async function() {
            return expect(client.get(badTblName, key)).to.eventually
                .be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    it('get on non-existent table', async function() {
        return expect(client.get('nosuchtable', key)).to.eventually.be
            .rejected.and.satisfy(err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    for(let badKey of badDriverKeys) {
        it(`get on table ${tbl.name} with invalid driver key: \
${util.inspect(badKey)}`, async function() {
            return expect(client.get(tbl.name, badKey)).to.eventually.
                be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    for(let badKey of getBadServerKeys(tbl, key)) {
        it(`get on table ${tbl.name} with invalid server key: \
${util.inspect(badKey)}`, async function() {
            return expect(client.get(tbl.name, badKey)).to.eventually.
                be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    !err._rejectedByDriver);
        });
    }

    for(let badOpt of badOpts) {
        it(`get on table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.get(tbl.name, key, badOpt)).to.eventually
                .be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }
}

function testGetRow(client, tbl, row) {
    const key = Utils.makePrimaryKey(tbl, row);

    it(`get on ${tbl.name} for key ${util.inspect(key)}`, async function() {
        const res = await client.get(tbl.name, key);
        Utils.verifyGetResult(res, tbl, row);
    });

    it(`get on ${tbl.name} for key ${util.inspect(key)} with timeout and \
${Utils.testEventualConsistency ? 'eventual' : 'absolute'} \
consistency`, async function() {
        const res = await client.get(tbl.name, key, {
            timeout: 12000,
            consistency: Utils.testEventualConsistency ?
                Consistency.EVENTUAL : Consistency.ABSOLUTE,
            compartment
        });
        Utils.verifyGetResult(res, tbl, row);
    });

    it(`get on ${tbl.name} for key ${util.inspect(key)} with absolute \
        consistency`, async function() {
        const consistency = Consistency.ABSOLUTE;
        const res = await client.get(tbl.name, key, { consistency });
        Utils.verifyGetResult(res, tbl, row, { consistency });
    });
}

function testGetNonExistent(client, tbl, key) {
    it(`get on ${tbl.name} for missing key ${util.inspect(key)} with timeout`,
        async function() {
            const res = await client.get(tbl.name, key, {
                timeout: 12000
            });
            Utils.verifyGetResult(res, tbl);
        });

    it(`get on ${tbl.name} for missing key ${util.inspect(key)} with \
absolute consistency`, async function() {
        const consistency = Consistency.ABSOLUTE;
        const res = await client.get(tbl.name, key, { consistency });
        Utils.verifyGetResult(res, tbl, null, { consistency });
    });
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, function() {
        before(async function() {
            await Utils.createTable(client, test.table);
            for(let row of test.rows) {
                await Utils.putRow(client, test.table, row);
            }
        });
        after(async function() {
            await Utils.dropTable(client, test.table);
        });
        testGetNegative(client, test.table, Utils.makePrimaryKey(
            test.table, test.rows[0]));
        test.rows.forEach(row => testGetRow(client, test.table, row));
        //Out of range of test.rowIdStart - test.rowIdEnd-1
        const row = test.makeRow(test.rowIdEnd);
        testGetNonExistent(client, test.table, Utils.makePrimaryKey(
            test.table, row));
        it('', () => {});
    });
}

Utils.runSequential('get tests', doTest, GET_TESTS);
