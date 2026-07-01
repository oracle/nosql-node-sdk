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

/*
 * Node accepts the Java-style accept(stats) object and the
 * JavaScript callback form.
 */
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

/*
 * Public controller for stats collection. It owns profile/start/stop state,
 * interval logging, handler callbacks and the internal Stats aggregator.
 */
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
        this._started = false;
        this._timer = null;
        this._intervalOutputEnabled = false;
        this._stats = null;
        this._logStartupStats();
        /*
         * Match Java StatsControlImpl: an enabled profile starts collection
         * during construction, while NONE stays stopped until start() is called.
         */
        if (this._profile !== Stats.Profile.NONE) {
            this.start();
        }
    }

    _hasIntervalOutput() {
        return this._intervalOutputEnabled;
    }

    _createStats() {
        this._stats = new Stats({
            clientId: this._id,
            profile: this._profile
        });
    }

    _isCollecting() {
        return this._started && this._stats != null &&
            this._profile !== Stats.Profile.NONE;
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

    /*
     * Deliver the generated interval snapshot to the user-provided handler,
     * matching Java's StatsHandler callback behavior.
     */
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

    /*
     * Route stats output through the configured logger when possible, falling
     * back to console-compatible loggers used by Node applications.
     */
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

    /*
     * Startup line mirrors Java StatsControlImpl and identifies the client,
     * profile, interval and logging mode before interval snapshots begin.
     */
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

    /*
     * setProfile changes collection detail only. start() is responsible for
     * enabling interval output, matching Java StatsControl lifecycle.
     */
    setProfile(profile) {
        this._profile = Stats.normalizeProfile(profile);
        if (this._stats != null) {
            this._stats.setProfile(this._profile);
        }
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
        if (this._profile !== Stats.Profile.NONE && this._stats == null) {
            this._createStats();
        }
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

    /*
     * Internal observation hooks are called from HttpClient. They intentionally
     * no-op when stats are stopped or profile is NONE so request execution is
     * unaffected.
     */
    _observe(...args) {
        /*
         * StatsControl gates collection here so HttpClient can record stats
         * without changing normal request behavior.
         */
        if (!this._isCollecting()) {
            return;
        }
        this._stats.observe(...args);
    }

    _observeError(...args) {
        if (!this._isCollecting()) {
            return;
        }
        this._stats.observeError(...args);
    }

    _observeQuery(...args) {
        if (!this._isCollecting()) {
            return;
        }
        this._stats.observeQuery(...args);
    }

    _generateStats() {
        if (this._stats == null) {
            return new Stats({
                clientId: this._id,
                profile: this._profile
            }).generateStats();
        }
        return this._stats.generateStats();
    }

    _logStats() {
        if (this._stats == null) {
            return this._generateStats();
        }
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
        if (this._stats != null) {
            this._stats.clear();
        }
        return this;
    }

    /*
     * Called from HttpClient.shutdown() during client.close(). It clears the
     * timer and emits the final interval snapshot, matching Java close behavior.
     */
    _shutdown() {
        this._clearTimer();
        if (this._stats != null) {
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
