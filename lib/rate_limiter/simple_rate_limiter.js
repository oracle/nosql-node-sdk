/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const process = require('process');

const sleep = require('../utils').sleep;
const NoSQLTimeoutError = require('../error').NoSQLTimeoutError;

const NANOS_IN_SEC = 1000000000;
const NANOS_IN_MS = 1000000;

/**
 * @classdesc
 * Cloud Service or Cloud Simulator only.
 * <p>
 * Default implementation of rate limiter class used by the driver.
 * Two rate limiter instances are used per each table in use, one for reads
 * and another for writes.  See {@link RateLimiter}.
 * <p>
 * This implementation uses a token bucket based algorithm, although
 * the state is kept in terms of nano time instead of tokens.  It is assumed
 * that the units refill at constant rate being equivalent to the set limit
 * of units per second.  The state is kept in terms of <em>nextNano</em> which
 * is the time when the next operation can proceed without waiting, meaning
 * the limiter is at its limit.  All operations issued before
 * <em>nextNano</em> will have to wait accordingly.  Based on the value of
 * <em>nextNano</em> and the current time, the appropriate wait time may be
 * computed before the wait begins.  If current time is >= <em>nextNano</em>,
 * no wait is needed.
 * <p>
 * Note that when {@link SimpleRateLimiter#consumeUnits} is called, the
 * entered units will only affect the wait time of subsequent operations and
 * not the current operation, which will use the value of <em>nextNano</em> as
 * it was to determine its wait time.  This should avoid needless wait time
 * when the operations come in rarely.
 * <p> Because every time when {@link SimpleRateLimiter#consumeUnits} is
 * called with units > 0, <em>nextNano</em> is pushed forward, the operations
 * will be effectively staggered in time accoridng to the order of their
 * arrival with no preferrential treatment given to any operation, thus
 * avoiding starvation.
 * <p>
 * This limiter uses burst mode, allowing a set maximum number of stored units
 * that has not been used to be consumed immediately without waiting. This
 * value is expressed as <em>maxBurstSecs</em> or duration, which is
 * effectively a maximum number of seconds worth of unused stored units.
 * The minimum duration is internally bound such that at least one unused unit
 * may be consumed without waiting.  The default value of duration is
 * 30 seconds.
 * 
 * @see {@link RateLimiter}
 * @see {@link Config}
 */
class SimpleRateLimiter {

    /**
     * Constructs an instance of SimpleRateLimiter
     * @param {number} [maxBurstSecs=30] Duration as described above
     */
    constructor(maxBurstSecs = 30) {
        this._nanosPerUnit = null;
        this._durationNanos = BigInt(maxBurstSecs * NANOS_IN_SEC);
        this._removePast = true;
        this._nextNano = BigInt(0);
    }

    _consume(units, nowNanos, timeout) {
        /* If disabled, just return success */
        if (this._nanosPerUnit == null) {
            return 0;
        }

        /* determine how many nanos we need to add based on units requested */
        const nanosNeeded = units * this._nanosPerUnit;

        /* ensure we never use more from the past than duration allows */
        let maxPast;
        if (this._removePast) {
            maxPast = nowNanos;
            this._removePast = false;
        } else {
            maxPast = nowNanos - this._durationNanos;
        }

        if (this._nextNano < maxPast) {
            this._nextNano = maxPast;
        }

        /* compute the new "next nano used" */
        const newNext = this._nextNano + BigInt(Math.round(nanosNeeded));

        /* if units < 0, we're "returning" them */
        if (units < 0) {
            /* consume the units */
            this._nextNano = newNext;
            return 0;
        }

        /*
         * if the limiter is currently under its limit, the consume
         * succeeds immediately (no sleep required).
         */
        if (this._nextNano <= nowNanos) {
            /* consume the units */
            this._nextNano = newNext;
            return 0;
        }

        /*
         * determine the amount of time that the caller needs to sleep
         * for this limiter to go below its limit. Note that the limiter
         * is not guaranteed to be below the limit after this time, as
         * other consume calls may come in after this one and push the
         * "at the limit time" further out.
         */
        let sleepMs = Number(this._nextNano - nowNanos) / NANOS_IN_MS;
        if (sleepMs < 1) {
            sleepMs = 1;
        }

        if (timeout == null || sleepMs < timeout) {
            this._nextNano = newNext;
        }

        return sleepMs;
    }

    /**
     * Implements {@link RateLimiter#consumeUnits}
     * @async
     * @see {@link RateLimiter}
     * @param {number} units Number of units to consume
     * @param {number} timeout Timeout in milliseconds
     * @param {boolean} consumeOnTimeout Whether to consume units on timeout
     * or throw an error, see {@link RateLimiter#consumeUnits}
     * @returns {Promise}  Promise resolved with sleeping time in milliseconds
     * or rejected with {@link NoSQLTimeoutError}
     */
    async consumeUnits(units, timeout, consumeOnTimeout) {
        const msToSleep = this._consume(units, process.hrtime.bigint(),
            consumeOnTimeout ? null : timeout);

        if (msToSleep === 0) {
            return 0;
        }
        
        if (timeout != null && msToSleep >= timeout) {
            //If timeout is reached we sleep for timeout ms
            await sleep(timeout);
            if (consumeOnTimeout) {
                return timeout;
            }
            //If timeout is reached and units were not consumed, we throw
            //timeout error.
            throw new NoSQLTimeoutError(`Rate limiter timed out waiting \
${timeout} ms for ${units} units`);
        }

        await sleep(msToSleep);
        return msToSleep;
    }

    /**
     * Implements {@link RateLimiter#setLimit}.  Sets the limiter limit
     * (rate) in units per second.  Also, enforces minimum duration to be able
     * to store at least one unused unit.  When changing table limits, will
     * prorate any unused units according to the new limit.
     * @param {number} limit Limit in units
     */
    setLimit(limit) {
        //If limit is not positive, assume that the limiter is disabled
        if (limit <= 0) {
            this._nanosPerUnit = null;
            return;
        }

        const oldNanosPerUnit = this._nanosPerUnit;
        this._nanosPerUnit = NANOS_IN_SEC / limit;

        if (this._durationNanos < this._nanosPerUnit) {
            this._durationNanos = BigInt(Math.round(this._nanosPerUnit));
        }

        if (oldNanosPerUnit != null) {
            const nowNanos = process.hrtime.bigint();
            //prorate any unused capacity?
            if (this._nextNano < nowNanos) {
                this._nextNano = nowNanos -
                    (BigInt)(Math.round(((Number)(nowNanos - this._nextNano) *
                    this._nanosPerUnit / oldNanosPerUnit)));
            }
        }
    }

    /**
     * Implements {@link RateLimiter#onThrottle}.  Called when throttling
     * error occurs when using this rate limiter instance.  Current
     * implementation will remove any stored units by ensuring that
     * <em>nextNano</em> is at least the current time.
     */
    onThrottle() {
        this._removePast = true;
    }

}

module.exports = SimpleRateLimiter;
