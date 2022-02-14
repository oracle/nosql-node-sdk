/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/**
 * Defines types used as parameters and options for operations of NoSQL
 * driver.
 */

/**
 * Note: this type is only relevant when using the driver with the Cloud
 * Service or Cloud Simulator.  It is not relevant when using the driver
 * with on-premise NoSQL Database (see {@link ServiceType.KVSTORE}), in which
 * case it is ignored in the operations mentioned below and is not returned as
 * part of {@link TableResult}.
 * <p>
 * A TableLimits object is used during table creation to specify the
 * throughput and capacity to be consumed by the table. It is also used
 * in an operation to change the limits of an existing table.  These
 * operations are performed by {@link NoSQLClient#tableDDL} and
 * {@link NoSQLClient#setTableLimits} methods.  The values provided are
 * enforced by the system and used for billing purposes.
 * <p>
 * Throughput limits are defined in terms of read units and write units.  A
 * read unit represents 1 eventually consistent read per second for data up to
 * 1 KB in size. A read that is absolutely consistent is double that,
 * consuming 2 read units for a read of up to 1 KB in size. This means that if
 * an application is to use {@link Consistency.ABSOLUTE} it may need to
 * specify additional read units when creating a table. A write unit
 * represents 1 write per second of data up to 1 KB in size.
 * <p>
 * In addition to throughput, table capacity must be specified to indicate
 * the maximum amount of storage, in gigabytes, allowed for the table.
 * <p>
 * In PROVISIONED mode (the default), all 3 values must be specified whenever
 * using this object. There are no defaults and no mechanism to indicate
 * "no change."
 * <p>
 * In ON_DEMAND mode, only the storageGB parameter must be specified.
 *
 * @example //Specifying table limits when creating a provisioned table
 * client.tableDDL(
 *     'CREATE TABLE table1(id INTEGER, name STRING, PRIMARY KEY(id))',
 *     {
 *         tableLimits: {
 *             readUnits: 1000,
 *             writeUnits: 500,
 *             storageGB: 100
 *         }
 *     }
 * );
 *
 * @example //Specifying table limits when creating an on demand table
 * client.tableDDL(
 *     'CREATE TABLE table1(id INTEGER, name STRING, PRIMARY KEY(id))',
 *     {
 *         tableLimits: {
 *             storageGB: 100,
 *             mode: CapacityMode.ON_DEMAND
 *         }
 *     }
 * );
 *
 * @global
 * @typedef {object} TableLimits
 * @property {number} readUnits The desired throughput of read operation in
 * terms of read units, as a positive integer.  A read unit represents 1
 * eventually consistent read per second for data up to 1 KB in size. A read
 * that is absolutely consistent is double that, consuming 2 read units for
 * a read of up to 1 KB in size. See {@link Consistency}
 * @property {number} writeUnits The desired throughput of write operation in
 * terms of write units, as a positive integer. A write unit represents 1
 * write per second of data up to 1 KB in size
 * @property {number} storageGB The maximum storage to be consumed by the
 * table, in gigabytes, as positive integer
 * @property {CapacityMode} mode The mode of the table: CapacityMode.PROVISIONED
 * (the default) or CapacityMode.ON_DEMAND.
 */

/**
 * Version is an opaque type that represents the version of a row in the
 * database.  The driver uses Node.js Buffer to store the version.  The
 * version is returned by successful {@link NoSQLClient#get} operation
 * and can be used by {@link NoSQLClient#put},
 * {@link NoSQLClient#putIfVersion}, {@link NoSQLClient#delete} and
 * {@link NoSQLClient#deleteIfVersion} methods to conditionally perform those
 * operations to ensure an atomic read-modify-write cycle. This is an opaque
 * object from an application perspective.  Use of <em>Version</em> in this
 * way adds cost to operations so it should be done only if necessary
 * @global
 * @typedef {Buffer} Version
 */

/**
 * ContinuationKey is an opaque type that represents continuation key for
 * certain operations such as {@link NoSQLClient#deleteRange} and
 * {@link NoSQLClient#query}.  It is used to perform an operation across
 * multiple calls to these methods (such as in a loop until continuation
 * key becomes null).  This is an opaque type from application perspective
 * and only values from previous results should be used.
 * @global
 * @typedef {object} ContinuationKey
 */

/**
 * Note: On-Prem only.
 * Durability specifies the master and replica sync and ack policies to be used
 * for a write operation.
 * @see {@link NoSQLClient#put}
 *
 * @global
 * @typedef {object} Durability
 * @property {SyncPolicy} masterSync The sync policy to use on the master node.
 * @property {SyncPolicy} replicaSync The sync policy to use on a replica.
 * @property {ReplicaAckPolicy} replicaAck The replica acknowledgement policy to be used.
 * @since 5.3.0
 */

/**
 * Used to specify time to live (TTL) for rows provided to
 * {@link NoSQLClient#put} and other put methods, such as
 * {@link NoSQLClient#putIfAbsent}, {@link NoSQLClient#putIfPresent} and
 * {@link NoSQLClient#putIfVersion}.
 * TTL is restricted to durations of days and hours, with day being
 * 24 hours.  Note that you may only specify only one of
 * {@link TimeToLive}#days or {@link TimeToLive}#hours fields, not both.
 * You may specify TTL as object such as <em>{ days: numDays }</em> or
 * <em>{ hours: numHours }</em>, or if you are using duration of days
 * you can specify TTL as just a number indicating number of days, so using
 * e.g. <em>opt.ttl = 5;</em> is also allowed.
 * <p>
 * Sometimes you may may need to indicate explicitly that the record doesn't
 * expire.  This is needed when you perform put operation on existing record
 * and want to remove its expiration.  You may indicate no expiration
 * by setting days or hours of to Infinity (or just set TTL itself to
 * Infinity), or use constant {@link TTLUtil.DO_NOT_EXPIRE}.
 * <p>
 * The record expiration time is determined as follows:
 * <p>
 * Records expire on day or hour boundaries, depending on which 'days' or
 * 'hours' field is used.  At the time of the write operation, the TTL
 * parameter is used to compute the record's expiration time by first
 * converting it from days (or hours) to milliseconds, and then adding it
 * to the current system time. If the resulting expiration time is not evenly
 * divisible by the number of milliseconds in one day (or hour), it is
 * rounded up to the nearest day (or hour).  The day and hour
 * boundaries (the day boundary is at midnight) are considered in UTC time
 * zone.
 * <p>
 * The minimum TTL that can be specified is 1 hour.  Because of the rounding
 * behavior described above, the actual record duration will be longer than
 * specified in the TTL (because of rounding up).
 * <p>
 * Also note that using duration of days are recommended as it will result in
 * the least amount of storage overhead compared to duration of hours.
 * <p>
 * {@link TTLUtil} class provides functions to create and manage TTL
 * instances and convert between TTL and record expiration time.
 *
 * @see {@link TTLUtil}
 *
 * @global
 * @typedef {object} TimeToLive
 * @property {number} [days] Duration in days as positive integer or Infinity.
 * Exclusive to {@link TimeToLive}#hours
 * @property {number} [hours] Duration in hours as positive integer or
 * Infinity.  Exclusive to {@link TimeToLive}#days
 * @see {@link NoSQLClient#put}
 */

/**
 * FieldRange defines a range of values to be used in a
 * {@link NoSQLClient#deleteRange} operation, as specified in
 * <em>opt.fieldRange</em> for that operation.
 * <p>
 * FieldRange is used as the least significant component in a partially
 * specified key value in order to create a value range for an operation that
 * returns multiple rows or keys. The data types supported by FieldRange are
 * limited to the atomic types which are valid for primary keys.
 * <p>
 * The <i>least significant component</i> of a key is the first component of
 * the key that is not fully specified. For example, if the primary key for a
 * table is defined as the tuple &lt;a, b, c&gt; a FieldRange can be specified
 * for <em>a</em> if the primary key supplied is empty. A FieldRange can be
 * specified for <em>b</em> if the primary key supplied to the operation
 * has a concrete value for <em>a</em> but not for <em>b</em> or <em>c</em>.
 * </p>
 * <p>
 * This object is used to scope a {@link NoSQLClient#deleteRange} operation.
 * The fieldName specified must name a field in a table's primary key.
 * The values used must be of the same type and that type must match
 * the type of the field specified.
 * </p>
 * <p>
 * You may specify the {@link FieldValue} for lower bound, upper bound or
 * both.  Each bound may be either inclusive, meaning the range starts with
 * (for lower bound) or ends with (for upper bound) with this value, or
 * exclusive, meaning the range starts after (for lower bound) or ends before
 * (for upper bound) the value.  Properties <em>startWith</em> and
 * <em>endWith</em> specify inclusive bounds and properties
 * <em>startAfter</em> and <em>endBefore</em> specify exclusive bounds.  Note
 * that for each end of the range you may specify either inclusive or
 * exclusive bound, but not both.
 * <p>
 * Validation of this object is performed when it is used in an operation.
 * Validation includes verifying that the field is in the required key and,
 * in the case of a composite key, that the field is in the proper order
 * relative to the key used in the operation.
 *
 * @example //Using NoSQLClient#deleteRange with FieldRange
 *  let res = await this._client.deleteRange('Emp', //table name
 *      {
 *          region: 'US'             //partial primary key
 *      },
 *      {                            //opt
 *          fieldRange: {            //field range
 *              fieldName: 'id',
 *              startWith: 1050,
 *              endBefore: 1054
 *          }
 *      }
 *  );
 *
 * @see {@link NoSQLClient#deleteRange}
 *
 * @global
 * @typedef {object} FieldRange
 * @property {string} fieldName Field name for the range
 * @property {FieldValue} [startWith] {@link FieldValue} for the lower bound
 * of the range, inclusive.  May be undefined if no lower bound is enforced.
 * May not be used together with <em>startAfter</em>
 * @property {FieldValue} [startAfter] {@link FieldValue} for the lower bound
 * of the range, exclusive.  May be undefined if no lower bound is enforced.
 * May not be used together with <em>startWith</em>
 * @property {FieldValue} [endWith] {@link FieldValue} for the upper bound
 * of the range, inclusive.  May be undefined if no upper bound is enforced.
 * May not be used together with <em>endBefore</em>
 * @property {FieldValue} [endBefore] {@link FieldValue} for the upper bound
 * of the range, exclusive.  May be undefined if no upper bound is enforced.
 * May not be used together with <em>endWith</em>
 */

/**
 * Represents one of <em>put</em> or <em>delete</em> sub operations in the
 * <em>operations</em> array argument provided to
 * {@link NoSQLClient#writeMany} method.  It contains row for put operation (
 * with <em>put</em> key) or primary key for delete operation (as
 * <em>delete</em> key) and may contain additional properties representing
 * options for this sub operation.  These options are the same as used for
 * {@link NoSQLClient#put} and {@link NoSQLClient#delete} and they override
 * options specified in <em>opt</em> parameter of
 * {@link NoSQLClient#writeMany} for this sub operation.  Exceptions to
 * this are <em>timeout</em> and <em>compartment</em>
 * which cannot be specified per sub-operation, but
 * only for the whole {@link NoSQLClient#writeMany} operation.
 * <p>
 * Note that in more simple cases where operations are either all <em>put</em>
 * or all <em>delete</em> and you don't need to set per-operation options, you
 * may prefer to use {@link NoSQLClient#putMany} or
 * {@link NoSQLClient#deleteMany} methods and avoid using this type.
 *
 * @example //Adding WriteOperations to operations array
 * operations.push({
 *     put: { id: 1 , name: John },
 *     abortOnFail: true,
 *     ifAbsent: true
 * });
 * operations.push({
 *     delete: { id: 2 },
 *     matchVersion: myVer
 * }
 *
 * @see {@link NoSQLClient#writeMany}
 *
 * @global
 * @typedef {object} WriteOperation
 * @property {Row} [put] Row for <em>put</em> operation, designates this
 * operation as <em>put</em>.  One and only one of <em>put</em> or
 * <em>delete</em> properties must be set.
 * @property {Key} [delete] Primary key for <em>delete</em> operation,
 * designates this operation as <em>delete</em>.  One and only one of
 * <em>put</em> or <em>delete</em> properties must be set.
 * @property {boolean} abortOnFail If defined and true, and if this
 * operation fails, it will cause the entire {@link NoSQLClient#writeMany}
 * operation to abort
 * @property {boolean} [ifAbsent] Same as <em>opt.ifAbsent</em> for
 * {@link NoSQLClient#put}, ignored if this is a <em>delete</em> operation
 * @property {boolean} [ifPresent] Same as <em>opt.ifPresent</em> for
 * {@link NoSQLClient#put}, ignored if this is a <em>delete</em> operation
 * @property {TimeToLive|number} ttl Same as <em>opt.ttl</em> for
 * {@link NoSQLClient#put}, ignored if this is a <em>delete</em> operation
 * @property {boolean} [updateTTLToDefault] Same as
 * <em>opt.updateTTLToDefault</em> for {@link NoSQLClient#put}, ignored if
 * this is a <em>delete</em> operation
 * @property {Version} matchVersion Same as <em>opt.matchVersion</em> for
 * {@link NoSQLClient#put} or {@link NoSQLClient#delete}
 * @property {boolean} returnExisting Same as <em>opt.returnExisting</em> for
 * {@link NoSQLClient#put} or {@link NoSQLClient#delete}
 */

/**
 * Represents information about invocation of {@link NoSQLClient} method.
 * It contains the method that was called and its parameters including the
 * options <em>opt</em> parameter.  Operation object may be used in the
 * following ways:
 * <ul>
 * <li>It is available as {@link NoSQLError#operation} property allowing the
 * error code to examine the operation that caused the error.</li>
 * <li>It is available as parameter to {@link NoSQLClient} events
 * allowing to customize the behavior of event hanlders depending on what
 * operation has caused the event.</li>
 * <li>It is available as parameter to methods of {@link RetryHandler}.
 * If the application is using custom retry handler, it can customize the
 * retry logic based on what operation has caused the retryable error.</li>
 * <li>It is available as parameter to
 * {@link AuthorizationProvider}#getAuthorization method of authorization
 * provider.  If the application is using custom
 * authorization mechanism, it can customize its behavior based on what
 * operation requires authorization.</li>
 * </ul>
 * <p> Note that the {@link Operation}#opt property also extends
 * {@link Config} with which {@link NoSQLClient} instance was created, so in
 * addition to properties in <em>opt</em> argument you may use
 * {@link Operation}#opt to access all additional properties of
 * {@link Config}.
 * <p>
 * Besides the properties described below, the remaining properties of
 * {@link Operation} object represent parameters passed to the
 * {@link NoSQLClient} method and are named as such.  The values of these
 * properties are the values passed as corresponding parameters of the method.
 * E.g. if the method takes parameter <em>tableName</em> with value 'Employee'
 * then the {@link Operation} object will have property
 * <em>tableName: 'Employee'</em>.
 *
 * @example //Operation object representation
 * //The following method invocation:
 * client.tableDDL(
 *     'CREATE TABLE table1(id INTEGER, name STRING, PRIMARY KEY(id))',
 *     {
 *         tableLimits: {
 *             readUnits: 1000,
 *             writeUnits: 500,
 *             storageGB: 100
 *         }
 *     }
 * );
 * //Will be represented as the following Operation object:
 * {
 *     api: NoSQLClient#tableDDL,
 *     stmt: 'CREATE TABLE table1(id INTEGER, name STRING, PRIMARY KEY(id))',
 *     opt: {
 *         tableLimits: {
 *             readUnits: 1000,
 *             writeUnits: 500,
 *             storageGB: 100
 *         }
 *     }
 * }
 *
 * @see {@link NoSQLError#operation}
 * @see {@link event:NoSQLClient#error}
 * @see {@link event:NoSQLClient#retryable}
 * @see {@link event:NoSQLClient#consumedCapacity}
 * @see {@link RetryHandler}
 * @see {@link AuthorizationProvider}
 *
 * @global
 * @typedef {object} Operation
 * @property {function} api The API represented by the operation, which is the
 * instance method of {@link NoSQLClient} class
 * @property {object} [opt] <em>opt</em> parameter that is passed to
 * {@link NoSQLClient} methods.  Extends {@link Config}.  Other parameters are
 * also included in the {@link Operation} object, see above
 */
