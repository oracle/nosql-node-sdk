/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/**
 * Describes rate limiting in the SDK.
 */

/**
 * Cloud Service or Cloud Simulator only.
 * <p>
 * Rate limiting is used to provide efficient access to Oracle NoSQL Database
 * Cloud Service, maximize throughput and protect from resource starvation.
 * The SDK provides built-in rate limiting functionality for data operations
 * on tables such as {@link NoSQLClient#get}, {@link NoSQLClient#put},
 * {@link NoSQLClient#delete}, {@link NoSQLClient#deleteRange},
 * {@link NoSQLClient#prepare}, {@link NoSQLClient#query} and their variants.
 * Rate limiting in the driver allows spreading the operations over time thus
 * maximizing throughput by avoiding costly throttling errors and the
 * associated retry handling (see {@link ErrorCode.READ_LIMIT_EXCEEDED} and
 * {@link ErrorCode.WRITE_LIMIT_EXCEEDED}).
 * <p>
 * For general understanding of rate limiting, see articles such as
 * [Understanding and implementing rate limiting in Node.js]{@link https://blog.logrocket.com/rate-limiting-node-js/},
 * [Rate Limiting Part 1]{@link https://hechao.li/2018/06/25/Rate-Limiter-Part1/},
 * [Rate Limiting Part 2]{@link https://hechao.li/2018/06/27/Rate-Limiter-Part2/},
 * and many others.
 * <p>
 * Each operation listed above does reads and/or writes on a table and
 * thus consumes certain number of read and write units (see
 * {@link ConsumedCapacity} for more explanation).  Each table in NoSQL
 * Database Cloud Service has [table limits]{@link TableLimits} defining
 * maximum number of read and write units that can be consumed by all clients
 * accessing the table, per 1 second time.  Thus, the total rate of
 * operations on a given table is limited.  If a client tries to perform the
 * operations at faster rate, the server will respond with a read or write
 * throttling error, in which case the client can retry the operation after
 * certain time, see {@link RetryConfig}.  Handling throttling errors and
 * their retries is costly both for the server and the client application
 * since the application has to wait before an operation can be retried
 * (retrying immediately or not waiting enough will only result in another
 * throttling error and more needless load on the server).  A much better
 * strategy for a client is to spread out the operations over time to an extent
 * that the table limits for given table are not exceeded and thus avoiding
 * throttling errors and their retries.  Rate limiting built in to the SDK
 * provides this functionality.
 * <p>
 * An instance of {@link RateLimiter} class is used to enforce one table
 * limit.  Thus the driver will instantiate two instances of
 * {@link RateLimiter} class for each table in use, one for read limit and
 * another for write limit.  You have a choice of using a default
 * implementation of {@link RateLimiter} provided by the driver or providing
 * a custom impelemntation of {@link RateLimiter} class.  See
 * {@link Config}#rateLimiter.  For details on the default rate limiter, see
 * {@link SimpleRateLimiter}. To provide custom {@link RateLimiter} class,
 * implement a class with instance methods as described below and set
 * {@link Config#rateLimiter} to the constructor function of that class or
 * module name exporting this class.  The driver will create each instance
 * of this class by using its constructor with no arguments.
 * <p>
 * In order to create a pair of rate limiters for a table, the driver will
 * have to know its table limits.  The table limits are already known if one
 * of {@link NoSQLClient#tableDDL}, {@link NoSQLClient#getTable},
 * {@link NoSQLClient#forCompletion}, {@link NoSQLClient#forTableState} has
 * been called.  Otherwise, the driver will call {@link NoSQLClient#getTable}
 * in the background to obtain its table limits as soon as any data operation
 * is issued for that table.  This means that enabling rate limiting for a
 * table may be delayed until its table limits are obtained successfully in
 * the background.
 * <p>
 * The main operation of rate limiting in the driver is to call
 * {@link RateLimiter#consumeUnits} to consume a number of (read or write)
 * units for a given operation.  Depending on impelementation of
 * {@link RateLimiter}, its current state and the number of units to consume,
 * this call may asynchoronously block (sleep) for certain amount of time
 * (and return <em>Promise</em> of this amount in milliseconds) before letting
 * the operation proceed.  This API also needs to correctly operate in the
 * presence of timeout set by the caller.  See
 * {@link RateLimiter#consumeUnits} for details.  Note that it may be possible
 * to consume certain amount of units without blocking (e.g. if there has been
 * no or very little recent activity).  In this state the rate limiter is said
 * to be under its limit. Conversely, even consuming 0 units may block as a
 * result of consuming units for recent past operations.  In this state the
 * rate limiter is said to be over its limit.
 * <p>
 * Rate limiting works best when we know in advance how many units each
 * operation will consume, which would allow to know precisely how long to
 * wait before issuing each operation.  Unfortunately, we don't know how many
 * units an operation requires until we get the result back, with this
 * information returned as part of {@link ConsumedCapacity} object.  It may be
 * difficult or impossible to estimate number of units required before the
 * operation completes.  The driver takes an approach where
 * {@link RateLimiter#consumeUnits} is called twice, once before the operation
 * passing 0 units to (possibly) wait until the rate limiter is under
 * its limit and then after the operation passing the number of units returned
 * as part of {@link ConsumedCapacity} of the result.  This will allow to
 * delay subsequent operations and stagger subsequent concurrent operations
 * over time.
 * <p>
 * Also, note that by default the rate limiting only works as expected when
 * used within one {@link NoSQLClient} instance.  When using multiple
 * {@link NoSQLClient} instances, whether in the same process, different
 * process or even running on different machine, rate limiters in one instance
 * will not be aware of operations performed by other instances and thus
 * will not correctly rate limit the operations.  If multiple concurrent
 * {@link NoSQLClient} instances are required, you can set
 * {@link Config}#rateLimiterPercent to allocate only a percentage of each
 * table's limits to each instance.  Although not optimal (not accounting for
 * overuse or underuse at a particular instance), this will allow correct
 * rate limiting of operations on multiple concurrent instances.
 * <p>
 * As mentioned above, the driver provides a default rate limiter as
 * {@link SimpleRateLimiter} class, which you can use by setting
 * {@link Config}#rateLimiter to <em>true</em>.  Alternatively, you can
 * provide your own custom rate limiter class by setting
 * {@link Config}#rateLimiter to its constructor function or module name
 * that exports it.
 * <p>
 * Unfortunately, there is no perfect driver-side rate limiting stategy so
 * it is still possible for throttling errors to occur.  {@link RateLimiter}
 * interface provides {@link RateLimiter#onThrottle} method that the driver
 * calls when an operation results in throttling error.  When creating
 * custom rate limiter, implementing this method will allow you to adjust
 * the rate limiter's state to account for this information.
 * 
 * @see {@link Config}
 * @see {@link SimpleRateLimiter}
 * 
 * @interface RateLimiter
 */

/**
 * Configures rate limiter by setting its limit in units. Note that this
 * method is called both when rate limiter is configured for the first time
 * and also if/when table limits change, so it may need to account for the
 * current state due to outstanding operations already rate-limited by this
 * instance, however there is no need to change state or sleep time of these
 * outstanding operations and the new limit only needs to apply to the new
 * operations issued.
 * @function RateLimiter#setLimit 
 * @param {number} limit Limit in units
 */

/**
 * This function should consume the number of units provided and if needed,
 * block (sleep) asynchronoulsy for the amount of time computed from current
 * state and the units provided.
 * @function RateLimiter#consumeUnits
 * @async
 * @param {number} units Number of units to consume
 * @param {number} timeout Timeout in milliseconds.  The resulting amount of
 * time to sleep should not exceed this timeout.  If the sleep time exceeds
 * the timeout, the behavior should be according to
 * <em>consumeOnTimeout</em> parameter, see below
 * @param {boolean} consumeOnTimeout Defines how rate limiter behaves when
 * the timeout is reached.  If <em>false</em>, this call should result in
 * error (use appropriate error class for your application) and the units
 * should not be consumed.  If <em>true</em>, the units should be consumed
 * even when timeout is reached and the call completed successfully.  In
 * either case, if the computed wait time exceeds timeout, this call should
 * still block for the amount of time equal to the timeout before either
 * throwing an error or returning successfully (depending on the value of
 * <em>consumeOnTimeout</em>).  The driver uses
 * <em>consumeOnTimeout</em>=<em>true</em> when
 * calling {@link RateLimiter#consumeUnits} after an operation completes
 * successfully (see above), in which case the error should not be thrown and
 * the result of the operation should be returned to the application
 * @returns {Promise} Promise resolved with the amount of time blocked in
 * milliseconds (or 0 if the operation was not blocked) or rejected with an
 * error if timeout is reached and <em>consumeOnTimeout</em> is <em>false</em>
 */

/**
 * Defines the behavior of the rate limiter when throttling error occurs.  If
 * throttling error has occured, this usually means that current rate limiter
 * state does not correctly reflect the rate of incoming operations and needs
 * to be adjusted.  For example, you may remove any unused credits that were
 * previously used to allow operations to proceed without waiting.
 * @function RateLimiter#onThrottle
 * @param {NoSQLError} error An error indicating either
 * {@link ErrorCode.READ_LIMIT_EXCEEDED} or
 * {@link ErrorCode.WRITE_LIMIT_EXCEEDED}
 */
