/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { TimeToLive } from "./param";
import type { NoSQLArgumentError } from "./error";

/**
 * @classdesc  TTLUtil is a utility class that may be used to create and
 * manage {@link TimeToLive} objects and convert between TTL and record
 * expiration time.  TTL behavior and relation to record expiration time
 * is described in {@link TimeToLive}.  Note that on input durations, TTL
 * objects and expiration times are validated for correctness and
 * {@link NoSQLArgumentError} is thrown if the representation is invalid.
 * @see {@link TimeToLive}
 */
export class TTLUtil {
    /**
     * @hidden
     */
    private constructor();

    /**
     * Convenience constant to indicate that the row should not expire.  It
     * can be passed as TTL to a put operation to remove expiration from
     * existing row.
     */
    static readonly DO_NOT_EXPIRE: TimeToLive;

    /**
     * Convenience constant representing number of milliseconds in 1 hour.
     */
     static readonly MILLIS_IN_HOUR: number;

     /**
      * Convenience constant representing number of milliseconds in 1 day.
      */
     static readonly MILLIS_IN_DAY: number;
 
    /**
     * Creates TTL with duration of hours
     * @param {number} hours Number of hours as positive integer or Infinity
     * @returns {TimeToLive} TTL object
     * @throws {NoSQLArgumentError} if 'hours' parameter is invalid
     */
    static ofHours(hours: number): TimeToLive;

    /**
     * Creates TTL with duration of days
     * @param {number} days Number of days as positive integer or Infinity
     * @returns {TimeToLive} TTL object
     * @throws {NoSQLArgumentError} if 'days' parameter is invalid
     */
    static ofDays(days: number): TimeToLive;

    /**
     * Returns the number of days in the TTL.  If the TTL is specified in
     * hours, the resulting days value is rounded down, which will result in 0
     * if TTL.hours < 24.
     * @param {TimeToLive} ttl TTL object
     * @returns {number} Number of days in the TTL object or Infinity
     * @throws {NoSQLArgumentError} if TTL object is invalid
     */
    static toDays(ttl: TimeToLive): number;

    /**
     * Returns the number of hours in the TTL.  If the TTL is specified in
     * days, the return value is TTL.days * 24.
     * @param {TimeToLive} ttl TTL object
     * @returns {number} Number of hours in the TTL object or Infinity
     * @throws {NoSQLArgumentError} if TTL object is invalid
     */
    static toHours(ttl: TimeToLive): number;

    /**
     * Returns number of milliseconds in the TTL.  This is equivalent to
     * {@link TTLUtil.toHours} multiplied by {@link TTLUtil.MILLIS_IN_HOUR}.
     * @param {TimeToLive} ttl TTL object 
     * @returns {number} Number of milliseconds in the TTL object or Infinity
     * @throws {NoSQLArgumentError} if TTL object is invalid
     * @see {@link toHours}
     */
    static toMillis(ttl: TimeToLive): number;

    /**
     * Converts TTL to absolute expiration time in milliseconds since Unix
     * epoch (January 1, 1970, 00:00:00 UTC).  This method is the same as
     * {@link TTLUtil.toExpirationTime} returning time in milliseconds
     * instead of as Date object.
     * @param {TimeToLive} ttl TTL object 
     * @param {Date|number} referenceTime Reference time represented
     * as {@link !Date | Date} or number of milliseconds since Unix
     * epoch
     * @returns {number} Expiration time in milliseconds since Unix epoch or
     * Infinity
     * @throws {NoSQLArgumentError} if TTL object or referenceTime is invalid
     * @see {@link TTLUtil.toExpirationTime}
     */
    static toExpirationTimeMillis(ttl: TimeToLive,
        referenceTime: Date|number): number;

    /**
     * Converts TTL to absolute expration time given the reference time from
     * which to measure the expiration.  The semantics follows the rounding
     * behavior described in {@link TimeToLive} so that the returned value
     * will be rounded up to the nearest hour or day boundary.
     * @param {TimeToLive} ttl TTL object 
     * @param {Date|number} referenceTime Reference time represented
     * as {@link !Date | Date} or number of milliseconds since Unix epoch
     * @returns {Date} Expiration time as <em>Date</em>
     * instance, may be invalid if ttl represents no expiration (Infinity)
     * @throws {NoSQLArgumentError} if TTL object or referenceTime is invalid
     */
    static toExpirationTime(ttl: TimeToLive,
        referenceTime: Date|number): Date;

    /**
     * Constructs TTL from absolute expiration time given reference time from
     * which to measure record expration.  TTL is computed as follows.  First,
     * expirationTime is rounded up to the nearest hour boundary.  If
     * <em>inHours</em> argument is specified, then the returned TTL will be
     * in hours or days depending on whether <em>inHours</em> is true or
     * false.  If <em>inHours</em> is not specified, we check if the adjusted
     * expiration time indicates midnight in UTC time zone, in which case
     * the retured TTL will be in days, otherwise it will be in hours.  Then,
     * the duration is computed as the difference between the adjusted
     * expiration time and the reference time rounded up to the nearest hour
     * or day (depending on which is used in the returned TTL as described
     * above) and TTL with that duration is returned.  Note that if
     * expiration time is before or equal to the reference time, it is
     * possible that the returned value will contain 0 or negative duration,
     * which indicates that the record has already expired.
     * @param {Date|number} expirationTime Expiration time
     * represented as <em>Date</em> or number of milliseconds
     * since Unix epoch
     * @param {Date|number} referenceTime Reference time represented
     * as <em>Date</em> or number of milliseconds since Unix
     * epoch
     * @param {boolean} [inHours] Whether to return TTL in hours or days.  If
     * not specified, the unit of hours or days is determined as described
     * above
     * @returns {TimeToLive} TTL object
     * @throws {NoSQLArgumentError} if expirationTime or referenceTime is
     * invalid
     */
    static fromExpirationTime(expirationTime: Date|number,
        referenceTime: Date|number, inHours?: boolean): TimeToLive;
}
