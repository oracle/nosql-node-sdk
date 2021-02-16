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
const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;
const Limits = require('../../lib/constants').Limits;
const isPosInt32OrZero = require('../../lib/utils').isPosInt32OrZero;
const badPosInt32NotNull = require('./common').badPosInt32NotNull;
const badMillis = require('./common').badMillis;
const badTblNames = require('./common').badTblNames;
const badBinaries = require('./common').badBinaries;
const badDriverFieldRanges = require('./common').badDriverFieldRanges;
const getBadServerFieldRanges = require('./common').getBadServerFieldRanges;
const badDriverKeys = require('./common').badDriverKeys;
const getBadServerKeys = require('./common').getBadServerKeys;
const _id = require('./common')._id;
const _version = require('./common')._version;
const badOptions = require('./common').badOptions;
const Utils = require('./utils');
const DELETE_RANGE_TESTS = require('./data_tests').DELETE_RANGE_TESTS;

const compartment = Utils.config.compartment;

const badMaxWriteKB = badPosInt32NotNull.concat(Limits.WRITE_KB + 1);

const badOpts = [
    ...badOptions,
    ...badMillis.map(timeout => ({ timeout })),
    ...badMaxWriteKB.map(maxWriteKB => ({ maxWriteKB })),
    ...badBinaries.map(continuationKey => ({ continuationKey }))
    //Proxy currently fulfills request on the following:
    //{ continuationKey: Buffer.alloc(16) } //bogus continuation key
];

function testDeleteRangeNegative(client, tbl, key) {
    for(let badTblName of badTblNames) {
        it(`deleteRange with invalid table name: ${badTblName}`,
            async function() {
                return expect(client.deleteRange(badTblName, key)).to.be
                    .rejectedWith(NoSQLArgumentError);
            });
    }

    it('deleteRange on non-existent table', async function() {
        return expect(client.deleteRange('nosuchtable', key)).to.eventually.be
            .rejected.and.satisfy(err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    for(let badKey of badDriverKeys) {
        it(`deleteRange on table ${tbl.name} with invalid driver key: \
${util.inspect(badKey)}`, async function() {
            return expect(client.deleteRange(tbl.name, badKey)).to.eventually.
                be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    for(let badKey of getBadServerKeys(tbl, key, true)) {
        it(`deleteRange on table ${tbl.name} with invalid server key: \
${util.inspect(badKey)}`, async function() {
            return expect(client.deleteRange(tbl.name, badKey)).to.eventually.
                be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    !err._rejectedByDriver);
        });
    }

    for(let badFR of badDriverFieldRanges) {
        it(`deleteRange on table ${tbl.name} with invalid \
driver field range: ${util.inspect(badFR)}`, async function() {
            return expect(client.deleteRange(tbl.name, key,
                { fieldRange: badFR })).to.eventually.be.rejected.and.satisfy(
                err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    for(let badFR of getBadServerFieldRanges(tbl)) {
        it(`deleteRange on table ${tbl.name} with invalid server \
field range: ${util.inspect(badFR)}`, async function() {
            return expect(client.deleteRange(tbl.name, key,
                { fieldRange: badFR })).to.eventually.be.rejected.and.satisfy(
                err =>
                    err instanceof NoSQLArgumentError &&
                    !err._rejectedByDriver);
        });
    }

    for(let badOpt of badOpts) {
        it(`deleteRange on table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.deleteRange(tbl.name, key, badOpt)).to.be
                .rejectedWith(NoSQLArgumentError);
        });
    }
}

//testCase represents particular test case for deleteRange operation,
//it contains key, may contain fieldRange and a Set of rowIds that
//are supposed to be deleted
async function verifyDeleteRange(res, client, test, testCase, opt) {
    if (!opt) {
        opt = {};
    }

    expect(res).to.be.an('object');
    expect(res.deletedCount).to.satisfy(isPosInt32OrZero);

    Utils.verifyConsumedCapacity(res.consumedCapacity);
    if (!Utils.isOnPrem) {
        expect(res.consumedCapacity.readKB).to.be.at.least(res.deletedCount);
        expect(res.consumedCapacity.readUnits).to.be.at.least(res.deletedCount);
        expect(res.consumedCapacity.writeKB).to.be.at.least(res.deletedCount);
        expect(res.consumedCapacity.writeUnits).to.be.at.least(res.deletedCount);
        if (opt.maxWriteKB && !opt.all) {
            expect(res.consumedCapacity.writeKB).to.be.at.most(
                //we allow overrun by max of 1 record
                opt.maxWriteKB + test.maxRowKB);
        }
    }

    //Normally our rows should be deleted in one call unless we reduce
    //write KB limit explicitly
    if (!opt.maxWriteKB || opt.all) {
        expect(res.continuationKey).to.not.exist;
    }

    if (opt._deletedCount != null) {
        //For multiple calls we accumulate deletedCount to verify when
        //we are done
        opt._deletedCount += res.deletedCount;
    }

    if (res.continuationKey != null) {
        expect(res.continuationKey).to.be.instanceOf(Buffer);
        //Deletion has not been completed yet so we don't verify further
        return;
    }

    //At this point deletion should have been completed
    const deletedCount = opt._deletedCount != null ? opt._deletedCount :
        res.deletedCount;
    expect(deletedCount).to.equal(testCase.rowIds.size);

    //Verify that all rows in the range have been deleted and the rest of test
    //rows are intact
    for(let row of test.rows) {
        const getRes = await client.get(test.table.name,
            Utils.makePrimaryKey(test.table, row));
        //testCase.rowIds is a Set
        if (testCase.rowIds.has(row[_id])) {
            expect(getRes.row).to.not.exist;
            expect(getRes.version).to.not.exist;
        } else {
            expect(getRes.row).to.exist;
            expect(getRes.version).to.deep.equal(row[_version]);
        }
    }
}

function testDeleteRange(client, test, testCase) {
    const tbl = test.table;

    it(`deleteRange on table ${tbl.name} with key \
${util.inspect(testCase.key)} and field range \
${util.inspect(testCase.fieldRange)}`, async function() {
        let opt;
        if (testCase.fieldRange) {
            opt = { fieldRange: testCase.fieldRange };
        }
        const res = await client.deleteRange(tbl.name, testCase.key, opt);
        await verifyDeleteRange(res, client, test, testCase, opt);
    });

    const maxWriteKB = tbl.maxRowKB ? test.maxRowKB + 1 : 2;

    it(`deleteRange on table ${tbl.name} with key \
${util.inspect(testCase.key)} and field range \
${util.inspect(testCase.fieldRange)} with \
maxWriteKB: ${maxWriteKB}`, async function() {
        const opt = {
            maxWriteKB,
            timeout: 10000,
            fieldRange: testCase.fieldRange,
            _deletedCount: 0,
            compartment
        };
        let res = {};
        let callCnt = 0;
        //Having multiple iterations here depends on having enough records in
        //our range, we should have these ranges in our tests
        do {
            if (res.continuationKey) {
                opt.continuationKey = res.continuationKey;
            }
            res = await client.deleteRange(tbl.name, testCase.key, opt);
            await verifyDeleteRange(res, client, test, testCase, opt);
            callCnt++;
        } while(res.continuationKey);
        if (testCase.rowIds.size >= 4) {
            expect(callCnt).to.be.greaterThan(1);
        }
    });

    it(`deleteRange on table ${tbl.name} with key \
${util.inspect(testCase.key)} and field range \
${util.inspect(testCase.fieldRange)} with maxWriteKB: ${maxWriteKB} and \
all: true`, async function() {
        const opt = {
            maxWriteKB,
            all: true,
            fieldRange: testCase.fieldRange
        };
        const res = await client.deleteRange(tbl.name, testCase.key, opt);
        await verifyDeleteRange(res, client, test, testCase, opt);
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
        testDeleteRangeNegative(client, test.table, Utils.makePrimaryKey(
            test.table, test.rows[0]));
        test.testCases.forEach(testCase => {
            describe(`deleteRange tests for range with key:
${util.inspect(testCase.key)} and field range: \
${util.inspect(testCase.fieldRange)}`, function() {
                testDeleteRange(client, test, testCase);
                afterEach(async function() {
                    //Re-insert the rows deleted by the test
                    for(let row of test.rows) {
                        if (testCase.rowIds.has(row[_id])) {
                            await Utils.putRow(client, test.table, row);
                        }
                    }
                });
            });
        });
        it('', () => {});
    });
}


Utils.runSequential('deleteRange tests', doTest, DELETE_RANGE_TESTS);
