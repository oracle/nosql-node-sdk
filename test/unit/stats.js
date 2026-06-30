/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/*
 * Tests for stats aggregation, request metrics and HttpClient stats wiring.
 */

const http = require('http');
const expect = require('chai').expect;

const HttpClient = require('../../lib/http_client');
const Stats = require('../../lib/stats');
const StatsControl = require('../../lib/stats_control');

const OPCODE_SELECT = 5;
const OPCODE_INSERT = 6;

function getRequest(stats, name) {
    const req = stats.requests.find(req => req.name === name);
    expect(req, `request stats for ${name}`).to.exist;
    return req;
}

function expectMinAvgMax(value, min, avg, max) {
    expect(value).to.deep.include({
        min,
        avg,
        max
    });
}

function elapsedMs(startNs) {
    return Number(process.hrtime.bigint() - startNs) / 1000000;
}

function createTestHttpClient(endpoint = 'http://localhost:8081') {
    const client = new HttpClient({
        url: new URL(endpoint),
        statsProfile: 'MORE',
        statsInterval: 60,
        statsPrettyPrint: false,
        statsEnableLog: false,
        auth: {
            provider: {
                getAuthorization: async () => null
            }
        }
    });
    client._agent = {
        sockets: {},
        freeSockets: {},
        destroy: () => {}
    };
    return client;
}

function createTestOp(name) {
    return {
        name,
        supportsRateLimiting: false,
        applyDefaults: req => {
            req.opt = Object.assign({
                timeout: 1000,
                requestTimeout: 1000,
                securityInfoTimeout: 1000,
                retry: {
                    handler: {
                        doRetry: () => true,
                        delay: (_req, numRetries) => numRetries
                    }
                }
            }, req.opt);
        },
        setProtocolVersion: () => {},
        validate: () => {},
        handleUnsupportedProtocol: () => false,
        protocolChanged: () => false,
        onResult: () => {}
    };
}

describe('Stats unit test', function() {

    it('aggregates multiple Get request statistics', function() {
        const stats = new Stats({ clientId: 'test', profile: 'ALL' });

        stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 100, 200, 10);
        stats.observe('GetOp', false, 2, 1, 20, 0, 0, 0, 120, 240, 20);
        stats.observe('GetOp', false, 3, 2, 30, 0, 0, 0, 140, 280, 30);

        const output = stats.generateStats();
        const get = getRequest(output, 'Get');

        expect(get.httpRequestCount).to.equal(3);
        expect(get.errors).to.equal(0);
        expect(get.retry).to.deep.equal({
            delayMs: 50,
            authCount: 0,
            throttleCount: 0,
            count: 3
        });
        expectMinAvgMax(get.requestSize, 100, 120, 140);
        expectMinAvgMax(get.resultSize, 200, 240, 280);
        expectMinAvgMax(get.httpRequestLatencyMs, 10, 20, 30);
        expect(get.httpRequestLatencyMs['95th']).to.equal(30);
        expect(get.httpRequestLatencyMs['99th']).to.equal(30);
        expectMinAvgMax(output.connections, 1, 2, 3);
    });

    it('maps and aggregates Table request statistics', function() {
        const stats = new Stats({ clientId: 'test', profile: 'MORE' });

        stats.observe('TableDDLOp', false, 1, 0, 0, 0, 0, 0, 200, 100, 40);
        stats.observe('TableDDLOp', false, 1, 0, 0, 0, 0, 0, 220, 120, 60);

        const table = getRequest(stats.generateStats(), 'Table');

        expect(table.httpRequestCount).to.equal(2);
        expect(table.errors).to.equal(0);
        expectMinAvgMax(table.requestSize, 200, 210, 220);
        expectMinAvgMax(table.resultSize, 100, 110, 120);
        expectMinAvgMax(table.httpRequestLatencyMs, 40, 50, 60);
    });

    it('aggregates Query request and per-query statistics in ALL profile',
        function() {
            const stats = new Stats({ clientId: 'test', profile: 'ALL' });
            const q1 = { stmt: 'SELECT * FROM Users WHERE id = 1' };
            const q2 = { stmt: 'SELECT * FROM Users WHERE id = 2' };

            stats.observeQuery(q1);
            stats.observeQuery(q2);
            stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 150, 500, 5,
                q1, {});
            stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 170, 700, 15,
                q2, {});

            const output = stats.generateStats();
            const query = getRequest(output, 'Query');

            expect(query.httpRequestCount).to.equal(2);
            expectMinAvgMax(query.requestSize, 150, 160, 170);
            expectMinAvgMax(query.resultSize, 500, 600, 700);
            expectMinAvgMax(query.httpRequestLatencyMs, 5, 10, 15);

            expect(output.queries).to.have.length(2);
            expect(output.queries.map(query => query.query)).to.have.members([
                q1.stmt,
                q2.stmt
            ]);
            for (const queryStats of output.queries) {
                expect(queryStats.count).to.equal(1);
                expect(queryStats.httpRequestCount).to.equal(1);
                expect(queryStats.unprepared).to.equal(1);
                expect(queryStats.simple).to.equal(false);
                expect(queryStats.doesWrites).to.equal(false);
            }
        });

    it('buckets repeated query text into one query statistics entry',
        function() {
            const stats = new Stats({ clientId: 'test', profile: 'ALL' });
            const queryReq = { stmt: 'SELECT * FROM Users' };

            stats.observeQuery(queryReq);
            stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 100, 300, 10,
                queryReq, {});
            stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 120, 360, 20,
                queryReq, {});
            stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 140, 420, 30,
                queryReq, {});

            const output = stats.generateStats();

            expect(output.queries).to.have.length(1);
            expect(output.queries[0].query).to.equal(queryReq.stmt);
            expect(output.queries[0].count).to.equal(1);
            expect(output.queries[0].httpRequestCount).to.equal(3);
            expectMinAvgMax(output.queries[0].requestSize, 100, 120, 140);
            expectMinAvgMax(output.queries[0].resultSize, 300, 360, 420);
            expectMinAvgMax(output.queries[0].httpRequestLatencyMs, 10, 20,
                30);
        });

    it('records errors without adding size or latency samples', function() {
        const stats = new Stats({ clientId: 'test', profile: 'MORE' });

        stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 100, 200, 10);
        stats.observeError('GetOp', 1, 2, 50, 0, 0, 1);

        const get = getRequest(stats.generateStats(), 'Get');

        expect(get.httpRequestCount).to.equal(2);
        expect(get.errors).to.equal(1);
        expect(get.retry).to.deep.equal({
            delayMs: 50,
            authCount: 0,
            throttleCount: 1,
            count: 2
        });
        expectMinAvgMax(get.requestSize, 100, 100, 100);
        expectMinAvgMax(get.resultSize, 200, 200, 200);
        expectMinAvgMax(get.httpRequestLatencyMs, 10, 10, 10);
    });

    it('honors profile-specific percentile and query output behavior',
        function() {
            const regularStats = new Stats({ clientId: 'regular',
                profile: 'REGULAR' });
            regularStats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20,
                5);

            const regularGet = getRequest(regularStats.generateStats(), 'Get');
            expect(regularGet.httpRequestLatencyMs).to.not.have.property(
                '95th');
            expect(regularGet.httpRequestLatencyMs).to.not.have.property(
                '99th');

            const moreStats = new Stats({ clientId: 'more',
                profile: 'MORE' });
            moreStats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5,
                { stmt: 'SELECT * FROM Users' }, {});

            const moreOutput = moreStats.generateStats();
            const moreQuery = getRequest(moreOutput, 'Query');
            expect(moreQuery.httpRequestLatencyMs).to.have.property('95th', 5);
            expect(moreQuery.httpRequestLatencyMs).to.have.property('99th', 5);
            expect(moreOutput).to.not.have.property('queries');
        });

    it('generates Java-like output order and timestamp format', function() {
        const stats = new Stats({ clientId: 'order', profile: 'ALL' });
        const queryReq = { stmt: 'SELECT * FROM Users' };

        stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 52, 120, 1);
        stats.observeQuery(queryReq);
        stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 100, 300, 2,
            queryReq, {});

        const output = stats.generateStats();
        const get = getRequest(output, 'Get');

        expect(Object.keys(output)).to.deep.equal([
            'startTime',
            'endTime',
            'clientId',
            'connections',
            'queries',
            'requests'
        ]);
        expect(output.startTime).to.match(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(output.endTime).to.match(
            /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/);
        expect(Object.keys(get)).to.deep.equal([
            'name',
            'httpRequestCount',
            'errors',
            'retry',
            'rateLimitDelayMs',
            'httpRequestLatencyMs',
            'requestSize',
            'resultSize'
        ]);
        expect(Object.keys(get.retry)).to.deep.equal([
            'count',
            'delayMs',
            'authCount',
            'throttleCount'
        ]);
        expect(Object.keys(output.connections)).to.deep.equal([
            'min',
            'max',
            'avg'
        ]);
    });

    it('emits Java-like startup metadata when logging is enabled',
        function() {
            const logs = [];
            const statsControl = new StatsControl({
                profile: 'ALL',
                interval: 5,
                enableLog: true,
                prettyPrint: true,
                rateLimitingEnabled: true,
                logger: {
                    info: msg => logs.push(msg),
                    error: msg => logs.push(msg)
                }
            });

            try {
                expect(logs).to.have.length(1);
                expect(logs[0]).to.match(/^Client stats\|/);
                const startupStats = JSON.parse(logs[0].substring(
                    StatsControl.LOG_PREFIX.length));
                expect(startupStats).to.deep.include({
                    sdkName: 'Oracle NoSQL SDK for Node.js',
                    profile: 'ALL',
                    intervalSec: 5,
                    prettyPrint: true,
                    rateLimitingEnabled: true
                });
                expect(startupStats).to.have.property('sdkVersion');
                expect(startupStats).to.have.property('clientId');
            } finally {
                statsControl._shutdown();
            }
        });

    it('clears collected stats after interval logging', function() {
        const statsControl = new StatsControl({
            profile: 'MORE',
            interval: 10
        });

        statsControl._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        const first = statsControl._logStats();
        const second = statsControl._generateStats();

        expect(first.requests).to.have.length(1);
        expect(second.requests).to.have.length(0);
        statsControl._shutdown();
    });

    it('does not collect observations with NONE profile', function() {
        const stats = new Stats({ clientId: 'none', profile: 'NONE' });

        stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        stats.observeError('PutOp', 1, 1, 10, 0, 0, 0);

        const output = stats.generateStats();

        expect(output.requests).to.have.length(0);
        expect(output).to.not.have.property('connections');
        expect(output).to.not.have.property('queries');
    });

    it('uses NONE as the default StatsControl profile', function() {
        const statsControl = new StatsControl({ interval: 60 });

        try {
            expect(statsControl.getProfile()).to.equal('NONE');
            expect(statsControl.isStarted()).to.equal(false);
            statsControl._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20,
                5);
            expect(statsControl._generateStats().requests).to.have.length(0);
        } finally {
            statsControl._shutdown();
        }
    });

    it('clears all collected request, query and connection stats',
        function() {
            const stats = new Stats({ clientId: 'clear', profile: 'ALL' });

            stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
            stats.observe('QueryOp', false, 2, 0, 0, 0, 0, 0, 100, 200, 10,
                { stmt: 'SELECT * FROM Users' }, {});
            stats.clear();

            const output = stats.generateStats();

            expect(output.requests).to.have.length(0);
            expect(output).to.not.have.property('connections');
            expect(output).to.not.have.property('queries');
        });

    it('records query errors in request and query statistics', function() {
        const stats = new Stats({ clientId: 'query-error', profile: 'ALL' });
        const queryReq = { stmt: 'SELECT * FROM MissingTable' };

        stats.observeQuery(queryReq);
        stats.observeError('QueryOp', 1, 2, 50, 0, 1, 0, queryReq);

        const output = stats.generateStats();
        const query = getRequest(output, 'Query');

        expect(query.httpRequestCount).to.equal(1);
        expect(query.errors).to.equal(1);
        expect(query.retry).to.deep.equal({
            delayMs: 50,
            authCount: 1,
            throttleCount: 0,
            count: 2
        });
        expect(query).to.not.have.property('requestSize');
        expect(query).to.not.have.property('resultSize');
        expect(query).to.not.have.property('httpRequestLatencyMs');

        expect(output.queries).to.have.length(1);
        expect(output.queries[0].query).to.equal(queryReq.stmt);
        expect(output.queries[0].httpRequestCount).to.equal(1);
        expect(output.queries[0].errors).to.equal(1);
        expect(output.queries[0]).to.not.have.property('requestSize');
        expect(output.queries[0]).to.not.have.property('resultSize');
        expect(output.queries[0]).to.not.have.property(
            'httpRequestLatencyMs');
    });

    it('maps Java-compatible operation names to request buckets',
        function() {
            const stats = new Stats({ clientId: 'mapping', profile: 'MORE' });

            stats.observe('PollTableOp', false, 1, 0, 0, 0, 0, 0, 10, 20,
                1);
            stats.observe('AdminDDLOp', false, 1, 0, 0, 0, 0, 0, 10, 20,
                1);
            stats.observe('AdminStatusOp', false, 1, 0, 0, 0, 0, 0, 10, 20,
                1);
            stats.observe('NewFutureOp', false, 1, 0, 0, 0, 0, 0, 10, 20,
                1);

            const names = stats.generateStats().requests.map(req => req.name);

            expect(names).to.include.members([
                'GetTable',
                'System',
                'SystemStatus',
                'NewFuture'
            ]);
        });

    it('aggregates retry and rate limit delay counters', function() {
        const stats = new Stats({ clientId: 'retry', profile: 'MORE' });

        stats.observe('PutOp', false, 1, 1, 10, 3, 1, 0, 100, 200, 5);
        stats.observe('PutOp', false, 1, 2, 20, 7, 0, 2, 120, 220, 15);
        stats.observeError('PutOp', 1, 3, 30, 11, 1, 1);

        const put = getRequest(stats.generateStats(), 'Put');

        expect(put.httpRequestCount).to.equal(3);
        expect(put.errors).to.equal(1);
        expect(put.retry).to.deep.equal({
            delayMs: 60,
            authCount: 2,
            throttleCount: 3,
            count: 6
        });
        expect(put.rateLimitDelayMs).to.equal(21);
        expectMinAvgMax(put.requestSize, 100, 110, 120);
        expectMinAvgMax(put.resultSize, 200, 210, 220);
        expectMinAvgMax(put.httpRequestLatencyMs, 5, 10, 15);
    });

    it('enables percentile collection after setProfile(MORE)', function() {
        const stats = new Stats({ clientId: 'profile-change',
            profile: 'REGULAR' });

        stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        stats.setProfile('MORE');
        stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 20, 40, 15);

        const get = getRequest(stats.generateStats(), 'Get');

        expect(get.httpRequestLatencyMs).to.have.property('95th', 15);
        expect(get.httpRequestLatencyMs).to.have.property('99th', 15);
    });

    it('generates empty stats without connection or query sections',
        function() {
            const stats = new Stats({ clientId: 'empty', profile: 'ALL' });
            const output = stats.generateStats();

            expect(output.requests).to.have.length(0);
            expect(output).to.not.have.property('connections');
            expect(output).to.not.have.property('queries');
        });

    it('logs final stats on shutdown when logging is enabled', function() {
        const logs = [];
        const statsControl = new StatsControl({
            profile: 'MORE',
            interval: 60,
            enableLog: true,
            logger: {
                info: msg => logs.push(msg),
                error: msg => logs.push(msg)
            }
        });

        statsControl._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        statsControl._shutdown();

        expect(logs).to.have.length(2);
        const finalStats = JSON.parse(logs[1].substring(
            StatsControl.LOG_PREFIX.length));
        const get = getRequest(finalStats, 'Get');
        expect(get.httpRequestCount).to.equal(1);
    });

    it('does not log when logging is disabled', function() {
        const logs = [];
        const statsControl = new StatsControl({
            profile: 'MORE',
            interval: 60,
            enableLog: false,
            logger: {
                info: msg => logs.push(msg),
                error: msg => logs.push(msg)
            }
        });

        statsControl._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        const output = statsControl._generateStats();
        statsControl._shutdown();

        expect(logs).to.have.length(0);
        expect(getRequest(output, 'Get').httpRequestCount).to.equal(1);
    });

    it('passes interval stats to stats handler and clears after logging',
        function() {
            const handled = [];
            const statsControl = new StatsControl({
                profile: 'MORE',
                interval: 60,
                statsHandler: stats => handled.push(stats)
            });

            statsControl._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20,
                5);
            const logged = statsControl._logStats();
            const afterLog = statsControl._generateStats();
            statsControl._shutdown();

            expect(handled).to.have.length(2);
            expect(handled[0]).to.equal(logged);
            expect(getRequest(handled[0], 'Get').httpRequestCount).to.equal(1);
            expect(handled[1].requests).to.have.length(0);
            expect(afterLog.requests).to.have.length(0);
        });

    it('honors StatsControl stop and start collection state', function() {
        const statsControl = new StatsControl({
            profile: 'MORE',
            interval: 60
        });

        statsControl.stop();
        statsControl._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        expect(statsControl._generateStats().requests).to.have.length(0);

        statsControl.start();
        statsControl._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        expect(getRequest(statsControl._generateStats(), 'Get')
            .httpRequestCount).to.equal(1);
        statsControl._shutdown();
    });

    it('does not start interval output until start is called', function() {
        const statsControl = new StatsControl({
            profile: 'NONE',
            interval: 60,
            enableLog: false
        });

        try {
            expect(statsControl.isStarted()).to.equal(false);
            expect(statsControl._timer).to.equal(null);
            expect(statsControl.setProfile('MORE')).to.equal(statsControl);
            expect(statsControl._timer).to.equal(null);
            expect(statsControl.setStatsHandler(() => {}))
                .to.equal(statsControl);
            expect(statsControl._timer).to.equal(null);

            statsControl.start();

            expect(statsControl.isStarted()).to.equal(true);
            expect(statsControl._timer).to.exist;
        } finally {
            statsControl._shutdown();
        }
    });

    it('uses prepared statement metadata for query statistics', function() {
        const stats = new Stats({ clientId: 'prepared', profile: 'ALL' });
        const prepStmt = {
            _sql: 'INSERT INTO Users(id, name) VALUES($id, $name)',
            _queryPlanStr: 'driver plan',
            _opCode: OPCODE_INSERT,
            _queryPlan: {}
        };
        const queryReq = {
            prepStmt
        };

        stats.observeQuery(queryReq);
        stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 100, 200, 10,
            queryReq, {});

        const output = stats.generateStats();

        expect(output.queries).to.have.length(1);
        expect(output.queries[0]).to.deep.include({
            query: prepStmt._sql,
            count: 1,
            unprepared: 0,
            simple: false,
            doesWrites: true,
            plan: prepStmt._queryPlanStr
        });
    });

    it('marks prepared select query as read-only', function() {
        const stats = new Stats({ clientId: 'prepared-select',
            profile: 'ALL' });
        const prepStmt = {
            _sql: 'SELECT * FROM Users WHERE id = $id',
            _opCode: OPCODE_SELECT,
            _queryPlan: null
        };
        const queryReq = {
            prepStmt
        };

        stats.observeQuery(queryReq);
        stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 100, 200, 10, {
            prepStmt
        }, {});

        const queryStats = stats.generateStats().queries[0];

        expect(queryStats.query).to.equal(prepStmt._sql);
        expect(queryStats.unprepared).to.equal(0);
        expect(queryStats.simple).to.equal(true);
        expect(queryStats.doesWrites).to.equal(false);
    });

    it('calculates percentiles using Java-compatible formula', function() {
        const stats = new Stats({ clientId: 'percentile', profile: 'MORE' });
        for (const latency of [ 100, 1, 50, 20, 10 ]) {
            stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20,
                latency);
        }

        const get = getRequest(stats.generateStats(), 'Get');

        expect(get.httpRequestLatencyMs).to.deep.include({
            min: 1,
            avg: 36.2,
            max: 100,
            '95th': 100,
            '99th': 100
        });
    });

    it('omits latency when all successful request latencies are zero',
        function() {
            const stats = new Stats({ clientId: 'zero-latency',
                profile: 'MORE' });

            stats.observe('DeleteOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 0);
            stats.observe('DeleteOp', false, 1, 0, 0, 0, 0, 0, 12, 22, 0);

            const del = getRequest(stats.generateStats(), 'Delete');

            expect(del).to.not.have.property('httpRequestLatencyMs');
            expectMinAvgMax(del.requestSize, 10, 11, 12);
            expectMinAvgMax(del.resultSize, 20, 21, 22);
        });

    it('omits size and latency metrics for an all-error bucket',
        function() {
            const stats = new Stats({ clientId: 'all-errors',
                profile: 'MORE' });

            stats.observeError('PutOp', 1, 1, 10, 3, 0, 1);
            stats.observeError('PutOp', 1, 2, 20, 7, 1, 0);

            const put = getRequest(stats.generateStats(), 'Put');

            expect(put.httpRequestCount).to.equal(2);
            expect(put.errors).to.equal(2);
            expect(put.rateLimitDelayMs).to.equal(10);
            expect(put.retry).to.deep.equal({
                delayMs: 30,
                authCount: 1,
                throttleCount: 1,
                count: 3
            });
            expect(put).to.not.have.property('requestSize');
            expect(put).to.not.have.property('resultSize');
            expect(put).to.not.have.property('httpRequestLatencyMs');
        });

    it('uses only successful requests for size and latency averages',
        function() {
            const stats = new Stats({ clientId: 'mixed-errors',
                profile: 'MORE' });

            stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 100, 200, 10);
            stats.observeError('GetOp', 1, 1, 10, 0, 0, 0);
            stats.observe('GetOp', false, 1, 0, 0, 0, 0, 0, 300, 600, 30);
            stats.observeError('GetOp', 1, 1, 20, 0, 0, 0);

            const get = getRequest(stats.generateStats(), 'Get');

            expect(get.httpRequestCount).to.equal(4);
            expect(get.errors).to.equal(2);
            expectMinAvgMax(get.requestSize, 100, 200, 300);
            expectMinAvgMax(get.resultSize, 200, 400, 600);
            expectMinAvgMax(get.httpRequestLatencyMs, 10, 20, 30);
        });

    it('uses prepared statement from query continuation key',
        function() {
            const stats = new Stats({ clientId: 'continuation-prepared',
                profile: 'ALL' });
            const prepStmt = {
                _sql: 'SELECT * FROM Users WHERE id = $id',
                _opCode: OPCODE_SELECT,
                _queryPlan: null
            };
            const queryReq = {
                opt: {
                    continuationKey: {
                        _prepStmt: prepStmt
                    }
                }
            };

            stats.observeQuery(queryReq);
            stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 100, 200, 10,
                queryReq, {});

            const queryStats = stats.generateStats().queries[0];

            expect(queryStats.query).to.equal(prepStmt._sql);
            expect(queryStats.unprepared).to.equal(0);
            expect(queryStats.simple).to.equal(true);
            expect(queryStats.doesWrites).to.equal(false);
        });

    it('uses prepared statement from query result fallback', function() {
        const stats = new Stats({ clientId: 'result-prepared',
            profile: 'ALL' });
        const prepStmt = {
            _sql: 'INSERT INTO Users(id, name) VALUES($id, $name)',
            _queryPlanStr: 'result plan',
            _opCode: OPCODE_INSERT,
            _queryPlan: {}
        };

        stats.observeQuery({}, { _prepStmt: prepStmt });
        stats.observe('QueryOp', false, 1, 0, 0, 0, 0, 0, 100, 200, 10,
            {}, { _prepStmt: prepStmt });

        const queryStats = stats.generateStats().queries[0];

        expect(queryStats).to.deep.include({
            query: prepStmt._sql,
            unprepared: 1,
            doesWrites: true,
            plan: prepStmt._queryPlanStr
        });
    });

    it('accepts stats handler objects with accept method', function() {
        const handled = [];
        const statsControl = new StatsControl({
            profile: 'MORE',
            interval: 60,
            statsHandler: {
                accept: stats => handled.push(stats)
            }
        });

        statsControl._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        statsControl._logStats();
        statsControl._shutdown();

        expect(handled).to.have.length(2);
        expect(getRequest(handled[0], 'Get').httpRequestCount).to.equal(1);
        expect(handled[1].requests).to.have.length(0);
    });

    it('validates StatsControl constructor options', function() {
        expect(() => new StatsControl({ interval: 0 })).to.throw(
            'Stats interval can not be less than 1 second.');
        expect(() => new StatsControl({ profile: 'BAD' })).to.throw(
            'Invalid stats profile: BAD');
        expect(() => new StatsControl({ statsHandler: {} })).to.throw(
            'Invalid stats handler');
    });

    it('uses pretty-print setting when logging snapshots', function() {
        const compactLogs = [];
        const prettyLogs = [];
        const compact = new StatsControl({
            profile: 'MORE',
            interval: 60,
            enableLog: true,
            prettyPrint: false,
            logger: {
                info: msg => compactLogs.push(msg)
            }
        });
        const pretty = new StatsControl({
            profile: 'MORE',
            interval: 60,
            enableLog: true,
            prettyPrint: true,
            logger: {
                info: msg => prettyLogs.push(msg)
            }
        });

        compact._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        pretty._observe('GetOp', false, 1, 0, 0, 0, 0, 0, 10, 20, 5);
        compact._logStats();
        pretty._logStats();
        compact._shutdown();
        pretty._shutdown();

        expect(compactLogs[1]).to.not.include('\n');
        expect(prettyLogs[1]).to.include('\n');
    });

    it('does not sample connections when stats are disabled or stopped',
        async function() {
            async function runCase(configureStats, shouldFail) {
                const client = createTestHttpClient();
                const terminalError = new Error('terminal stats test error');
                terminalError.retryable = false;
                const result = { ok: true };
                const op = createTestOp('GetOp');

                client._getConnectionCount = () => {
                    throw new Error('connection count should not be sampled');
                };
                client._executeOnce = async () => {
                    if (shouldFail) {
                        throw terminalError;
                    }
                    return result;
                };
                client.on('error', () => {});
                configureStats(client.getStatsControl());

                try {
                    if (shouldFail) {
                        try {
                            await client.execute(op, {});
                            throw new Error('Expected terminal error');
                        } catch(err) {
                            expect(err).to.equal(terminalError);
                        }
                    } else {
                        expect(await client.execute(op, {})).to.equal(result);
                    }
                    expect(client.getStatsControl()._generateStats().requests)
                        .to.have.length(0);
                } finally {
                    client.shutdown();
                }
            }

            for (const configureStats of [
                statsControl => statsControl.setProfile('NONE'),
                statsControl => statsControl.stop()
            ]) {
                await runCase(configureStats, false);
                await runCase(configureStats, true);
            }
        });

    it('does not record logical query stats before validation succeeds',
        async function() {
            const client = createTestHttpClient();
            const validationError = new Error('invalid query');
            const op = Object.assign(createTestOp('QueryOp'), {
                validate: () => {
                    throw validationError;
                }
            });

            client.getStatsControl().setProfile('ALL');

            try {
                try {
                    await client.execute(op, {
                        stmt: '',
                        _statsObserveQuery: true
                    });
                    throw new Error('Expected validation error');
                } catch(err) {
                    expect(err).to.equal(validationError);
                }

                const stats = client.getStatsControl()._generateStats();
                expect(stats).to.not.have.property('queries');
                expect(stats.requests).to.have.length(0);
            } finally {
                client.shutdown();
            }
        });

    it('records real HttpClient HTTP latency in generated stats',
        async function() {
            this.timeout(5000);
            const serverDelayMs = 60;
            const requestBody = Buffer.from('request-body');
            const responseBody = Buffer.from('response-body');
            const server = http.createServer((req, res) => {
                req.on('data', () => {});
                req.on('end', () => {
                    setTimeout(() => {
                        res.writeHead(200, {
                            'Content-Type': 'application/octet-stream'
                        });
                        res.end(responseBody);
                    }, serverDelayMs);
                });
            });
            await new Promise((resolve, reject) => {
                server.on('error', reject);
                server.listen(0, '127.0.0.1', resolve);
            });
            const port = server.address().port;
            const client = createTestHttpClient(`http://127.0.0.1:${port}`);
            const op = Object.assign(createTestOp('GetOp'), {
                serialize: (_pm, buf) => client._pm.addChunk(buf,
                    requestBody),
                deserialize: () => ({ ok: true })
            });

            client._pm = {
                contentType: 'application/octet-stream',
                encoding: null,
                getBuffer() {
                    return { chunks: [], length: 0 };
                },
                addChunk: (buf, chunk) => {
                    buf.chunks.push(chunk);
                    buf.length += chunk.length;
                },
                getContentLength: buf => buf.length,
                getContent: buf => Buffer.concat(buf.chunks),
                releaseBuffer: () => {}
            };
            client._agent = new http.Agent({ keepAlive: true });

            try {
                const externalStart = process.hrtime.bigint();
                await client.execute(op, {});
                const externalLatency = elapsedMs(externalStart);
                const get = getRequest(client.getStatsControl()
                    ._generateStats(), 'Get');
                const sdkLatency = get.httpRequestLatencyMs.avg;

                expect(get.httpRequestCount).to.equal(1);
                expect(sdkLatency).to.be.at.least(serverDelayMs - 5);
                expect(sdkLatency).to.be.at.most(externalLatency + 20);
                expectMinAvgMax(get.httpRequestLatencyMs, sdkLatency,
                    sdkLatency, sdkLatency);
                expectMinAvgMax(get.requestSize, requestBody.length,
                    requestBody.length, requestBody.length);
                expectMinAvgMax(get.resultSize, responseBody.length,
                    responseBody.length, responseBody.length);
            } finally {
                client.shutdown();
                await new Promise(resolve => server.close(resolve));
            }
        });

    it('records real network retry count in generated stats',
        async function() {
            this.timeout(5000);
            const requestBody = Buffer.from('retry-request-body');
            const responseBody = Buffer.from('retry-response-body');
            let attempt = 0;
            const retryErrors = [];
            const server = http.createServer((req, res) => {
                attempt++;
                req.on('data', () => {});
                req.on('end', () => {
                    if (attempt === 1) {
                        req.socket.destroy();
                        return;
                    }
                    res.writeHead(200, {
                        'Content-Type': 'application/octet-stream'
                    });
                    res.end(responseBody);
                });
            });
            await new Promise((resolve, reject) => {
                server.on('error', reject);
                server.listen(0, '127.0.0.1', resolve);
            });
            const port = server.address().port;
            const client = createTestHttpClient(`http://127.0.0.1:${port}`);
            const op = Object.assign(createTestOp('GetOp'), {
                serialize: (_pm, buf) => client._pm.addChunk(buf,
                    requestBody),
                deserialize: () => ({ ok: true })
            });

            client._pm = {
                contentType: 'application/octet-stream',
                encoding: null,
                getBuffer() {
                    return { chunks: [], length: 0 };
                },
                addChunk: (buf, chunk) => {
                    buf.chunks.push(chunk);
                    buf.length += chunk.length;
                },
                getContentLength: buf => buf.length,
                getContent: buf => Buffer.concat(buf.chunks),
                releaseBuffer: () => {}
            };
            client._agent = new http.Agent({ keepAlive: true });
            client.on('retryable', err => retryErrors.push(err));

            try {
                await client.execute(op, {});
                const output = client.getStatsControl()._generateStats();
                const get = getRequest(output, 'Get');

                expect(attempt).to.equal(2);
                expect(retryErrors).to.have.length(1);
                expect(get.httpRequestCount).to.equal(1);
                expect(get.errors).to.equal(0);
                expect(get.retry).to.deep.equal({
                    delayMs: 1,
                    authCount: 0,
                    throttleCount: 0,
                    count: 1
                });
                expectMinAvgMax(get.requestSize, requestBody.length,
                    requestBody.length, requestBody.length);
                expectMinAvgMax(get.resultSize, responseBody.length,
                    responseBody.length, responseBody.length);
            } finally {
                client.shutdown();
                await new Promise(resolve => server.close(resolve));
            }
        });

    it('records request-level rate limit delay on terminal errors',
        async function() {
            const client = createTestHttpClient();
            const terminalError = new Error('terminal stats test error');
            terminalError.retryable = false;
            const op = Object.assign(createTestOp('PutOp'), {
                serialize: (_pm, _buf, req) => {
                    req._rrlDelay = 7;
                    req._wrlDelay = 11;
                    throw terminalError;
                },
                deserialize: () => ({})
            });
            client.on('error', () => {});
            let output;

            try {
                await client.execute(op, {});
                throw new Error('Expected terminal error');
            } catch(err) {
                expect(err).to.equal(terminalError);
                output = client.getStatsControl()._generateStats();
            } finally {
                client.shutdown();
            }

            const put = getRequest(output, 'Put');

            expect(put.httpRequestCount).to.equal(1);
            expect(put.errors).to.equal(1);
            expect(put.rateLimitDelayMs).to.equal(18);
            expect(put).to.not.have.property('requestSize');
            expect(put).to.not.have.property('resultSize');
            expect(put).to.not.have.property('httpRequestLatencyMs');
        });

});
