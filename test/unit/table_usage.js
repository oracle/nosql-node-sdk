/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;
const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const isPosInt32 = require('../../lib/utils').isPosInt32;
const isPosInt32OrZero = require('../../lib/utils').isPosInt32OrZero;
const badOptions = require('./common').badOptions;
const badNonNegInt32NotNull = require('./common').badNonNegInt32NotNull;
const badTblNames = require('./common').badTblNames;
const badDateTimes = require('./common').badDateTimes;
const Utils = require('./utils');
const TABLE_USAGE_TESTS = require('./test_schemas').TABLE_USAGE_TESTS;

const compartment= Utils.config.compartment;

const badOpts = [
    ...badOptions,
    ...badDateTimes.map(startTime => ({ startTime })),
    ...badDateTimes.map(endTime => ({ endTime })),
    ...badNonNegInt32NotNull.map(limit => ({ limit }))
];

let startTime, endTime, measuredStartTime, measuredEndTime;

//Size of default usage slice
const USAGE_SLICE_SECONDS = 60;

//We need to account for some inaccuracy due to clock differences between
//the client and the server.  This value can be adjusted.
const CLOCK_VAR = 10000;

function verifyTableUsageResult(res, tbl, opt) {
    expect(res).to.be.an('object');
    expect(res.tableName).to.equal(tbl.name);
    expect(res.usageRecords).to.be.an('array');
    if (opt && opt.expectNone) {
        expect(res.usageRecords.length).to.equal(0);
    } else {
        expect(res.usageRecords.length).to.be.at.least(1);
    }
    for(let usageRec of res.usageRecords) {
        expect(usageRec).to.be.an('object');
        expect(usageRec.startTime).to.be.instanceOf(Date);
        expect(usageRec.startTime.getTime()).to.be.finite;
        expect(usageRec.startTime).to.be.lessThan(endTime);
        expect(usageRec.startTime).to.be.at.least(startTime);
        if (Utils.isCloudSim) {
            expect(usageRec.secondsInPeriod).to.satisfy(isPosInt32);
        } else {
            expect(usageRec.secondsInPeriod).to.equal(USAGE_SLICE_SECONDS);
        }
        expect(usageRec.readUnits).to.satisfy(isPosInt32);
        expect(usageRec.writeUnits).to.satisfy(isPosInt32);
        expect(usageRec.storageGB).to.satisfy(isPosInt32OrZero);
        if (!Utils.isCloudSim) {
            expect(usageRec.storageGB).to.equal(0);
        }
        expect(usageRec.readThrottleCount).to.equal(0);
        expect(usageRec.writeThrottleCount).to.equal(0);
        expect(usageRec.storageThrottleCount).to.equal(0);
    }
}

function testGetTableUsage(client, tbl) {
    if (Utils.isOnPrem) {
        it('getTableUsage on-prem, not supported', async function() {
            return expect(client.getTableUsage(tbl.name)).to.eventually
                .be.rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.OPERATION_NOT_SUPPORTED);
        });
        return;
    }

    //Negative tests
    for(let badTblName of badTblNames) {
        it(`getTableUsage with invalid table name: \
${util.inspect(badTblName)}`, async function() {
            return expect(client.getTableUsage(badTblName)).to
                .be.rejectedWith(NoSQLArgumentError);
        });
    }

    //Test with non-existent table
    if (!Utils.isCloudSim) {
        it('getTableUsage on non-existent table', async function() {
            return expect(client.getTableUsage('nosuchtable')).to.eventually
                .be.rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.TABLE_NOT_FOUND);
        });
    }

    for(let badOpt of badOpts) {
        it(`getTableUsage on table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.getTableUsage(tbl.name, badOpt)).to.be
                .rejectedWith(NoSQLArgumentError);
        });
    }

    //Positive tests
    it(`getTableUsage on table ${tbl.name}`, async function() {
        const res = await client.getTableUsage(tbl.name);
        verifyTableUsageResult(res, tbl);
    });

    it(`getTableUsage on table ${tbl.name} with timeout`, async function() {
        const res = await client.getTableUsage(tbl.name, {
            timeout: 10000,
            compartment
        });
        verifyTableUsageResult(res, tbl);
    });

    it(`getTableUsage on table ${tbl.name} with start time`,async function() {
        const res = await client.getTableUsage(tbl.name, { startTime });
        verifyTableUsageResult(res, tbl);
    });

    it.skip(`getTableUsage on table ${tbl.name} with start time before epoch`,
        async function() {
            const res = await client.getTableUsage(tbl.name, {
                startTime: -123456789
            });
            verifyTableUsageResult(res, tbl);
        });

    it(`getTableUsage on table ${tbl.name} with start time at epoch`,
        async function() {
            const res = await client.getTableUsage(tbl.name, {
                startTime: 1
            });
            verifyTableUsageResult(res, tbl);
        });

    it(`getTableUsage on table ${tbl.name} with end time`, async function() {
        const res = await client.getTableUsage(tbl.name, { endTime });
        verifyTableUsageResult(res, tbl);
    });

    it(`getTableUsage on table ${tbl.name} with start time and end time`,
        async function() {
            const res = await client.getTableUsage(tbl.name, {
                startTime,
                endTime
            });
            verifyTableUsageResult(res, tbl);
        });

    it(`getTableUsage on table ${tbl.name} with start time as millis and \
end time`, async function() {
        const res = await client.getTableUsage(tbl.name, {
            startTime: startTime.getTime(),
            endTime
        });
        verifyTableUsageResult(res, tbl);
    });

    it(`getTableUsage on table ${tbl.name} with start time as string and \
end time as ISO string`, async function() {
        const res = await client.getTableUsage(tbl.name, {
            startTime: startTime.toString(),
            endTime: endTime.toISOString(),
        });
        verifyTableUsageResult(res, tbl);
    });

    it(`getTableUsage on table ${tbl.name} with start time and end time as \
millis`, async function() {
        const res = await client.getTableUsage(tbl.name, {
            startTime,
            endTime: endTime.getTime(),
        });
        verifyTableUsageResult(res, tbl);
    });

    it.skip(`getTableUsage on table ${tbl.name} with end time = start time, \
should be empty`, async function() {
        let res = await client.getTableUsage(tbl.name, {
            endTime: startTime
        });
        verifyTableUsageResult(res, tbl, { expectNone: true });
    });

    it.skip(`getTableUsage on table ${tbl.name} with start time and end time \
in millis < measured start time, should be empty`, async function() {
        const res = await client.getTableUsage(tbl.name, {
            startTime : 1000000,
            endTime: 0 // measuredStartTime.getTime() - 500
        });
        verifyTableUsageResult(res, tbl, { expectNone: true });
    });

    it.skip(`getTableUsage on table ${tbl.name} with end time before epoch, \
should be empty`, async function() {
        let res = await client.getTableUsage(tbl.name, {
            endTime: -20000000
        });
        verifyTableUsageResult(res, tbl, { expectNone: true });
    });

    it(`getTableUsage on table ${tbl.name} with limit = 1`, async function() {
        const res = await client.getTableUsage(tbl.name, { limit: 1 });
        verifyTableUsageResult(res, tbl);
    });

    it(`getTableUsage on table ${tbl.name} with limit = 5 and timeout`,
        async function() {
            const res = await client.getTableUsage(tbl.name, {
                timeout: 10000,
                limit: 5
            });
            verifyTableUsageResult(res, tbl);
        });

    it(`getTableUsage on table ${tbl.name} with start time, end time and \
limit = 1`, async function() {
        const res = await client.getTableUsage(tbl.name, {
            startTime,
            endTime,
            limit: 1
        });
        verifyTableUsageResult(res, tbl);
    });

    it(`getTableUsage on ${tbl.name} with start time as string, end time \
as millis and limit = 3`, async function() {
        const res = await client.getTableUsage(tbl.name, {
            startTime: startTime.toString(),
            endTime: endTime.getTime(),
            limit: 3
        });
        verifyTableUsageResult(res, tbl);
    });
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, function() {
        before(async function() {
            this.timeout(0);
            await Utils.createTable(client, test.table);
            //We make small adjustments to measured start time and end time
            //for testing
            measuredStartTime = new Date();
            startTime = new Date(measuredStartTime.getTime() - CLOCK_VAR);
            if (!Utils.isCloudSim && !Utils.isOnPrem) {
                //create some write and read units
                process.stdout.write('Generating usage');
                const expEndTime = measuredStartTime.getTime() +
                    2 * USAGE_SLICE_SECONDS * 1000 + CLOCK_VAR;
                while(Date.now() < expEndTime) {
                    await client.put(test.table.name, test.row);
                    await client.get(test.table.name, Utils.makePrimaryKey(
                        test.table, test.row));
                    process.stdout.write('.');
                    await Utils.sleep(1000);
                }
                process.stdout.write('\n');
                await Utils.sleep(60000);
            }
            measuredEndTime = new Date();
            endTime = new Date(measuredEndTime.getTime() + CLOCK_VAR);
        });
        after(async function() {
            await Utils.dropTable(client, test.table);
        });
        testGetTableUsage(client, test.table);
        it('', () => {});
    });
}

Utils.runSequential('getTableUsage tests', doTest, TABLE_USAGE_TESTS);
