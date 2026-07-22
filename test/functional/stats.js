/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/*
 * Functional tests for stats collection with real CloudSim SDK operations.
 */

const expect = require('chai').expect;

const { TestConfig } = require('../utils');
const Utils = require('../unit/utils');

const TABLE_LIMITS = {
    readUnits: 10000,
    writeUnits: 10000,
    storageGB: 1
};

const PERFORMANCE_ITERATIONS = 12;
const PERFORMANCE_TOLERANCE_MS = 25;
const PERFORMANCE_RELATIVE_TOLERANCE = 0.75;

function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function hasMinAvgMax(value) {
    return value != null &&
        isNumber(value.min) &&
        isNumber(value.avg) &&
        isNumber(value.max);
}

function makeConfig() {
    return Object.assign({}, Utils.config, {
        timeout: 10000,
        ddlTimeout: 30000,
        tablePollTimeout: 30000,
        tablePollDelay: 500,
        statsProfile: 'ALL',
        statsInterval: 600,
        statsPrettyPrint: false,
        statsEnableLog: false,
        statsHandler: null
    });
}

async function createClient() {
    const client = TestConfig.createNoSQLClientNoInit(makeConfig());
    if (client._doAsyncInit) {
        await client._doAsyncInit();
    }
    return client;
}

function makeTableName() {
    return `StatsFunctional_${Date.now()}_${Math.floor(
        Math.random() * 100000)}`;
}

async function runQuery(client, stmt) {
    const rows = [];
    let opt;

    for(;;) {
        const res = await client.query(stmt, opt);
        rows.push(...res.rows);
        if (res.continuationKey == null) {
            return rows;
        }
        opt = { continuationKey: res.continuationKey };
    }
}

function requestMap(stats) {
    return new Map(stats.requests.map(req => [ req.name, req ]));
}

function average(values) {
    return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function elapsedMs(startNs) {
    return Number(process.hrtime.bigint() - startNs) / 1000000;
}

function percentile(values, percentileValue) {
    const sorted = values.slice().sort((left, right) => left - right);
    let index = Math.round(percentileValue * sorted.length - 1);
    if (index < 0) {
        index = 0;
    }
    if (index >= sorted.length) {
        index = sorted.length - 1;
    }
    return sorted[index];
}

function computePerformanceMetrics(latencies) {
    return {
        count: latencies.length,
        avgLatencyMs: average(latencies),
        p95LatencyMs: percentile(latencies, 0.95),
        p99LatencyMs: percentile(latencies, 0.99)
    };
}

function expectApprox(actual, expected, label, absoluteTolerance) {
    const tolerance = absoluteTolerance == null ?
        Math.max(PERFORMANCE_TOLERANCE_MS,
            expected * PERFORMANCE_RELATIVE_TOLERANCE) :
        absoluteTolerance;
    expect(actual, label).to.be.at.least(Math.max(0, expected - tolerance));
    expect(actual, label).to.be.at.most(expected + tolerance);
}

function verifyRequestShape(req) {
    expect(req.httpRequestCount).to.be.a('number').and.greaterThan(0);
    expect(req.errors).to.be.a('number').and.at.least(0);
    expect(req.rateLimitDelayMs).to.be.a('number').and.at.least(0);
    expect(req.retry).to.deep.include({
        authCount: req.retry.authCount,
        throttleCount: req.retry.throttleCount,
        count: req.retry.count,
        delayMs: req.retry.delayMs
    });
    expect(req.retry.authCount).to.be.a('number').and.at.least(0);
    expect(req.retry.throttleCount).to.be.a('number').and.at.least(0);
    expect(req.retry.count).to.be.a('number').and.at.least(0);
    expect(req.retry.delayMs).to.be.a('number').and.at.least(0);

    if (req.errors < req.httpRequestCount) {
        expect(req.requestSize, `${req.name} requestSize`)
            .to.satisfy(hasMinAvgMax);
        expect(req.resultSize, `${req.name} resultSize`)
            .to.satisfy(hasMinAvgMax);
    }
}

async function measureWorkload(client, workload) {
    const statsControl = client.getStatsControl();
    statsControl.setProfile('ALL');
    statsControl._clear();

    if (workload.before != null) {
        await workload.before();
        statsControl._clear();
    }

    const latencies = [];
    for (let index = 0; index < workload.iterations; index++) {
        const requestStartNs = process.hrtime.bigint();
        await workload.run(index);
        latencies.push(elapsedMs(requestStartNs));
    }

    const metrics = computePerformanceMetrics(latencies);
    const stats = client.getStatsControl()._generateStats();
    const req = requestMap(stats).get(workload.requestName);

    expect(req, `stats for ${workload.requestName}`).to.exist;
    expect(req.httpRequestCount, `${workload.requestName} request count`)
        .to.equal(workload.iterations);
    expect(req.errors, `${workload.requestName} errors`).to.equal(0);
    if (req.httpRequestLatencyMs != null) {
        expect(req.httpRequestLatencyMs,
            workload.requestName + ' latency stats').to.satisfy(hasMinAvgMax);
        expect(req.httpRequestLatencyMs['95th'],
            workload.requestName + ' 95th latency').to.be.a('number');
        expect(req.httpRequestLatencyMs['99th'],
            workload.requestName + ' 99th latency').to.be.a('number');

        /*
         * The functional test measures the public SDK call. SDK stats measure
         * the inner HTTP exchange, so the numbers should be close but not
         * identical. Java-style stats omit latency when all HTTP samples are
         * truncated to 0 ms.
         */
        expectApprox(req.httpRequestLatencyMs.avg, metrics.avgLatencyMs,
            workload.requestName + ' avg latency');
        expectApprox(req.httpRequestLatencyMs['95th'], metrics.p95LatencyMs,
            workload.requestName + ' 95th latency');
        expectApprox(req.httpRequestLatencyMs['99th'], metrics.p99LatencyMs,
            workload.requestName + ' 99th latency');
    }

    return { stats, req, metrics };
}

describe('Stats functional test', function() {

    this.timeout(120000);

    let client;
    let tableName;

    before(async function() {
        if (Utils.config == null ||
            Utils.config.serviceType == null ||
            !Utils.isCloudSim) {
            this.skip();
        }

        client = await createClient();
        tableName = makeTableName();
    });

    after(async function() {
        if (client == null) {
            return;
        }

        if (tableName != null) {
            await client.tableDDL(`DROP TABLE IF EXISTS ${tableName}`, {
                complete: true
            });
        }

        await client.close();
    });

    it('records Java-parity stats for real SDK operations',
        async function() {
            const statsControl = client.getStatsControl();
            statsControl.setProfile('ALL');
            statsControl._clear();

            await client.tableDDL(
                `CREATE TABLE IF NOT EXISTS ${tableName} ` +
                '(tenantId INTEGER, id INTEGER, name STRING, ' +
                'PRIMARY KEY(SHARD(tenantId), id))',
                {
                    tableLimits: TABLE_LIMITS,
                    timeout: 30000,
                    complete: true
                });

            await client.getTable(tableName);
            await client.listTables();

            await client.put(tableName, {
                tenantId: 1,
                id: 1,
                name: 'user-1'
            });
            await client.put(tableName, {
                tenantId: 1,
                id: 2,
                name: 'user-2'
            });
            await client.put(tableName, {
                tenantId: 2,
                id: 1,
                name: 'delete-range-1'
            });
            await client.put(tableName, {
                tenantId: 2,
                id: 2,
                name: 'delete-range-2'
            });

            const getRes = await client.get(tableName, {
                tenantId: 1,
                id: 1
            });
            expect(getRes.row).to.exist;

            const selectSql = `SELECT * FROM ${tableName} WHERE tenantId = 1`;
            const queryRows = await runQuery(client, selectSql);
            expect(queryRows.length).to.be.at.least(1);

            const preparedSql =
                `SELECT * FROM ${tableName} WHERE tenantId = 1 AND id = 2`;
            const preparedStmt = await client.prepare(preparedSql);
            const preparedRows = await runQuery(client, preparedStmt);
            expect(preparedRows.length).to.be.at.least(1);

            const writeManyRes = await client.writeMany(tableName, [
                {
                    put: {
                        tenantId: 1,
                        id: 3,
                        name: 'user-3'
                    }
                },
                {
                    delete: {
                        tenantId: 1,
                        id: 2
                    }
                }
            ]);
            expect(writeManyRes.failedOpIndex).to.not.exist;
            expect(writeManyRes.failedOpResult).to.not.exist;
            expect(writeManyRes.results).to.be.an('array').with.lengthOf(2);

            const deleteRangeRes = await client.deleteRange(tableName, {
                tenantId: 2
            });
            expect(deleteRangeRes.deletedCount).to.equal(2);
            expect(deleteRangeRes.continuationKey).to.not.exist;

            const deleteRes = await client.delete(tableName, {
                tenantId: 1,
                id: 1
            });
            expect(deleteRes.success).to.equal(true);

            await client.getTableUsage(tableName, { timeout: 10000 });

            const stats = client.getStatsControl()._generateStats();
            const requests = requestMap(stats);
            const expectedRequestCounts = new Map([
                [ 'Get', 1 ],
                [ 'Table', 1 ],
                [ 'Query', 2 ],
                [ 'Delete', 1 ],
                [ 'Put', 4 ],
                [ 'ListTables', 1 ],
                [ 'Prepare', 1 ],
                [ 'MultiDelete', 1 ],
                [ 'WriteMultiple', 1 ],
                [ 'TableUsage', 1 ]
            ]);

            expect(stats.clientId).to.be.a('string').and.not.empty;
            expect(stats.startTime).to.be.a('string').and.not.empty;
            expect(stats.endTime).to.be.a('string').and.not.empty;
            expect(stats.requests).to.be.an('array').and.not.empty;
            for (const [ requestName, expectedCount ] of
                expectedRequestCounts) {
                const req = requests.get(requestName);
                expect(req, `stats for ${requestName}`).to.exist;
                verifyRequestShape(req);
                expect(req.httpRequestCount,
                    `${requestName} HTTP request count`)
                    .to.equal(expectedCount);
            }

            /*
             * The explicit getTable() contributes one request.  Completion
             * polling for tableDDL(complete: true) may add more GetTable
             * requests depending on how quickly CloudSim activates the table.
             */
            const getTableStats = requests.get('GetTable');
            expect(getTableStats, 'stats for GetTable').to.exist;
            verifyRequestShape(getTableStats);
            expect(getTableStats.httpRequestCount, 'GetTable request count')
                .to.be.at.least(1);

            expect(stats.requests.some(req =>
                req.httpRequestLatencyMs != null &&
                isNumber(req.httpRequestLatencyMs['95th']) &&
                isNumber(req.httpRequestLatencyMs['99th'])))
                .to.equal(true);

            expect(stats.connections).to.satisfy(hasMinAvgMax);
            expect(stats.connections).to.not.have.property('count');

            expect(stats.queries).to.be.an('array').and.not.empty;
            expect(stats.queries.some(queryStats =>
                queryStats.query === selectSql &&
                queryStats.unprepared >= 1 &&
                queryStats.count >= 1))
                .to.equal(true);
            expect(stats.queries.some(queryStats =>
                queryStats.query === preparedSql &&
                queryStats.count >= 1))
                .to.equal(true);
        });

    it('matches independently measured workload performance metrics',
        async function() {
            await client.tableDDL(
                `CREATE TABLE IF NOT EXISTS ${tableName} ` +
                '(tenantId INTEGER, id INTEGER, name STRING, ' +
                'PRIMARY KEY(SHARD(tenantId), id))',
                {
                    tableLimits: TABLE_LIMITS,
                    timeout: 30000,
                    complete: true
                });

            for (let index = 0; index < PERFORMANCE_ITERATIONS; index++) {
                const res = await client.put(tableName, {
                    tenantId: 100,
                    id: index,
                    name: `seed-${index}`
                });
                expect(res.success).to.equal(true);
            }

            const selectSql =
                `SELECT * FROM ${tableName} WHERE tenantId = 100 AND id = 0`;

            const workloads = [
                {
                    requestName: 'Put',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async index => {
                        const res = await client.put(tableName, {
                            tenantId: 110,
                            id: index,
                            name: `put-${index}`
                        });
                        expect(res.success).to.equal(true);
                    }
                },
                {
                    requestName: 'Get',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async index => {
                        const res = await client.get(tableName, {
                            tenantId: 100,
                            id: index
                        });
                        expect(res.row).to.exist;
                    }
                },
                {
                    requestName: 'Table',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async index => {
                        const res = await client.setTableLimits(tableName, {
                            readUnits: TABLE_LIMITS.readUnits + index,
                            writeUnits: TABLE_LIMITS.writeUnits + index,
                            storageGB: TABLE_LIMITS.storageGB
                        });
                        expect(res.tableName).to.equal(tableName);
                    }
                },
                {
                    requestName: 'Query',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async () => {
                        const res = await client.query(selectSql);
                        expect(res.rows).to.have.lengthOf(1);
                    }
                },
                {
                    requestName: 'Prepare',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async () => {
                        const res = await client.prepare(selectSql);
                        expect(res).to.exist;
                    }
                },
                {
                    requestName: 'GetTable',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async () => {
                        const res = await client.getTable(tableName);
                        expect(res.tableName).to.equal(tableName);
                    }
                },
                {
                    requestName: 'ListTables',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async () => {
                        const res = await client.listTables();
                        expect(res.tables).to.include(tableName);
                    }
                },
                {
                    requestName: 'TableUsage',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async () => {
                        const res = await client.getTableUsage(tableName, {
                            timeout: 10000
                        });
                        expect(res.usageRecords).to.be.an('array');
                    }
                },
                {
                    requestName: 'WriteMultiple',
                    iterations: PERFORMANCE_ITERATIONS,
                    run: async index => {
                        const res = await client.writeMany(tableName, [
                            {
                                put: {
                                    tenantId: 120,
                                    id: index * 2,
                                    name: `wm-${index}-a`
                                }
                            },
                            {
                                put: {
                                    tenantId: 120,
                                    id: index * 2 + 1,
                                    name: `wm-${index}-b`
                                }
                            }
                        ]);
                        expect(res.failedOpIndex).to.not.exist;
                        expect(res.results).to.be.an('array')
                            .with.lengthOf(2);
                    }
                },
                {
                    requestName: 'MultiDelete',
                    iterations: PERFORMANCE_ITERATIONS,
                    before: async () => {
                        for (let index = 0; index < PERFORMANCE_ITERATIONS;
                            index++) {
                            await client.put(tableName, {
                                tenantId: 130 + index,
                                id: 1,
                                name: `md-${index}-a`
                            });
                            await client.put(tableName, {
                                tenantId: 130 + index,
                                id: 2,
                                name: `md-${index}-b`
                            });
                        }
                    },
                    run: async index => {
                        const res = await client.deleteRange(tableName, {
                            tenantId: 130 + index
                        });
                        expect(res.deletedCount).to.equal(2);
                    }
                },
                {
                    requestName: 'Delete',
                    iterations: PERFORMANCE_ITERATIONS,
                    before: async () => {
                        for (let index = 0; index < PERFORMANCE_ITERATIONS;
                            index++) {
                            await client.put(tableName, {
                                tenantId: 140,
                                id: index,
                                name: `delete-${index}`
                            });
                        }
                    },
                    run: async index => {
                        const res = await client.delete(tableName, {
                            tenantId: 140,
                            id: index
                        });
                        expect(res.success).to.equal(true);
                    }
                }
            ];

            for (const workload of workloads) {
                await measureWorkload(client, workload);
            }
        });

});
