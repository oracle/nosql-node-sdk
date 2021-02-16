/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const NoSQLClient = require('../../index').NoSQLClient;
const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;

const badTblNames = require('./common').badTblNames;
const badOptsBaseDelete = require('./common').badOptsBaseDelete;
const badOptsDelete = require('./common').badOptsDelete;
const badDriverKeys = require('./common').badDriverKeys;
const getBadServerKeys = require('./common').getBadServerKeys;
const badMatchVers = require('./common').badMatchVers;
const sampleVer = require('./common').sampleVer;
const _id = require('./common')._id;
const _version = require('./common')._version;

const Utils = require('./utils');
const DELETE_TESTS = require('./data_tests').DELETE_TESTS;

const compartment = Utils.config.compartment;

function testDeleteFuncNegative(deleteFunc, tbl, key, badOpts) {
    for(let badTblName of badTblNames) {
        it(`${deleteFunc.name} with invalid table name: ${badTblName}`,
            async function() {
                return expect(deleteFunc(badTblName, key)).to.eventually
                    .be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
    }

    it(`${deleteFunc.name} on non-existent table`, async function() {
        return expect(deleteFunc('nosuchtable', key)).to.eventually.be
            .rejected.and.satisfy(err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    for(let badKey of badDriverKeys) {
        it(`${deleteFunc.name} on table ${tbl.name} with invalid driver key: \
${util.inspect(badKey)}`, async function() {
            return expect(deleteFunc(tbl.name, badKey)).to.eventually.
                be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    for(let badRow of getBadServerKeys(tbl, key)) {
        it(`${deleteFunc.name} on table ${tbl.name} with invalid server key: \
${util.inspect(badRow)}`, async function() {
            return expect(deleteFunc(tbl.name, badRow)).to.eventually.
                be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    !err._rejectedByDriver);
        });
    }

    for(let badOpt of badOpts) {
        //Extra argument needed for putIfVersion
        const args = deleteFunc === NoSQLClient.prototype.deleteIfVersion ?
            [ tbl.name, key, sampleVer, badOpt ] :
            [ tbl.name, key, badOpt ];
        it(`${deleteFunc.name} on table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(deleteFunc(...args)).to.eventually.
                be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    //test putIfVersion with bad matchVersion argument
    if (deleteFunc === NoSQLClient.prototype.putIfVersion) {
        for(let badMatchVer of badMatchVers) {
            it(`putIfVersion on table ${tbl.name} with invalid \
match version: ${util.inspect(badMatchVer)}`, async function() {
                return expect(deleteFunc(tbl.name, key, badMatchVer))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
        }
    }
}

function testDeleteNegative(client, tbl, key) {
    testDeleteFuncNegative(client.delete.bind(client), tbl, key,
        badOptsDelete);
    testDeleteFuncNegative(client.deleteIfVersion.bind(client), tbl,
        key, badOptsBaseDelete);
}

function testDelete(client, tbl, existingKey, absentKey) {
    it(`delete on table ${tbl.name} with existing key: \
${util.inspect(existingKey)}`, async function() {
        const res = await client.delete(tbl.name, existingKey);
        await Utils.verifyDelete(res, client, tbl, existingKey);
    });

    it(`delete on table ${tbl.name} with existing key: \
${util.inspect(existingKey)} with timeout and returnExisting: true`,
    async function() {
        const opt = {
            compartment,
            timeout: 12000,
            returnExisting: true //should have no effect here
        };
        const res = await client.delete(tbl.name, existingKey, opt);
        await Utils.verifyDelete(res, client, tbl, existingKey, opt);
    });

    it(`delete on table ${tbl.name} with existing key: \
${util.inspect(existingKey)} with returnExisting: false and TTL`,
    async function() {
        //These options should be ignored
        const opt = {
            returnExisting: false,
            ttl: { hours : 1 }
        };
        const res = await client.delete(tbl.name, existingKey, opt);
        await Utils.verifyDelete(res, client, tbl, existingKey, opt);
    });

    it(`delete on table ${tbl.name} with absent key: \
${util.inspect(absentKey)}`, async function() {
        const res = await client.delete(tbl.name, absentKey);
        await Utils.verifyDelete(res, client, tbl, absentKey, null, false);
    });

    it(`delete on table ${tbl.name} with absent key: \
${util.inspect(absentKey)} with timeout and returnExisting: true`,
    async function() {
        const opt = {
            timeout: 8000,
            returnExisting: true //should have no effect here
        };
        const res = await client.delete(tbl.name, absentKey, opt);
        await Utils.verifyDelete(res, client, tbl, absentKey, opt, false);
    });
}

function testDeleteIfVersion(client, tbl, existingRow, absentKey) {
    const existingKey = Utils.makePrimaryKey(tbl, existingRow);

    it(`delete on table ${tbl.name} with correct and incorrect matchVersion \
with existing key: ${util.inspect(existingKey)} and with deleted key`,
    async function() {
        const opt = {
            matchVersion: existingRow[_version],
            returnExisting: true,
            compartment
        };
        let res = await client.delete(tbl.name, existingKey, opt);
        await Utils.verifyDelete(res, client, tbl, existingKey, opt);

        //now the row has been deleted
        res = await client.delete(tbl.name, existingKey, opt);
        await Utils.verifyDelete(res, client, tbl, existingKey, opt, false);

        //Reinsert the row
        await Utils.putRow(client, tbl, existingRow);

        //Now the old version in opt is no longer correct (current) version
        res = await client.delete(tbl.name, existingKey, opt);
        await Utils.verifyDelete(res, client, tbl, existingKey, opt, false,
            existingRow);

        //same with returnExisting: false
        opt.returnExisting = false;
        res = await client.delete(tbl.name, existingKey, opt);
        await Utils.verifyDelete(res, client, tbl, existingKey, opt, false,
            existingRow);
    });

    it(`delete on table ${tbl.name} with matchVersion with absent key: \
${util.inspect(existingKey)}`, async function() {
        const opt = {
            matchVersion: existingRow[_version],
            returnExisting: true
        };
        const res = await client.delete(tbl.name, absentKey, opt);
        await Utils.verifyDelete(res, client, tbl, absentKey, opt, false);
    });

    it(`deleteIfVersion on table ${tbl.name} with correct and incorrect \
matchVersion with existing key: ${util.inspect(existingKey)} and \
with deleted key`, async function() {
        const matchVersion = existingRow[_version];

        let res = await client.deleteIfVersion(tbl.name, existingKey,
            matchVersion);
        await Utils.verifyDelete(res, client, tbl, existingKey,
            { matchVersion });

        //now the row has been deleted
        res = await client.deleteIfVersion(tbl.name, existingKey,
            matchVersion, { matchVersion });
        await Utils.verifyDelete(res, client, tbl, existingKey, null, false);

        //Reinsert the row
        await Utils.putRow(client, tbl, existingRow);

        //Now the old version in opt is no longer correct (current) version
        res = await client.deleteIfVersion(tbl.name, existingKey, matchVersion);
        await Utils.verifyDelete(res, client, tbl, existingKey,
            { matchVersion }, false, existingRow);

        //same with returnExisting: true
        const opt = {
            returnExisting: true
        };
        res = await client.deleteIfVersion(tbl.name, existingKey, matchVersion,
            opt);
        await Utils.verifyDelete(res, client, tbl, existingKey,
            Object.assign({ matchVersion }, opt), false, existingRow);
    });

    it(`deleteIfVersion on table ${tbl.name} with matchVersion with \
absent key: ${util.inspect(existingKey)}`, async function() {
        const matchVersion = existingRow[_version];
        const opt = {
            timeout: 20000,
            returnExisting: true
        };
        const res = await client.deleteIfVersion(tbl.name, absentKey,
            matchVersion, opt);
        await Utils.verifyDelete(res, client, tbl, absentKey,
            Object.assign({ matchVersion }, opt), false);
    });
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, async function() {
        before(async function() {
            await Utils.createTable(client, test.table);
            //await Utils.truncateTable(client, test.table);
        });
        after(async function() {
            await Utils.dropTable(client, test.table);
        });
        testDeleteNegative(client, test.table, Utils.makePrimaryKey(
            test.table, test.rows[0]));
        test.rows.forEach(existingRow => {
            //Out of range of test.rowIdStart - test.rowIdEnd-1
            const newRow = test.makeRow(existingRow[_id] + test.rowIdEnd);
            const existingKey = Utils.makePrimaryKey(test.table, existingRow);
            const absentKey = Utils.makePrimaryKey(test.table, newRow);
            describe(`Delete tests on table ${test.table} for existing key \
for rowId: ${existingRow[_id]} and absent key for rowId: ${newRow[_id]}`,
            function() {
                //make sure the state is restored before each test
                beforeEach(async function() {
                    await Utils.putRow(client, test.table, existingRow);
                });
                testDelete(client, test.table, existingKey, absentKey);
                testDeleteIfVersion(client, test.table, existingRow, absentKey);
            });
        });
        it('', () => {});
    });
}

Utils.runSequential('delete tests', doTest, DELETE_TESTS);
