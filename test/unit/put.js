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

const NoSQLClient = require('../../index').NoSQLClient;
const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;
const TTLUtil = require('../../index').TTLUtil;
const badTblNames = require('./common').badTblNames;
const sampleVer = require('./common').sampleVer;
const badOptsBasePut = require('./common').badOptsBasePut;
const badMatchVers = require('./common').badMatchVers;
const badOptsPut = require('./common').badOptsPut;
const badDriverRows = require('./common').badDriverRows;
const getBadServerRows = require('./common').getBadServerRows;
const _id = require('./common')._id;
const _ttl = require('./common')._ttl;
const _originalTTL = require('./common')._originalTTL;
const _version = require('./common')._version;
const Utils = require('./utils');
const PUT_TESTS = require('./data_tests').PUT_TESTS;

const compartment = Utils.config.compartment;

function args4putFunc(putFunc, tbl, row, opt) {
    return putFunc.name.includes('putIfVersion') ?
        [ tbl.name, row, sampleVer, opt ] :
        [ tbl.name, row, opt ];
}

function testPutFuncNegative(putFunc, tbl, row, badOpts) {
    for(let badTblName of badTblNames) {
        it(`${putFunc.name} with invalid table name: ${badTblName}`,
            async function() {
                return expect(putFunc(badTblName, row)).to.eventually
                    .be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
    }

    it(`${putFunc.name} on non-existent table`, async function() {
        return expect(putFunc('nosuchtable', row)).to.eventually.be
            .rejected.and.satisfy(err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    for(let badRow of badDriverRows) {
        it(`${putFunc.name} on table ${tbl.name} with invalid driver row: \
${util.inspect(badRow)}`, async function() {
            return expect(putFunc(tbl.name, badRow)).to.eventually
                .be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    for(let badRow of getBadServerRows(tbl, row)) {
        it(`${putFunc.name} on table ${tbl.name} with invalid server row: \
${util.inspect(badRow)}`, async function() {
            return expect(putFunc(tbl.name, badRow)).to.eventually
                .be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    !err._rejectedByDriver);
        });
    }

    //extra fields with exactMatch option
    it(`${putFunc.name} on table ${tbl.name} with exactMatch and extra \
fields: `, async function() {
        //Extra argument needed for putIfVersion
        const badRow = Object.assign({}, row, { nosuchfield: 'abcde' });
        return expect(putFunc(...args4putFunc(putFunc, tbl, badRow,
            { exactMatch: true }))).to.eventually.be.rejected.and
            .satisfy(err =>
                err instanceof NoSQLArgumentError &&
                !err._rejectedByDriver);
    });

    for(let badOpt of badOpts) {
        //Extra argument needed for putIfVersion
        it(`${putFunc.name} on table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(putFunc(...args4putFunc(putFunc, tbl, row, badOpt)))
                .to.eventually.be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    //test putIfVersion with bad matchVersion argument
    if (putFunc === NoSQLClient.prototype.putIfVersion) {
        for(let badMatchVer of badMatchVers) {
            it(`putIfVersion on table ${tbl.name} with invalid \
match version: ${util.inspect(badMatchVer)}`, async function() {
                return expect(putFunc(tbl.name, row, badMatchVer))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
        }
    }
}

function testPutNegative(client, tbl, row) {
    const badOptsPutIfAbs = badOptsBasePut.concat({ ifPresent: true },
        { matchVersion: sampleVer });
    const badOptsPutIfPres = badOptsPut.concat({ ifAbsent: true });
    const badOptsPutIfVer = badOptsBasePut.concat({ ifAbsent: true});
    testPutFuncNegative(client.put.bind(client), tbl, row, badOptsPut);
    testPutFuncNegative(client.putIfAbsent.bind(client), tbl, row,
        badOptsPutIfAbs);
    testPutFuncNegative(client.putIfPresent.bind(client), tbl, row,
        badOptsPutIfPres);
    testPutFuncNegative(client.putIfVersion.bind(client), tbl, row,
        badOptsPutIfVer);
}

//Note that when we put new row to test successful operation, we must specify
//its TTL if it has one, otherwise the verification will fail

function testPut(test, client, newRow, existingRow) {
    const tbl = test.table;
    it(`put new row on table ${tbl.name}, rowId: ${newRow[_id]}`,
        async function() {
            const opt = newRow[_ttl] ? { ttl: newRow[_ttl] } :
                { timeout: 8000, exactMatch: true };
            const res = await client.put(tbl.name, newRow, opt);
            await Utils.verifyPut(res, client, tbl, newRow, opt);
        });

    it(`put existing row on table ${tbl.name}, rowId: ${existingRow[_id]}`,
        async function() {
            const res = await client.put(tbl.name, existingRow);
            await Utils.verifyPut(res, client, tbl, existingRow);
        });

    it(`put modified row on table ${tbl.name}, rowId: ${existingRow[_id]}`,
        async function() {
            const modifiedRow = test.modifyRow(existingRow);
            //Update the row
            const opt = {
                ttl: modifiedRow[_ttl],
                compartment
            };
            const res = await client.put(tbl.name, modifiedRow, opt);
            await Utils.verifyPut(res, client, tbl, modifiedRow, opt);
        });

    if (tbl.ttl) { //test updateTTLToDefault option
        it(`put existing row on table ${tbl.name} with updateTTLToDefault \
option, rowId: ${existingRow[_id]}`, async function() {
            const opt = { updateTTLToDefault: true };
            const res = await client.put(tbl.name, existingRow, opt);
            await Utils.verifyPut(res, client, tbl, existingRow, opt);
        });
    }

    //Update the row to never expire, also test returnExisting which
    //should have no effect
    it(`put existing row on table ${tbl.name}, update TTL to never expire, \
rowId: ${existingRow[_id]}`, async function() {
        const opt = {
            ttl: TTLUtil.DO_NOT_EXPIRE,
            returnExisting: true
        };
        const res = await client.put(tbl.name, existingRow, opt);
        await Utils.verifyPut(res, client, tbl, existingRow, opt);
    });
}

function testPutIfAbsent(test, client, newRow, existingRow) {
    const tbl = test.table;

    it(`put with ifAbsent: true on table ${tbl.name} with new row, \
rowId: ${newRow[_id]}`, async function() {
        const opt = {
            ifAbsent: true,
            ttl: newRow[_ttl],
            compartment
        };
        const res = await client.put(tbl.name, newRow, opt);
        await Utils.verifyPut(res, client, tbl, newRow, opt);
    });

    it(`putIfAbsent on table ${tbl.name} with new row, rowId: \
${newRow[_id]}`, async function() {
        const opt = newRow[_ttl] ? { ttl: newRow[_ttl] } : undefined;
        const res = await client.putIfAbsent(tbl.name, newRow, opt);
        await Utils.verifyPut(res, client, tbl, newRow, Object.assign(
            {}, opt, { ifAbsent: true }));
    });

    it(`putIfAbsent on table ${tbl.name} with new row, rowId: ${newRow[_id]} \
with returnExisting=true`, async function() {
        //Test returnExisting which should have no effect here
        const opt = {
            ttl: newRow[_ttl],
            returnExisting: true
        };
        const res = await client.putIfAbsent(tbl.name, newRow, opt);
        await Utils.verifyPut(res, client, tbl, newRow, Object.assign(opt,
            { ifAbsent: true }));
    });

    it(`put with ifAbsent: true on table ${tbl.name} with modified row, \
rowId: ${existingRow[_id]} with returnExisting: true`, async function() {
        const modifiedRow = test.modifyRow(existingRow);
        const opt = {
            ifAbsent: true,
            ttl: modifiedRow[_ttl],
            returnExisting: true
        };
        const res = await client.put(tbl.name, modifiedRow, opt);
        await Utils.verifyPut(res, client, tbl, modifiedRow, opt, false,
            existingRow);
    });

    it(`putIfAbsent on table ${tbl.name} with existing row, rowId: \
${existingRow[_id]} with returnExisting not set`, async function() {
        const res = await client.putIfAbsent(tbl.name, existingRow);
        await Utils.verifyPut(res, client, tbl, existingRow,
            { ifAbsent: true }, false, existingRow);
    });

    it(`putIfAbsent on table ${tbl.name} with modified row, rowId: \
${existingRow[_id]} with returnExisting: true`, async function() {
        //TTL should not change here
        const modifiedRow = test.modifyRow(existingRow);
        const opt = { returnExisting: true };
        const res = await client.putIfAbsent(tbl.name, modifiedRow, opt);
        await Utils.verifyPut(res, client, tbl, modifiedRow,
            Object.assign(opt, { ifAbsent: true }), false, existingRow);
    });
}

function testPutIfPresent(test, client, existingRow, newRow) {
    const tbl = test.table;
    it(`put with ifPresent: true on table ${tbl.name} with modified row, \
rowId: ${existingRow[_id]}`, async function() {
        const modifiedRow = test.modifyRow(existingRow);
        let opt = {
            ifPresent: true,
            ttl: modifiedRow[_ttl],
            compartment
        };
        const res = await client.put(tbl.name, modifiedRow, opt);
        await Utils.verifyPut(res, client, tbl, modifiedRow, opt);
    });

    it(`putIfPresent on table ${tbl.name} with modified row, rowId: \
${existingRow[_id]}`, async function() {
        const modifiedRow = test.modifyRow(existingRow);
        const opt = modifiedRow[_ttl] ? { ttl: modifiedRow[_ttl],
            exactMatch: false } : undefined;
        if (opt && !opt.exactMatch) {
            modifiedRow.nosuchfield = new Date();
        }
        const res = await client.putIfPresent(tbl.name, modifiedRow, opt);
        delete modifiedRow.nosuchfield;
        await Utils.verifyPut(res, client, tbl, modifiedRow, Object.assign(
            { ifPresent: true }, opt));
    });

    it(`putIfPresent on table ${tbl.name} with existing row, rowId: \
${existingRow[_id]} with updateTTLToDefault: true and returnExisting: \
true`, async function() {
        //returnExisting should have no effect here, TTL does not change
        const opt = {
            updateTTLToDefault: true,
            returnExisting: true
        };
        const res = await client.putIfPresent(tbl.name, existingRow, opt);
        await Utils.verifyPut(res, client, tbl, existingRow, Object.assign(
            opt, { ifPresent: true }));
    });

    it(`put with ifPresent: true on new row, rowId: ${newRow[_id]}`,
        async function() {
            const opt = {
                ifPresent: true,
                ttl: newRow[_ttl]
            };
            const res = await client.put(tbl.name, newRow, opt);
            await Utils.verifyPut(res, client, tbl, newRow, opt, false);
        });

    it(`putIfPresent on new row, rowId: ${newRow[_id]}`, async function() {
        const opt = newRow[_ttl] ? { ttl: newRow[_ttl] } : undefined;
        const res = await client.putIfPresent(tbl.name, newRow, opt);
        await Utils.verifyPut(res, client, tbl, newRow,
            Object.assign({}, opt, { ifPresent: true }), false);
    });

    it(`putIfPresent on new row, rowId: ${newRow[_id]} with returnExisting: \
true`, async function() {
        //returnExisting should have no effect
        const opt = {
            returnExisting: true,
            ttl: newRow[_ttl]
        };
        const res = await client.putIfPresent(tbl.name, newRow, opt);
        await Utils.verifyPut(res, client, tbl, newRow,
            Object.assign(opt, { ifPresent: true }), false);
    });
}

function testPutIfVersion(test, client, existingRow, newRow) {
    const tbl = test.table;

    it(`put on table ${tbl.name} with correct and incorrect matchVersion \
of modified row, rowId: ${existingRow[_id]}`, async function() {
        const opt = {
            matchVersion: existingRow[_version],
            ttl: existingRow[_ttl],
            returnExisting: true,
            compartment
        };
        let res = await client.put(tbl.name, existingRow, opt);
        await Utils.verifyPut(res, client, tbl, existingRow, opt);
        //modify the row again
        const modifiedRow = test.modifyRow(existingRow);
        opt.ttl = modifiedRow[_ttl];
        //Now the old version in opt is no longer correct (current) version
        res = await client.put(tbl.name, modifiedRow, opt);
        await Utils.verifyPut(res, client, tbl, modifiedRow, opt, false,
            existingRow);
    });

    it(`putIfVersion on table ${tbl.name} with correct and incorrect \
matchVersion of modified row, rowId: ${existingRow[_id]}`, async function() {
        const modifiedRow = test.modifyRow(existingRow);
        let opt = modifiedRow[_ttl] ? { ttl: modifiedRow[_ttl] } :
            undefined;
        const ver = existingRow[_version];
        let res = await client.putIfVersion(tbl.name, modifiedRow, ver,
            opt);
        await Utils.verifyPut(res, client, tbl, modifiedRow, Object.assign(
            { matchVersion: ver }, opt));
        //modify the row again
        const modifiedRow2 = test.modifyRow(modifiedRow);
        //Now ver is no longer correct (current) version
        opt = {
            ttl: modifiedRow2[_ttl],
            returnExisting: true
        };
        res = await client.putIfVersion(tbl.name, modifiedRow2, ver, opt);
        await Utils.verifyPut(res, client, tbl, modifiedRow2,
            Object.assign(opt, { matchVersion: ver }), false, modifiedRow);
    });

    it(`put on table ${tbl.name} with new row, rowId: ${newRow[_id]} and \
matchVersion of existingRow, rowId: ${existingRow[_id]}, \
should fail`, async function() {
        const opt = {
            matchVersion: existingRow[_version],
            ttl: newRow[_ttl]
        };
        const res = await client.put(tbl.name, newRow, opt);
        await Utils.verifyPut(res, client, tbl, newRow, opt, false);
    });

    it(`putIfVersion on table ${tbl.name} with new row, rowId: ${newRow[_id]} \
and matchVersion of existingRow, rowId: ${existingRow[_id]}, \
should fail`, async function() {
        const res = await client.putIfVersion(tbl.name, newRow,
            existingRow[_version]);
        await Utils.verifyPut(res, client, tbl, newRow,
            { matchVersion: existingRow[_version] }, false);
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
        testPutNegative(client, test.table, test.rows[0]);
        test.rows.forEach(existingRow => {
            //Out of range of test.rowIdStart - test.rowIdEnd-1
            const newRow = test.makeRow(existingRow[_id] + test.rowIdEnd);
            describe(`Put tests for existing rowId: ${existingRow[_id]} and \
new rowId: ${newRow[_id]}`, function() {
                //Make sure the state is restored before each test.  In this
                //test we reuse original test rows instead of creating copies.
                //The only relevant property that can change and needs to be
                //restored before the next test is TTL.
                beforeEach(async function() {
                    await Utils.deleteRow(client, test.table, newRow);
                    await Utils.putRow(client, test.table, existingRow);
                    existingRow[_originalTTL] = existingRow[_ttl];
                });
                afterEach(function () {
                    //Some of the tests may modify the row's TTL so here
                    //we restore it.
                    existingRow[_ttl] = existingRow[_originalTTL];
                });
                testPut(test, client, newRow, existingRow);
                testPutIfAbsent(test, client, newRow, existingRow);
                testPutIfPresent(test, client, existingRow, newRow);
                testPutIfVersion(test, client, existingRow, newRow);
            });
        });
        it('', () => {});
    });
}

Utils.runSequential('put tests', doTest, PUT_TESTS);
