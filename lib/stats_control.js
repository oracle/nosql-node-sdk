/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const Stats = require('./stats');
const PACKAGE_VERSION = require('./constants').PACKAGE_VERSION;

const LOG_PREFIX = 'Client stats|';
const DEFAULT_INTERVAL = 600;

function createClientId() {
    return Math.floor(Math.random() * 0xFFFFFFFF).toString(16);
}

function isStatsHandler(handler) {
    return typeof handler === 'function' ||
        (handler != null && typeof handler === 'object' &&
        typeof handler.accept === 'function');
}

function checkStatsHandler(handler) {
    if (handler != null && !isStatsHandler(handler)) {
        throw new Error('Invalid stats handler');
    }
}

function checkInterval(interval) {
    if (!Number.isInteger(interval) || interval < 1) {
        throw new Error('Stats interval can not be less than 1 second.');
    }
}

class StatsControl {

    constructor(options = {}) {
        this._id = options.clientId || createClientId();
        this._profile = Stats.normalizeProfile(options.profile);
        this._interval = options.interval == null ?
            DEFAULT_INTERVAL : options.interval;
        checkInterval(this._interval);
        this._prettyPrint = !!options.prettyPrint;
        this._enableLog = !!options.enableLog;
        this._rateLimitingEnabled = !!options.rateLimitingEnabled;
        this._statsHandler = options.statsHandler;
        checkStatsHandler(this._statsHandler);
        this._logger = options.logger || console;
        this._started = this._profile !== Stats.Profile.NONE;
        this._timer = null;
        this._intervalOutputEnabled = this._profile !== Stats.Profile.NONE;
        this._stats = new Stats({
            clientId: this._id,
            profile: this._profile
        });
        this._logStartupStats();
        this._ensureTimer();
    }

    _hasIntervalOutput() {
        return this._intervalOutputEnabled;
    }

    _getInitialDelayMs() {
        const intervalMs = this._interval * 1000;
        const now = new Date();
        const elapsedInHourMs = now.getMinutes() * 60000 +
            now.getSeconds() * 1000 + now.getMilliseconds();
        const delayMs = intervalMs - (elapsedInHourMs % intervalMs);
        return delayMs === 0 ? intervalMs : delayMs;
    }

    _ensureTimer() {
        if (this._timer != null || !this._hasIntervalOutput()) {
            return;
        }

        /*
         * Schedule snapshots on wall-clock interval boundaries, like the Java
         * implementation, so periodic output is stable across clients.
         */
        const run = () => {
            try {
                this._logStats();
            } catch(err) {
                this._logStatsError(err);
            }
        };
        this._timer = setTimeout(() => {
            run();
            if (!this._hasIntervalOutput()) {
                this._timer = null;
                return;
            }
            this._timer = setInterval(run, this._interval * 1000);
            if (typeof this._timer.unref === 'function') {
                this._timer.unref();
            }
        }, this._getInitialDelayMs());
        if (typeof this._timer.unref === 'function') {
            this._timer.unref();
        }
    }

    _clearTimer() {
        if (this._timer == null) {
            return;
        }
        clearTimeout(this._timer);
        clearInterval(this._timer);
        this._timer = null;
    }

    _callStatsHandler(stats) {
        if (this._statsHandler == null) {
            return;
        }
        if (typeof this._statsHandler === 'function') {
            this._statsHandler(stats);
        } else {
            this._statsHandler.accept(stats);
        }
    }

    _log(message) {
        if (!this._enableLog) {
            return;
        }
        if (this._logger != null && typeof this._logger.info === 'function') {
            this._logger.info(message);
        } else if (this._logger != null &&
            typeof this._logger.log === 'function') {
            this._logger.log(message);
        }
    }

    _logStatsError(err) {
        if (!this._enableLog || this._logger == null) {
            return;
        }
        const message = err && err.stack ? err.stack : String(err);
        if (typeof this._logger.error === 'function') {
            this._logger.error(message);
        } else if (typeof this._logger.log === 'function') {
            this._logger.log(message);
        }
    }

    _logStartupStats() {
        if (this._profile === Stats.Profile.NONE) {
            return;
        }
        this._log(LOG_PREFIX + JSON.stringify({
            sdkName: 'Oracle NoSQL SDK for Node.js',
            sdkVersion: PACKAGE_VERSION,
            clientId: this._id,
            profile: this._profile,
            intervalSec: this._interval,
            prettyPrint: this._prettyPrint,
            rateLimitingEnabled: this._rateLimitingEnabled
        }));
    }

    getInterval() {
        return this._interval;
    }

    setProfile(profile) {
        this._profile = Stats.normalizeProfile(profile);
        this._stats.setProfile(this._profile);
        return this;
    }

    getProfile() {
        return this._profile;
    }

    setPrettyPrint(prettyPrint) {
        this._prettyPrint = !!prettyPrint;
        return this;
    }

    getPrettyPrint() {
        return this._prettyPrint;
    }

    setStatsHandler(handler) {
        checkStatsHandler(handler);
        this._statsHandler = handler;
        return this;
    }

    getStatsHandler() {
        return this._statsHandler;
    }

    start() {
        this._started = true;
        if (this._profile !== Stats.Profile.NONE) {
            this._intervalOutputEnabled = true;
        }
        this._ensureTimer();
    }

    stop() {
        /*
         * Stop suppresses new observations but intentionally leaves periodic
         * output active. Java still emits empty interval snapshots after stop().
         */
        this._started = false;
    }

    isStarted() {
        return this._started;
    }

    _observe(...args) {
        /*
         * StatsControl gates collection here so HttpClient can record stats
         * without changing normal request behavior.
         */
        if (!this._started || this._profile === Stats.Profile.NONE) {
            return;
        }
        this._stats.observe(...args);
    }

    _observeError(...args) {
        if (!this._started || this._profile === Stats.Profile.NONE) {
            return;
        }
        this._stats.observeError(...args);
    }

    _observeQuery(...args) {
        if (!this._started || this._profile === Stats.Profile.NONE) {
            return;
        }
        this._stats.observeQuery(...args);
    }

    _generateStats() {
        return this._stats.generateStats();
    }

    _logStats() {
        const stats = this._generateStats();
        /*
         * Each periodic log is an interval snapshot. Clear after generating it
         * so the next interval starts with fresh counters.
         */
        this._stats.clear();
        this._callStatsHandler(stats);
        this._log(LOG_PREFIX + JSON.stringify(stats, null,
            this._prettyPrint ? 2 : 0));
        return stats;
    }

    _clear() {
        this._stats.clear();
        return this;
    }

    _shutdown() {
        this._clearTimer();
        if (this._hasIntervalOutput()) {
            try {
                this._logStats();
            } catch(err) {
                this._logStatsError(err);
            }
        }
    }

}

StatsControl.LOG_PREFIX = LOG_PREFIX;
StatsControl.Profile = Stats.Profile;
StatsControl._isStatsHandler = isStatsHandler;

module.exports = StatsControl;
