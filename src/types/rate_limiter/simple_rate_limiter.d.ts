/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { RateLimiter } from "./rate_limiter";

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
export class SimpleRateLimiter implements RateLimiter {
    /**
     * Constructs an instance of SimpleRateLimiter
     * @param {number} [maxBurstSecs=30] Duration as described above
     */
    constructor(maxBurstSecs?: number);

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
    consumeUnits(units: number, timeout: number, consumeOnTimeout: boolean):
        Promise<number>;

    /**
     * Implements {@link RateLimiter#setLimit}.  Sets the limiter limit
     * (rate) in units per second.  Also, enforces minimum duration to be able
     * to store at least one unused unit.  When changing table limits, will
     * prorate any unused units according to the new limit.
     * @param {number} limit Limit in units
     */
    setLimit(limit: number): void;

    /**
     * Implements {@link RateLimiter#onThrottle}.  Called when throttling
     * error occurs when using this rate limiter instance.  Current
     * implementation will remove any stored units by ensuring that
     * <em>nextNano</em> is at least the current time.
     */
    onThrottle(): void;
}
