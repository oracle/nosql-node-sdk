/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const ErrorCode = require('../../index').ErrorCode;
const Consistency = require('../../index').Consistency;
const SimpleRateLimiter =
    require('../../lib/rate_limiter/simple_rate_limiter');

const TestConfig = require('../utils').TestConfig;
const Utils = require('./utils');
const AllTypesTest = require('./data_tests').AllTypesTest;
const DEF_TABLE_LIMITS = require('./common').DEF_TABLE_LIMITS;

const BURST_SECS = 1;

async function simpleLoop(rl, tc, stats) {
    const endTime = Date.now() + tc.seconds * 1000;
    const unitsDelta = tc.maxUnits - tc.minUnits;
    do {
        const units = tc.minUnits + Math.round(Math.random() * unitsDelta);
        const delay = await rl.consumeUnits(units, tc.timeout,
            tc.consumeOnTimeout);
        stats.totalUnits += units;
        stats.totalDelay += delay;
    } while(Date.now() < endTime);
}

async function driverLikeLoop(rl, tc, stats) {
    const startTime = Date.now();
    const endTime = startTime + tc.seconds * 1000;
    const unitsDelta = tc.maxUnits - tc.minUnits;
    const opTimeDelta = tc.maxOpTime - tc.minOpTime;
    do {
        stats.totalDelay += await rl.consumeUnits(0, tc.timeout, false);
        const opTime = tc.minOpTime + Math.random() * opTimeDelta;
        await Utils.sleep(opTime);
        const units = tc.minUnits + Math.round(Math.random() * unitsDelta);
        stats.totalDelay += await rl.consumeUnits(units, tc.timeout - opTime,
            true);
        stats.totalUnits += units;
    } while(Date.now() < endTime);
}

const simpleTCs = [
    {
        limit: 100,
        seconds: 5,
        minUnits: 0,
        maxUnits: 5,
        timeout: 10000,
        loopCnt: 3
    }
];

const driverLikeTCs = [
    {
        limit: 20,
        seconds: 10,
        minUnits: 0,
        maxUnits: 5,
        minOpTime: 50,
        maxOpTime: 100,
        timeout: 10000,
        loopCnt: 5
    }
];

function loopTest(loop, tc) {
    it(`${loop.name} with ${util.inspect(tc)}`, async function() {
        const rl = new SimpleRateLimiter(BURST_SECS);
        rl.setLimit(tc.limit);

        const stats = {
            totalUnits: 0,
            totalDelay: 0
        };
        const loopCnt = tc.loopCnt != null ? tc.loopCnt : 1;
        const startTime = Date.now();
        const loops = Array.from({ length: loopCnt }, () =>
            loop(rl, tc, stats));
        await Promise.all(loops);

        stats.totalTime = Date.now() - startTime;
        stats.unitsPerSec = stats.totalUnits * 1000 / stats.totalTime;
        Utils.log(`Stats: ${util.inspect(stats)}`);
        expect(Math.abs(stats.unitsPerSec - tc.limit) / tc.limit)
            .to.be.at.most(0.05);
    });
}

function addStats(stats, res, doesReads, doesWrites) {
    expect(res.consumedCapacity).to.exist;
    stats.totalOps++;
    stats.totalReadUnits += res.consumedCapacity.readUnits;
    stats.totalWriteUnits += res.consumedCapacity.writeUnits;
    if (doesWrites) {
        expect(res.consumedCapacity.writeRateLimitDelay).to.exist;
        stats.totalWriteDelay += res.consumedCapacity.writeRateLimitDelay;
    }
    if (doesReads) {
        expect(res.consumedCapacity.readRateLimitDelay).to.exist;
        stats.totalReadDelay += res.consumedCapacity.readRateLimitDelay;
    }
}

function resetStats(stats) {
    Object.assign(stats, {
        totalOps: 0,
        totalReadUnits: 0,
        totalReadDelay: 0,
        readThrottleErrors: 0,
        totalWriteUnits: 0,
        totalWriteDelay: 0,
        writeThrottleErrors: 0,
        totalTime: null,
        readUnits: null,
        writeUnits: null
    });
}

async function doPut(client, test, idx, stats) {
    const res = await client.put(test.table.name, test.rows[idx]);
    addStats(stats, res, false, true);
}

async function getLoop(client, test, seconds, stats) {
    const endTime = Date.now() + seconds * 1000;
    do {
        const idx = Math.floor(Math.random() * test.rows.length);
        const pk = Utils.makePrimaryKey(test.table, test.rows[idx]);
        const res = await client.get(test.table.name, pk);
        expect(res.row).to.exist;
        addStats(stats, res, true, false);
    } while(Date.now() < endTime);
}

getLoop.chkMinReads = true;

async function putLoop(client, test, seconds, stats) {
    const endTime = Date.now() + seconds * 1000;
    do {
        const idx = Math.floor(Math.random() * test.rows.length);
        await doPut(client, test, idx, stats);
    } while(Date.now() < endTime);
}

putLoop.chkMinWrites = true;

async function putGetLoop(client, test, seconds, stats) {
    const endTime = Date.now() + seconds * 1000;
    do {
        const idx = Math.floor(Math.random() * test.rows.length);
        await doPut(client, test, idx, stats);
        const pk = Utils.makePrimaryKey(test.table, test.rows[idx]);
        const res = await client.get(test.table.name, pk, {
            consistency: Consistency.ABSOLUTE
        });
        expect(res.row).to.exist;
        addStats(stats, res, true, false);
    } while(Date.now() < endTime);
}

putGetLoop.chkMinWrites = true;
putGetLoop.chkMinReads = true;

async function deleteLoop(client, test, seconds, stats) {
    const endTime = Date.now() + seconds * 1000;
    do {
        const idx = Math.floor(Math.random() * test.rows.length);
        
        //delete the row and put it back
        const pk = Utils.makePrimaryKey(test.table, test.rows[idx]);
        let res = await client.delete(test.table.name, pk);
        addStats(stats, res, true, true);
        await doPut(client, test, idx, stats);
    } while(Date.now() < endTime);
}

deleteLoop.chkMinWrites = true;

async function deleteRangeLoop(client, test, seconds, stats) {
    const ROW_CNT = 3;
    const endTime = Date.now() + seconds * 1000;
    do {
        //delete rows, then put them back
        const startIdx = Math.floor(Math.random() *
            (test.rowsPerShard - ROW_CNT + 1));
        const endIdx = startIdx + ROW_CNT - 1;
        const ppk = {
            shardId: test.rows[startIdx].shardId
        };
        const opt = {
            fieldRange: {
                fieldName: 'pkString',
                startWith: test.rows[startIdx].pkString,
                endWith: test.rows[endIdx].pkString    
            }
        };
        do {
            const res = await client.deleteRange(test.table.name, ppk, opt);
            addStats(stats, res, true, true);
            opt.continuationKey = res.continuationKey;
        } while(opt.continuationKey != null);

        for(let i = startIdx; i <= endIdx; i++) {
            await doPut(client, test, i, stats);
        }
    } while(Date.now() < endTime);
}

deleteRangeLoop.chkMinWrites = true;

async function writeManyLoop(client, test, seconds, stats) {
    const ROW_CNT = 3;
    const endTime = Date.now() + seconds * 1000;
    do {
        //delete rows, then put them back
        const startIdx = Math.floor(Math.random() *
            (test.rowsPerShard - ROW_CNT + 1));
        const rows = test.rows.slice(startIdx, startIdx + ROW_CNT);
        const pks = rows.map(row => Utils.makePrimaryKey(test.table, row));
        let res = await client.deleteMany(test.table.name, pks);
        addStats(stats, res, true, true);
        res = await client.putMany(test.table.name, rows);
        addStats(stats, res, false, true);
    } while(Date.now() < endTime);
}

writeManyLoop.chkMinWrites = true;

async function queryLoop(client, test, seconds, stats, isSinglePartition,
    isAdvanced) {
    const endTime = Date.now() + seconds * 1000;
    let pStmt;

    if (isSinglePartition) {
        pStmt = await client.prepare(`DECLARE $shardId INTEGER; \
$pkString STRING; SELECT * FROM ${test.table.name} WHERE shardId = $shardId \
AND pkString = $pkString`);
    } else {
        pStmt = await client.prepare(`DECLARE $colInteger INTEGER; \
SELECT * FROM ${test.table.name} WHERE colInteger >= $colInteger` +
            (isAdvanced ? ' ORDER BY shardId DESC, pkString DESC \
LIMIT 20 OFFSET 1' : ''));
    }
    addStats(stats, pStmt, true, false);

    do {
        const idx = Math.floor(Math.random() * test.rows.length);
        if (isSinglePartition) {
            pStmt.set('$shardId', test.rows[idx].shardId);
            pStmt.set('$pkString', test.rows[idx].pkString);
        } else {
            pStmt.set('$colInteger', test.rows[idx].colInteger);
        }

        const opt = {};
        do {
            const res = await client.query(pStmt, opt);
            expect(res.rows).to.be.an('array');
            addStats(stats, res, true, false);
            opt.continuationKey = res.continuationKey;
        } while(opt.continuationKey != null);
    } while(Date.now() < endTime);
}

queryLoop.chkMinReads = true;

async function unprepQueryLoop(client, test, seconds, stats,
    isSinglePartition, isAdvanced) {
    const endTime = Date.now() + seconds * 1000;
    do {
        const idx = Math.floor(Math.random() * test.rows.length);
        const shardId = test.rows[idx].shardId;
        const pkString = test.rows[idx].pkString;
        const colInteger = test.rows[idx].colInteger;
        let stmt;

        if (isSinglePartition) {
            stmt = `SELECT * FROM ${test.table.name} WHERE shardId = \
'${shardId}' AND pkString = '${pkString}'`;
        } else {
            stmt = `SELECT * FROM ${test.table.name} WHERE colInteger >= \
'${colInteger}'` + (isAdvanced ? ' ORDER BY shardId DESC, pkString DESC \
LIMIT 20 OFFSET 1' : '');
        }

        const opt = {};
        do {
            const res = await client.query(stmt, opt);
            expect(res.rows).to.be.an('array');
            addStats(stats, res, true, false);
            opt.continuationKey = res.continuationKey;
        } while(opt.continuationKey != null);
    } while(Date.now() < endTime);
}

unprepQueryLoop.chkMinReads = true;

function queryLoopSP(client, test, seconds, stats) {
    return queryLoop(client, test, seconds, stats, true);
}

queryLoopSP.chkMinReads = true;

function advQueryLoop(client, test, seconds, stats) {
    return queryLoop(client, test, seconds, stats, false, true);
}

advQueryLoop.chkMinReads = true;

const MAX_UNITS_DELTA = 0.15; //ratio of table units
const MAX_THROTTLE_RATE = 0.5; //per second, max 15 per 30 seconds

function chkStats(stats, tc, percent, chkMinReadUnits, chkMinWriteUnits) {
    const readUnits = percent != null ?
        (tc.readUnits * percent / 100) : tc.readUnits;
    const writeUnits = percent != null ?
        (tc.writeUnits * percent / 100) : tc.writeUnits;

    expect(stats.readUnits).to.be.at.most(readUnits * (1 + MAX_UNITS_DELTA));
    if (chkMinReadUnits) {
        expect(stats.readUnits).to.be.at.least(
            readUnits * (1 - MAX_UNITS_DELTA));
    }
    expect(stats.writeUnits).to.be.at.most(
        writeUnits * (1 + MAX_UNITS_DELTA));
    if (chkMinWriteUnits) {
        expect(stats.writeUnits).to.be.at.least(
            writeUnits * (1 - MAX_UNITS_DELTA));
    }

    if (tc.loopCnt == null || tc.loopCnt === 1) {
        expect(stats.readThrottleErrors).to.be.at.most(
            MAX_THROTTLE_RATE * tc.seconds);
        expect(stats.writeThrottleErrors).to.be.at.most(
            MAX_THROTTLE_RATE * tc.seconds);
    }
}

function testLoop(loop, client, test, tc, stats) {
    it(loop.name, async function() {
        resetStats(stats);
        const startTime = Date.now();
        await Promise.all(Array.from({ length: tc.loopCnt }, () =>
            loop(client, test, tc.seconds, stats)));
        stats.totalTime = Date.now() - startTime;
        stats.readUnits = stats.totalReadUnits * 1000 / stats.totalTime;
        stats.writeUnits = stats.totalWriteUnits * 1000 / stats.totalTime;
        Utils.log(`Stats: ${util.inspect(stats)}`);
        chkStats(stats, tc, test.rateLimiterPercent, loop.chkMinReads,
            loop.chkMinWrites);
    });
}

function testTableOps(client, test, tc) {
    describe(`Table test ${util.inspect(tc)}`, function() {
        const tblLimits = {
            readUnits: tc.readUnits != null ?
                tc.readUnits : DEF_TABLE_LIMITS.readUnits,
            writeUnits: tc.writeUnits != null ?
                tc.writeUnits : DEF_TABLE_LIMITS.writeUnits,
            storageGB: DEF_TABLE_LIMITS.storageGB
        };
        const stats = {};
        if (tc.loopCnt == null) {
            tc.loopCnt = 1;
        }
        before(async function() {
            const res = await client.setTableLimits(test.table.name,
                tblLimits);
            await client.forCompletion(res);
            client.removeAllListeners('retryable');
            client.on('retryable', (err) => {
                if (err.errorCode === ErrorCode.READ_LIMIT_EXCEEDED ||
                    err.message.includes('Read throughput rate exceeded')) {
                    stats.readThrottleErrors++;
                } else if (err.errorCode === ErrorCode.WRITE_LIMIT_EXCEEDED ||
                    err.message.includes('Write throughput rate exceeded')) {
                    stats.writeThrottleErrors++;
                }
            });
        });
        after(() => {
            client.removeAllListeners('retryable');
        });

        if (test.basicOnly || tc.basicOnly) {
            testLoop(putGetLoop, client, test, tc, stats);
            testLoop(queryLoop, client, test, tc, stats);
            return;
        }

        testLoop(getLoop, client, test, tc, stats);
        testLoop(putLoop, client, test, tc, stats);
        testLoop(putGetLoop, client, test, tc, stats);
        testLoop(deleteLoop, client, test, tc, stats);
        testLoop(deleteRangeLoop, client, test, tc, stats);
        testLoop(writeManyLoop, client, test, tc, stats);
        testLoop(queryLoop, client, test, tc, stats);
        testLoop(queryLoopSP, client, test, tc, stats);
        testLoop(advQueryLoop, client, test, tc, stats);
    });
}

//Note that the rate limiter postpones waiting to the next op.  This means
//we could have significant stats deviations if the test run has very few ops,
//especially if each op consumes fairly large number of units (e.g. multirow
//query).  So in the testcase the run time should be inversely proportional
//to the unit limit.

const TESTS = [
    {
        desc: 'default',
        __proto__: new AllTypesTest(20),
        rateLimiter: true,
        testCases: [
            {
                readUnits: 50,
                writeUnits: 50,
                seconds: 30,
                loopCnt: 8
            }
        ]
    },
    {
        desc: 'percentage 52%',
        __proto__: new AllTypesTest(20),
        rateLimiter: true,
        rateLimiterPercent: 52,
        testCases: [
            {
                readUnits: 50,
                writeUnits: 50,
                seconds: 60,
                loopCnt: 5
            }
        ]
    },
    {
        desc: 'class via func, basic',
        __proto__: new AllTypesTest(20),
        rateLimiter: require('../../lib/rate_limiter/simple_rate_limiter'),
        basicOnly: true,
        testCases: [
            {
                readUnits: 200,
                writeUnits: 200,
                seconds: 15,
                loopCnt: 1
            }
        ]
    },
    {
        desc: 'class via mod name, basic',
        __proto__: new AllTypesTest(20),
        rateLimiter: require.resolve(
            '../../lib/rate_limiter/simple_rate_limiter'),
        basicOnly: true,
        testCases: [
            {
                readUnits: 100,
                writeUnits: 100,
                seconds: 30,
                loopCnt: 1
            }
        ]
    }
];

function doTest(test) {
    const rlCfg = {
        rateLimiter: test.rateLimiter,
        //Query tests can use >= 50 read units for each request so larger
        //timeout may be needed for multi-loop tests.
        timeout: 60000
    };
    if (test.rateLimiterPercent != null) {
        rlCfg.rateLimiterPercent = test.rateLimiterPercent;
    }
    describe(`Rate limiter table test: ${test.desc}, ${util.inspect(rlCfg)}`,
        function() {
            this.timeout(0);
            before(async function() {
                if (client._doAsyncInit) {
                    await client._doAsyncInit();
                }
                await Utils.createTable(client, test.table);
                for(let row of test.rows) {
                    await Utils.putRow(client, test.table, row);
                }
            });
            after(async function() {
                await Utils.dropTable(client, test.table);
                client.close();
            });
            const cfg = Object.assign({}, Utils.config, rlCfg);
            const client = TestConfig.createNoSQLClientNoInit(cfg);
            for(let tc of test.testCases) {
                testTableOps(client, test, tc);
            }
        });
}

if (!Utils.isOnPrem) {
    describe('SimpleRateLimiter standalone test', function() {
        this.timeout(0);
        for(let tc of simpleTCs) {
            loopTest(simpleLoop, tc);
        }
        for(let tc of driverLikeTCs) {
            loopTest(driverLikeLoop, tc);
        }
    });
    TESTS.forEach(test => doTest(test));
}
