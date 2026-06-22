/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const INT_MAX_VALUE = 2147483647;

const PROFILE_ORDER = Object.freeze({
    NONE: 0,
    REGULAR: 1,
    MORE: 2,
    ALL: 3
});

const DEFAULT_PROFILE = 'NONE';
const DEFAULT_LATENCY_PERCENTILE_MODE = 'EXACT';
const OPCODE_SELECT = 5;

const LATENCY_PERCENTILE_MODE = Object.freeze({
    EXACT: 'EXACT',
    BUCKETED: 'BUCKETED'
});

const LATENCY_BUCKET_LIMITS = Object.freeze([
    ...Array.from({ length: 101 }, (_unused, index) => index),
    ...Array.from({ length: 40 }, (_unused, index) => 110 + index * 10),
    ...Array.from({ length: 10 }, (_unused, index) => 550 + index * 50),
    ...Array.from({ length: 40 }, (_unused, index) => 1100 + index * 100),
    ...Array.from({ length: 10 }, (_unused, index) => 5500 + index * 500),
    ...Array.from({ length: 50 }, (_unused, index) => 11000 + index * 1000),
    ...Array.from({ length: 48 }, (_unused, index) => 65000 + index * 5000),
    INT_MAX_VALUE
]);

const REQUEST_NAME_MAP = {
    AdminDDLOp: 'System',
    AdminPollOp: 'SystemStatus',
    AdminStatusOp: 'SystemStatus',
    AddReplicaOp: 'Table',
    DropReplicaOp: 'Table',
    PollTableOp: 'GetTable',
    PollTableStateOp: 'GetTable',
    TableDDLOp: 'Table',
    TableLimitsOp: 'Table',
    TableTagsOp: 'Table'
};

function normalizeProfile(profile) {
    if (profile == null) {
        return DEFAULT_PROFILE;
    }
    if (typeof profile !== 'string') {
        throw new Error(`Invalid stats profile: ${profile}`);
    }
    const normalized = profile.toUpperCase();
    if (PROFILE_ORDER[normalized] == null) {
        throw new Error(`Invalid stats profile: ${profile}`);
    }
    return normalized;
}

function profileAtLeast(profile, minProfile) {
    return PROFILE_ORDER[profile] >= PROFILE_ORDER[minProfile];
}

function normalizeLatencyPercentileMode(mode) {
    if (mode == null) {
        return DEFAULT_LATENCY_PERCENTILE_MODE;
    }
    if (typeof mode !== 'string') {
        throw new Error(`Invalid latency percentile mode: ${mode}`);
    }
    const normalized = mode.toUpperCase();
    if (LATENCY_PERCENTILE_MODE[normalized] == null) {
        throw new Error(`Invalid latency percentile mode: ${mode}`);
    }
    return normalized;
}

function createLatencyPercentile(mode) {
    return mode === LATENCY_PERCENTILE_MODE.BUCKETED ?
        new BucketedPercentile() : new Percentile();
}

function formatTimestamp(ms) {
    return new Date(Math.floor(ms / 1000) * 1000).toISOString()
        .replace('.000Z', 'Z');
}

class Percentile {

    constructor() {
        this.values = [];
    }

    addValue(value) {
        this.values.push(value);
    }

    getPercentile(percentile) {
        if (this.values.length === 0) {
            return -1;
        }
        const values = this.values.slice().sort((v1, v2) => v1 - v2);
        let index = Math.round(percentile * values.length - 1);
        if (index < 0) {
            index = 0;
        }
        if (index >= values.length) {
            index = values.length - 1;
        }
        return values[index];
    }

    get95thPercentile() {
        return this.getPercentile(0.95);
    }

    get99thPercentile() {
        return this.getPercentile(0.99);
    }

    clear() {
        this.values = [];
    }

}

class BucketedPercentile {

    constructor() {
        this.clear();
    }

    _bucketIndex(value) {
        let low = 0;
        let high = LATENCY_BUCKET_LIMITS.length - 1;
        while (low < high) {
            const mid = Math.floor((low + high) / 2);
            if (value <= LATENCY_BUCKET_LIMITS[mid]) {
                high = mid;
            } else {
                low = mid + 1;
            }
        }
        return low;
    }

    addValue(value) {
        const bucketIndex = this._bucketIndex(value);
        this.buckets[bucketIndex]++;
        this.count++;
        this.max = Math.max(this.max, value);
        this.highestBucketIndex = Math.max(this.highestBucketIndex,
            bucketIndex);
    }

    getPercentile(percentile) {
        if (this.count === 0) {
            return -1;
        }
        let index = Math.round(percentile * this.count - 1);
        if (index < 0) {
            index = 0;
        }
        const target = index + 1;
        let seen = 0;
        for (let i = 0; i < this.buckets.length; i++) {
            seen += this.buckets[i];
            if (seen >= target) {
                return i === this.highestBucketIndex ? this.max :
                    LATENCY_BUCKET_LIMITS[i];
            }
        }
        return this.max;
    }

    get95thPercentile() {
        return this.getPercentile(0.95);
    }

    get99thPercentile() {
        return this.getPercentile(0.99);
    }

    clear() {
        this.buckets = Array(LATENCY_BUCKET_LIMITS.length).fill(0);
        this.count = 0;
        this.max = 0;
        this.highestBucketIndex = -1;
    }

}

class ReqStats {

    constructor(profile = DEFAULT_PROFILE, latencyPercentileMode) {
        this.latencyPercentileMode = normalizeLatencyPercentileMode(
            latencyPercentileMode);
        this.setProfile(profile);
        this.clear();
    }

    setProfile(profile) {
        profile = normalizeProfile(profile);
        if (profileAtLeast(profile, 'MORE')) {
            if (this.requestLatencyPercentile == null) {
                this.requestLatencyPercentile = createLatencyPercentile(
                    this.latencyPercentileMode);
            }
        }
        /*
         * Keep the percentile collector once it has been created. Java keeps
         * already-collected interval details visible even if the profile is
         * lowered before the interval snapshot is generated.
         */
    }

    observe(error, retries, retryDelay, rateLimitDelay, authCount,
        throttleCount, reqSize, resSize, requestLatency) {
        this.httpRequestCount++;
        this.retryCount += retries;
        this.retryDelayMs += retryDelay;
        this.retryAuthCount += authCount;
        this.retryThrottleCount += throttleCount;
        this.rateLimitDelayMs += rateLimitDelay;
        if (error) {
            this.errors++;
        } else {
            /*
             * Match Java Stats: failed requests contribute to counts, errors
             * and retry totals, while latency and size distributions are based
             * only on successful responses.
             */
            this.reqSizeMin = Math.min(this.reqSizeMin, reqSize);
            this.reqSizeMax = Math.max(this.reqSizeMax, reqSize);
            this.reqSizeSum += reqSize;
            this.resSizeMin = Math.min(this.resSizeMin, resSize);
            this.resSizeMax = Math.max(this.resSizeMax, resSize);
            this.resSizeSum += resSize;
            this.requestLatencyMin =
                Math.min(this.requestLatencyMin, requestLatency);
            this.requestLatencyMax =
                Math.max(this.requestLatencyMax, requestLatency);
            this.requestLatencySum += requestLatency;
            if (this.requestLatencyPercentile != null) {
                this.requestLatencyPercentile.addValue(requestLatency);
            }
        }
    }

    toJSON(requestName, reqArray) {
        if (this.httpRequestCount > 0) {
            const mapValue = {};
            mapValue.httpRequestCount = this.httpRequestCount;
            this._addResultSizeStats(mapValue);
            mapValue.name = requestName;
            this._addLatencyStats(mapValue);
            this._addRequestSizeStats(mapValue);
            mapValue.rateLimitDelayMs = this.rateLimitDelayMs;
            mapValue.errors = this.errors;
            this._addRetryStats(mapValue);
            reqArray.push(mapValue);
        }
    }

    toMapValue(mapValue) {
        mapValue.httpRequestCount = this.httpRequestCount;
        this._addResultSizeStats(mapValue);
        this._addLatencyStats(mapValue);
        this._addRequestSizeStats(mapValue);
        mapValue.rateLimitDelayMs = this.rateLimitDelayMs;
        mapValue.errors = this.errors;
        this._addRetryStats(mapValue);
    }

    _addRetryStats(mapValue) {
        mapValue.retry = {
            delayMs: this.retryDelayMs,
            authCount: this.retryAuthCount,
            throttleCount: this.retryThrottleCount,
            count: this.retryCount
        };
    }

    _addLatencyStats(mapValue) {
        if (this.requestLatencyMax > 0) {
            mapValue.httpRequestLatencyMs = {
                min: this.requestLatencyMin,
                avg: this.requestLatencySum /
                    (this.httpRequestCount - this.errors),
                max: this.requestLatencyMax
            };
            if (this.requestLatencyPercentile != null) {
                mapValue.httpRequestLatencyMs['95th'] =
                    this.requestLatencyPercentile.get95thPercentile();
                mapValue.httpRequestLatencyMs['99th'] =
                    this.requestLatencyPercentile.get99thPercentile();
            }
        }
    }

    _addRequestSizeStats(mapValue) {
        if (this.reqSizeMax > 0) {
            mapValue.requestSize = {
                min: this.reqSizeMin,
                avg: this.reqSizeSum / (this.httpRequestCount - this.errors),
                max: this.reqSizeMax
            };
        }
    }

    _addResultSizeStats(mapValue) {
        if (this.resSizeMax > 0) {
            mapValue.resultSize = {
                min: this.resSizeMin,
                avg: this.resSizeSum / (this.httpRequestCount - this.errors),
                max: this.resSizeMax
            };
        }
    }

    clear() {
        this.httpRequestCount = 0;
        this.errors = 0;
        this.reqSizeMin = INT_MAX_VALUE;
        this.reqSizeMax = 0;
        this.reqSizeSum = 0;
        this.resSizeMin = INT_MAX_VALUE;
        this.resSizeMax = 0;
        this.resSizeSum = 0;
        this.retryAuthCount = 0;
        this.retryThrottleCount = 0;
        this.retryCount = 0;
        this.retryDelayMs = 0;
        this.rateLimitDelayMs = 0;
        this.requestLatencyMin = INT_MAX_VALUE;
        this.requestLatencyMax = 0;
        this.requestLatencySum = 0;
        if (this.requestLatencyPercentile != null) {
            this.requestLatencyPercentile.clear();
        }
    }

}

class ConnectionStats {

    constructor() {
        this.clear();
    }

    observe(connections) {
        this.count++;
        this.min = Math.min(this.min, connections);
        this.max = Math.max(this.max, connections);
        this.sum += connections;
    }

    toJSON(root) {
        if (this.count > 0) {
            root.connections = {
                min: this.min,
                avg: this.sum / this.count,
                max: this.max
            };
        }
    }

    clear() {
        this.count = 0;
        this.min = INT_MAX_VALUE;
        this.max = 0;
        this.sum = 0;
    }

}

function getPreparedStatement(queryReq, queryRes) {
    if (queryReq == null) {
        return queryRes != null ? queryRes._prepStmt : null;
    }
    if (queryReq.prepStmt != null) {
        return queryReq.prepStmt;
    }
    if (queryReq.opt != null && queryReq.opt.continuationKey != null) {
        return queryReq.opt.continuationKey._prepStmt;
    }
    return queryRes != null ? queryRes._prepStmt : null;
}

function getQueryText(queryReq, queryRes) {
    if (queryReq != null && queryReq.stmt != null) {
        return queryReq.stmt;
    }
    const prepStmt = getPreparedStatement(queryReq, queryRes);
    return prepStmt != null ? prepStmt._sql : null;
}

function isPreparedQuery(queryReq) {
    return queryReq != null && (queryReq.prepStmt != null ||
        (queryReq.opt != null && queryReq.opt.continuationKey != null &&
        queryReq.opt.continuationKey._prepStmt != null));
}

function isSimpleQuery(prepStmt) {
    return prepStmt != null && prepStmt._queryPlan == null;
}

function queryDoesWrites(prepStmt) {
    return prepStmt != null && prepStmt._opCode != null &&
        prepStmt._opCode !== OPCODE_SELECT;
}

class QueryEntryStat {

    constructor(profile, latencyPercentileMode, queryReq, queryRes) {
        this.count = 0;
        this.unprepared = 0;
        this.simple = false;
        this.doesWrites = false;
        this.reqStats = new ReqStats(profile, latencyPercentileMode);
        this._updateQueryInfo(queryReq, queryRes);
    }

    _updateQueryInfo(queryReq, queryRes) {
        const prepStmt = getPreparedStatement(queryReq, queryRes);
        if (prepStmt == null) {
            return;
        }
        if (this.plan == null && prepStmt._queryPlanStr != null) {
            this.plan = prepStmt._queryPlanStr;
        }
        if (queryDoesWrites(prepStmt)) {
            this.doesWrites = true;
        }
    }

    observeQuery(queryReq, queryRes) {
        this.count++;
        if (!isPreparedQuery(queryReq)) {
            this.unprepared++;
        } else {
            this.simple = isSimpleQuery(getPreparedStatement(queryReq,
                queryRes));
        }
        this._updateQueryInfo(queryReq, queryRes);
    }

    toJSON(query, queries) {
        const queryStats = {};
        queryStats.doesWrites = this.doesWrites;
        queryStats.unprepared = this.unprepared;
        queryStats.httpRequestCount = this.reqStats.httpRequestCount;
        queryStats.query = query == null ? 'null' : query;
        this.reqStats._addResultSizeStats(queryStats);
        queryStats.count = this.count;
        queryStats.simple = this.simple;
        if (this.plan != null) {
            queryStats.plan = this.plan;
        }
        this.reqStats._addLatencyStats(queryStats);
        this.reqStats._addRequestSizeStats(queryStats);
        queryStats.rateLimitDelayMs = this.reqStats.rateLimitDelayMs;
        queryStats.errors = this.reqStats.errors;
        this.reqStats._addRetryStats(queryStats);
        queries.push(queryStats);
    }

    clear() {
        this.count = 0;
        this.unprepared = 0;
        this.simple = false;
        this.doesWrites = false;
        this.reqStats.clear();
    }

}

class ExtraQueryStats {

    constructor(profile, latencyPercentileMode) {
        this.profile = normalizeProfile(profile);
        this.latencyPercentileMode = normalizeLatencyPercentileMode(
            latencyPercentileMode);
        this.queries = new Map();
    }

    _getQueryEntryStat(queryReq, queryRes) {
        const query = getQueryText(queryReq, queryRes);
        let queryStat = this.queries.get(query);
        if (queryStat == null) {
            queryStat = new QueryEntryStat(this.profile,
                this.latencyPercentileMode, queryReq, queryRes);
            this.queries.set(query, queryStat);
        } else {
            queryStat._updateQueryInfo(queryReq, queryRes);
        }
        return queryStat;
    }

    observeQuery(queryReq, queryRes, error, retryCount, retryDelayMs,
        rateLimitDelayMs, retryAuthCount, retryThrottleCount, requestSize,
        responseSize, requestLatency) {
        const queryStat = this._getQueryEntryStat(queryReq, queryRes);
        queryStat.observeQuery(queryReq, queryRes);
        queryStat.reqStats.observe(error, retryCount, retryDelayMs,
            rateLimitDelayMs, retryAuthCount, retryThrottleCount, requestSize,
            responseSize, requestLatency);
    }

    setProfile(profile) {
        this.profile = normalizeProfile(profile);
        for (const queryStat of this.queries.values()) {
            queryStat.reqStats.setProfile(this.profile);
        }
    }

    toJSON(root) {
        if (this.queries.size === 0) {
            return;
        }
        root.queries = [];
        for (const [query, queryStat] of this.queries.entries()) {
            queryStat.toJSON(query, root.queries);
        }
    }

    clear() {
        this.queries.clear();
    }

}

class Stats {

    constructor(clientIdOrOptions, profile) {
        const options = clientIdOrOptions != null &&
            typeof clientIdOrOptions === 'object' ?
            clientIdOrOptions : {
                clientId: clientIdOrOptions,
                profile
            };
        this.clientId = options.clientId;
        this.profile = normalizeProfile(options.profile);
        this.latencyPercentileMode = normalizeLatencyPercentileMode(
            options.latencyPercentileMode);
        this.requests = {};
        this.connectionStats = new ConnectionStats();
        if (profileAtLeast(this.profile, 'ALL')) {
            this.extraQueryStats = new ExtraQueryStats(this.profile,
                this.latencyPercentileMode);
        }
        this.startTime = Date.now();
        this.endTime = 0;
    }

    _requestName(opName) {
        if (opName == null) {
            return 'Unknown';
        }
        if (REQUEST_NAME_MAP[opName] != null) {
            return REQUEST_NAME_MAP[opName];
        }
        return opName.endsWith('Op') ? opName.substring(0, opName.length - 2) :
            opName;
    }

    _getRequestStats(opName) {
        const requestName = this._requestName(opName);
        if (this.requests[requestName] == null) {
            this.requests[requestName] = new ReqStats(this.profile,
                this.latencyPercentileMode);
        }
        return this.requests[requestName];
    }

    observe(opName, error, connections, retryCount, retryDelayMs,
        rateLimitDelayMs, retryAuthCount, retryThrottleCount, requestSize,
        responseSize, requestLatency, queryReq, queryRes) {
        if (this.profile === 'NONE') {
            return;
        }
        const reqStats = this._getRequestStats(opName);
        reqStats.observe(error, retryCount, retryDelayMs, rateLimitDelayMs,
            retryAuthCount, retryThrottleCount, requestSize, responseSize,
            requestLatency);
        this.connectionStats.observe(connections);
        if (opName === 'QueryOp' && profileAtLeast(this.profile, 'ALL')) {
            if (this.extraQueryStats == null) {
                this.extraQueryStats = new ExtraQueryStats(this.profile,
                    this.latencyPercentileMode);
            }
            /*
             * Query details are collected only at ALL profile, but they remain
             * part of the current interval if the profile is lowered before the
             * snapshot is emitted.
             */
            this.extraQueryStats.observeQuery(queryReq, queryRes, error,
                retryCount, retryDelayMs, rateLimitDelayMs, retryAuthCount,
                retryThrottleCount, requestSize, responseSize,
                requestLatency);
        }
    }

    observeError(opName, connections, retryCount, retryDelayMs,
        rateLimitDelayMs, retryAuthCount, retryThrottleCount, queryReq) {
        this.observe(opName, true, connections, retryCount, retryDelayMs,
            rateLimitDelayMs, retryAuthCount, retryThrottleCount, -1, -1, -1,
            queryReq);
    }

    setProfile(profile) {
        this.profile = normalizeProfile(profile);
        for (const reqStats of Object.values(this.requests)) {
            reqStats.setProfile(this.profile);
        }
        if (this.extraQueryStats != null) {
            this.extraQueryStats.setProfile(this.profile);
        }
        return this;
    }

    getProfile() {
        return this.profile;
    }

    generateStats() {
        this.endTime = Date.now();
        const root = {};
        if (this.clientId != null) {
            root.clientId = this.clientId;
        }
        root.startTime = formatTimestamp(this.startTime);
        root.endTime = formatTimestamp(this.endTime);
        root.requests = [];
        for (const [requestName, reqStats] of Object.entries(this.requests)) {
            reqStats.toJSON(requestName, root.requests);
        }
        /*
         * Do not gate this on the current profile. The interval may contain
         * query stats that were collected while the profile was ALL.
         */
        if (this.extraQueryStats != null) {
            this.extraQueryStats.toJSON(root);
        }
        this.connectionStats.toJSON(root);
        return root;
    }

    clear() {
        for (const reqStats of Object.values(this.requests)) {
            reqStats.clear();
        }
        this.connectionStats.clear();
        if (this.extraQueryStats != null) {
            this.extraQueryStats.clear();
        }
        this.startTime = Date.now();
        this.endTime = 0;
    }

}

Stats.ReqStats = ReqStats;
Stats.ConnectionStats = ConnectionStats;
Stats.ExtraQueryStats = ExtraQueryStats;
Stats.QueryEntryStat = QueryEntryStat;
Stats.Percentile = Percentile;
Stats.BucketedPercentile = BucketedPercentile;
Stats.Profile = Object.freeze(Object.keys(PROFILE_ORDER).reduce((profiles,
    profile) => {
    profiles[profile] = profile;
    return profiles;
}, {}));
Stats.LatencyPercentileMode = LATENCY_PERCENTILE_MODE;
Stats.normalizeProfile = normalizeProfile;
Stats.normalizeLatencyPercentileMode = normalizeLatencyPercentileMode;
Stats.formatTimestamp = formatTimestamp;

module.exports = Stats;
