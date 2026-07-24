/*-
 * Copyright (c) 2018, 2026 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/*
 * Tests for StatsControl profile, interval, handler and lifecycle behavior.
 */

const expect = require('chai').expect;

const { TestConfig } = require('../utils');
const Utils = require('./utils');

const TABLE = {
    name: 'StatsControlTest',
    fields: [
        { name: 'sid', type: 'INTEGER' },
        { name: 'id', type: 'INTEGER' },
        { name: 'name', type: 'STRING' },
        { name: 'longString', type: 'STRING' }
    ],
    primaryKey: [ 'sid', 'id' ],
    shardKeyLength: 1,
    limits: {
        readUnits: 10000,
        writeUnits: 10000,
        storageGB: 50
    }
};

const INTERVAL_SEC = 1;
const SLEEP_MSEC = INTERVAL_SEC * 1000 + 600;
const QUERY = `SELECT * FROM ${TABLE.name}`;

let statsList;
let tableCreated = false;

function isNumber(value) {
    return typeof value === 'number' && Number.isFinite(value);
}

function hasMinAvgMax(value) {
    return value != null &&
        isNumber(value.min) &&
        isNumber(value.avg) &&
        isNumber(value.max);
}

function hasRetry(value) {
    return value != null &&
        isNumber(value.delayMs) &&
        isNumber(value.authCount) &&
        isNumber(value.throttleCount) &&
        isNumber(value.count);
}

function hasFullRequestStats(stats) {
    return Array.isArray(stats.requests) && stats.requests.some(req =>
        isNumber(req.httpRequestCount) &&
        typeof req.name === 'string' &&
        isNumber(req.rateLimitDelayMs) &&
        isNumber(req.errors) &&
        hasMinAvgMax(req.requestSize) &&
        hasMinAvgMax(req.resultSize) &&
        hasMinAvgMax(req.httpRequestLatencyMs) &&
        hasRetry(req.retry));
}

function hasConnectionStats(stats) {
    return stats.connections != null &&
        hasMinAvgMax(stats.connections);
}

function hasQueryText(stats, query) {
    return Array.isArray(stats.queries) &&
        stats.queries.some(queryStats => queryStats.query === query);
}

function hasFullQueryStats(stats, query) {
    return Array.isArray(stats.queries) && stats.queries.some(queryStats =>
        queryStats.query === query &&
        typeof queryStats.doesWrites === 'boolean' &&
        isNumber(queryStats.unprepared) &&
        isNumber(queryStats.httpRequestCount) &&
        isNumber(queryStats.count) &&
        typeof queryStats.simple === 'boolean' &&
        isNumber(queryStats.rateLimitDelayMs) &&
        isNumber(queryStats.errors) &&
        hasMinAvgMax(queryStats.requestSize) &&
        hasMinAvgMax(queryStats.resultSize) &&
        hasMinAvgMax(queryStats.httpRequestLatencyMs) &&
        isNumber(queryStats.httpRequestLatencyMs['95th']) &&
        isNumber(queryStats.httpRequestLatencyMs['99th']) &&
        hasRetry(queryStats.retry));
}

function makeConfig(overrides = {}) {
    return Object.assign({}, Utils.config, {
        statsProfile: 'REGULAR',
        statsInterval: INTERVAL_SEC,
        statsPrettyPrint: true,
        statsEnableLog: false,
        statsHandler: stats => {
            if (statsList != null) {
                statsList.push(stats);
            }
        }
    }, overrides);
}

async function createClient(config) {
    const client = TestConfig.createNoSQLClientNoInit(config);
    if (client._doAsyncInit) {
        await client._doAsyncInit();
    }
    return client;
}

async function closeClient(client) {
    if (client != null) {
        client.close();
    }
}

async function resetTable() {
    const client = await createClient(makeConfig({
        statsProfile: 'NONE',
        statsHandler: null
    }));
    try {
        await Utils.dropTable(client, TABLE);
        await Utils.createTable(client, TABLE);
        tableCreated = true;
    } finally {
        await closeClient(client);
    }
}

async function dropTable() {
    const client = await createClient(makeConfig({
        statsProfile: 'NONE',
        statsHandler: null
    }));
    try {
        await Utils.dropTable(client, TABLE);
    } finally {
        await closeClient(client);
    }
}

async function loadRows(client) {
    const longString = 'x'.repeat(1024);

    for (let sid = 0; sid < 3; sid++) {
        for (let id = 0; id < 2; id++) {
            const res = await client.put(TABLE.name, {
                sid,
                id,
                name: `name_${sid}_${id}`,
                longString
            });
            expect(res.success).to.equal(true);
            expect(res.version).to.exist;
        }
    }
}

async function runQuery(client) {
    let count = 0;
    for await (const res of client.queryIterable(QUERY)) {
        count += res.rows.length;
    }
    expect(count).to.be.at.least(1);
}

describe('StatsControl Java parity test', function() {

    this.timeout(120000);

    afterEach(async function() {
        statsList = null;
        if (tableCreated) {
            tableCreated = false;
            await dropTable();
        }
    });

    it('exposes configured StatsControl properties on the client',
        async function() {
            statsList = [];
            const client = await createClient(makeConfig());

            try {
                const statsControl = client.getStatsControl();

                expect(statsControl.getInterval()).to.equal(INTERVAL_SEC);
                expect(statsControl.getProfile()).to.equal('REGULAR');
                expect(statsControl.getPrettyPrint()).to.equal(true);
                expect(statsControl.getStatsHandler()).to.be.a('function');
                expect(statsControl.isStarted()).to.equal(true);
            } finally {
                await closeClient(client);
            }
        });

    it('passes Java-like interval snapshots to the stats handler',
        async function() {
            await resetTable();
            statsList = [];
            const client = await createClient(makeConfig());

            try {
                await loadRows(client);

                const statsControl = client.getStatsControl();
                statsControl.setProfile('ALL');
                expect(statsControl.getProfile()).to.equal('ALL');

                await runQuery(client);

                statsControl.setProfile('REGULAR');
                expect(statsControl.getProfile()).to.equal('REGULAR');

                await Utils.sleep(SLEEP_MSEC);

                expect(statsList).to.have.length.greaterThan(0);

                for (const stats of statsList) {
                    expect(stats.clientId).to.be.a('string').and.not.empty;
                    expect(stats.startTime).to.be.a('string');
                    expect(stats.endTime).to.be.a('string');
                    expect(stats.requests).to.be.an('array');
                }

                expect(statsList.some(stats =>
                    stats.requests.length > 0)).to.equal(true);
                expect(statsList.some(hasFullRequestStats)).to.equal(true);
                expect(statsList.some(hasConnectionStats)).to.equal(true);
                expect(statsList.some(stats =>
                    hasQueryText(stats, QUERY))).to.equal(true);
                expect(statsList.some(stats =>
                    hasFullQueryStats(stats, QUERY))).to.equal(true);
            } finally {
                await closeClient(client);
            }
        });

    it('stops and restarts collection for real client operations',
        async function() {
            await resetTable();
            statsList = [];
            const client = await createClient(makeConfig());

            try {
                const statsControl = client.getStatsControl();

                statsControl.stop();
                expect(statsControl.isStarted()).to.equal(false);

                await loadRows(client);
                statsControl.setProfile('ALL');
                await runQuery(client);
                statsControl.setProfile('REGULAR');
                await Utils.sleep(SLEEP_MSEC);

                expect(statsList).to.have.length.greaterThan(0);
                expect(statsList.every(stats =>
                    Array.isArray(stats.requests) &&
                    stats.requests.length === 0)).to.equal(true);
                expect(statsList.some(stats =>
                    stats.connections != null)).to.equal(false);
                expect(statsList.some(stats =>
                    stats.queries != null)).to.equal(false);

                statsControl.start();
                expect(statsControl.isStarted()).to.equal(true);

                statsList = [];
                await loadRows(client);
                statsControl.setProfile('ALL');
                await runQuery(client);
                statsControl.setProfile('REGULAR');
                await Utils.sleep(SLEEP_MSEC);

                expect(statsList).to.have.length.greaterThan(0);
                expect(statsList.some(stats =>
                    stats.requests.length > 0)).to.equal(true);
                expect(statsList.some(hasConnectionStats)).to.equal(true);
                expect(statsList.some(stats =>
                    hasQueryText(stats, QUERY))).to.equal(true);
            } finally {
                await closeClient(client);
            }
        });

});
