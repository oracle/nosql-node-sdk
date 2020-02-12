/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const NoSQLTimeoutError = require('../../index').NoSQLTimeoutError;
const TableState = require('../../index').TableState;
const Enum = require('../../lib/constants').Enum;
const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;
const badStrings = require('./common').badStrings;
const badPlainObjects = require('./common').badPlainObjects;
const badTblNames = require('./common').badTblNames;
const Utils = require('./utils');
const TABLE_DDL_TESTS = require('./test_schemas').TABLE_DDL_TESTS;
const GET_TABLE_TESTS = require('./test_schemas').GET_TABLE_TESTS;
const badStatusOpts = require('./common').badDDLStatusOpts;
const badDDLCompleteOpts = require('./common').badDDLCompleteOpts;
const badCompletionOpts = require('./common').badDDLForCompletionOpts;

const compartment = Utils.config.compartment;

//In addition to getTable(), this test also includes cases for
//forTableState(), forCompletion(), and tableDDL() and setTableLimits()
//operations with "complete" option enabled.

const badDriverTableRes = [
    ...badPlainObjects,
    {}, //missing tableName
    ...badStrings.map(tableName => ({
        tableName
    })),
    ...badStrings.map(operationId => ({
        tableName: 't1',
        operationId
    }))
];

const newLimits = TABLE_DDL_TESTS[0].alter_limits[0];

function testGetTable(client, tbl) {
    //Negative tests
    for(let badTblName of badTblNames) {
        it(`getTable with invalid table name: ${util.inspect(badTblName)}`,
            async function() {
                return expect(client.getTable(badTblName)).to.be.rejectedWith(
                    NoSQLArgumentError);
            });
    }

    //Test with non-existent table
    it('getTable on non-existent table', async function() {
        return expect(client.getTable('nosuchtable')).to.eventually.be
            .rejected.and.satisfy(err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    for(let badOpt of badStatusOpts) {
        it(`getTable on ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.getTable(tbl.name, badOpt)).to.be
                .rejectedWith(NoSQLArgumentError);
        });
    }

    //Positive test
    it(`getTable on ${tbl.name}`, async function() {
        let res = await client.getTable(tbl.name, {
            timeout: 12000,
            compartment
        });
        Utils.verifyActiveTable(res, tbl);
    });
}

function testForTableState(client, tbl) {
    //Negative tests
    for(let badTblName of badTblNames) {
        it(`forTableState with invalid table name: \
${util.inspect(badTblName)}`, async function() {
            return expect(client.forTableState(badTblName,
                TableState.ACTIVE)).to.be.rejectedWith(
                NoSQLArgumentError);
        });
    }

    for(let badOpt of badCompletionOpts) {
        it(`forTableState on ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.forTableState(tbl.name,
                TableState.ACTIVE, badOpt)).to.be.rejectedWith(
                NoSQLArgumentError);
        });
    }

    //Anything that is not an instance of TableState
    const badTableStates = [ undefined, null, 'ACTIVE', 0, new Enum(1, '', '') ];
    for(let badTableState of badTableStates) {
        it(`forTableState on ${tbl.name} with invalid state: \
${util.inspect(badTableState)}`, async function() {
            return expect(client.forTableState(tbl.name, badTableState)).to
                .be.rejectedWith(NoSQLArgumentError);
        });
    }

    //Test with non-existent table
    it('forTableState on non-existent table', async function() {
        return expect(client.forTableState('nosuchtable',
            TableState.ACTIVE)).to.eventually.be.rejected.and.satisfy(err =>
            err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    //Timeout test
    it(`forTableState on ${tbl.name} timeout`, async function() {
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        return expect(client.forTableState(tbl.name, TableState.CREATING,
            { timeout: 2000, delay: 300 })).to.be.rejectedWith(
            NoSQLTimeoutError);
    });

    //Positive test (this API is also tested by DDL tests)
    it(`forTableState on ${tbl.name}`, async function() {
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        res = await client.forTableState(tbl.name, TableState.ACTIVE, {
            timeout: 5000,
            delay: 500,
            compartment
        });
        Utils.verifyActiveTable(res, tbl);
    });
}

function testForCompletion(client, tbl) {

    //Negative tests
    describe('forCompletion negative tests', function() {
        let tableRes;
        before(async function() {
            await Utils.dropTable(client, tbl);
            tableRes = await client.tableDDL(Utils.makeCreateTable(tbl), {
                tableLimits: tbl.limits
            });
        });
        for(let badOpt of badCompletionOpts) {
            it(`forCompletion on ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
                return expect(client.forCompletion(tableRes, badOpt))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
        }
        //forCompletion with bad table result argument
        for(let badRes of badDriverTableRes) {
            it(`forCompletion with invalid table result: \
    ${util.inspect(badRes)}`, async function() {
                return expect(client.forCompletion(badRes))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
        }
        //Test with table result of non-existent table
        it('forCompletion on table result of non-existent table',
            async function() {
                return expect(client.forCompletion({
                    tableName: 'nosuchtable'
                })).to.eventually.be.rejected.and.satisfy(
                    err => err instanceof NoSQLError &&
                    err.errorCode == ErrorCode.TABLE_NOT_FOUND);
            });
    });

    //Positive tests
    describe('forCompletion after create table', function() {
        beforeEach(async function() {
            await Utils.dropTable(client, tbl);
        });
        it('forCompletion after create table', async function() {
            const sql = Utils.makeCreateTable(tbl);
            let res = await client.tableDDL(sql, { tableLimits: tbl.limits });
            res = await client.forCompletion(res);
            Utils.verifyActiveTable(res, tbl);
        });
        const opt = {
            timeout: 29999,
            delay: 1888,
            compartment
        };
        it(`forCompletion after create table with options: \
${util.inspect(opt)}`, async function() {
            let res = await client.tableDDL(Utils.makeCreateTable(tbl), {
                tableLimits: tbl.limits
            });
            res = await client.forCompletion(res, opt);
            Utils.verifyActiveTable(res, tbl);
        });
    });

    describe('forCompletion after drop table', function() {
        beforeEach(async function() {
            await Utils.createTable(client, tbl);
        });
        it('forCompletion after drop table', async function() {
            let res = await client.tableDDL(`dRoP  taBLE    ${tbl.name}`);
            res = await client.forCompletion(res);
            expect(res.tableName).to.equal(tbl.name);
            expect(res.tableState).to.equal(TableState.DROPPED);
        });
    });
}

function testComplete(client, tbl) {
    //Negative tests
    describe('tableDDL with complete:true, negative tests', function() {
        before(async function() {
            await Utils.dropTable(client, tbl);
        });
        const sql = Utils.makeCreateTable(tbl);
        for(let badOpt of badDDLCompleteOpts) {
            it(`tableDDL on ${tbl.name} with invalid completion options: \
${util.inspect(badOpt)}`, async function() {
                return expect(client.tableDDL(sql, badOpt))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
            if (!Utils.isOnPrem) {
                it(`setTableLimits on ${tbl.name} with invalid completion \
    options: ${util.inspect(badOpt)}`, async function() {
                    return expect(client.setTableLimits(tbl.name, badOpt))
                        .to.eventually.be.rejected.and.satisfy(err =>
                            err instanceof NoSQLArgumentError &&
                            err._rejectedByDriver);
                });
            }
        }
    });

    //Positive tests

    const opt = {
        timeout: 41111,
        delay: 1234
    };

    describe('create table with complete:true', function() {
        beforeEach(async function() {
            await Utils.dropTable(client, tbl);
        });
        it('create table with complete:true', async function() {
            const sql = Utils.makeCreateTable(tbl);
            let res = await client.tableDDL(sql, {
                tableLimits: tbl.limits,
                complete: true
            });
            Utils.verifyActiveTable(res, tbl);
        });
        it(`create table with options: ${util.inspect(opt)} and \
complete:true`, async function() {
            const sql = Utils.makeCreateTable(tbl);
            let res = await client.tableDDL(sql, Object.assign({
                complete: true,
                tableLimits: tbl.limits
            }, opt));
            Utils.verifyActiveTable(res, tbl);
        });
    });

    describe('drop table with complete: true', function() {
        beforeEach(async function() {
            await Utils.createTable(client, tbl);
        });
        it('drop table with complete: true', async function() {
            let res = await client.tableDDL(`   DROP table ${tbl.name}`, {
                complete: true
            });
            expect(res.tableName).to.equal(tbl.name);
            expect(res.tableState).to.equal(TableState.DROPPED);
        });
    });

    if (!Utils.isOnPrem) {
        describe('setTableLimits with complete: true', function() {
            beforeEach(async function() {
                await Utils.createTable(client, tbl);
            });
            it(`setTableLimits with options: ${util.inspect(opt)} and \
complete: true`, async function() {
                let res = await client.setTableLimits(tbl.name, newLimits,
                    Object.assign({ complete: true }, opt));
                Utils.verifyActiveTable(res, tbl, {
                    tableLimits: newLimits
                });
            });
        });
    }
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, function() {
        before(async function() {
            await Utils.dropTable(client, test.table);
            await Utils.createTable(client, test.table);
        });
        after(async function() {
            await Utils.dropTable(client, test.table);
        });
        testGetTable(client, test.table);
        testForTableState(client, test.table);
        testForCompletion(client, test.table);
        testComplete(client, test.table);
        it('', () => {});
    });
}

Utils.runSequential('getTable tests', doTest, GET_TABLE_TESTS);
