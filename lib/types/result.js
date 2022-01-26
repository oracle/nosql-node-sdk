/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/**
 * Defines operation result types for NoSQL driver.
 */

/**
 * TableResult object is the result of {@link NoSQLClient#tableDDL},
 * {@link NoSQLClient#setTableLimits}, {@link NoSQLClient#getTable} and
 * and may also be the result of {@link NoSQLClient#forCompletion} method.
 * It encapsulates the state of the table that is the target of the operation.
 * <p>
 * Operations performed by {@link NoSQLClient#tableDDL} such as table
 * creation, modification, and drop are potentially long running and not
 * necessarily completed when {@link NoSQLClient#tableDDL} returns result
 * and the table may still be in one of its intermediate states.  You may call
 * {@link NoSQLClient#forCompletion} to be notified when the operation
 * completes and the table reaches desired state (which, depending on the
 * operation, would be either {@link TableState.ACTIVE} or
 * {@link TableState.DROPPED}.
 * You may also call {@link NoSQLClient#getTable} to receive static
 * information about the table as well as its current state.
 *
 * @global
 * @typedef {object} TableResult
 * @property {string} compartmentId Cloud service only.  Compartment id of
 * the table
 * @property {TableState} tableState Current table state,
 * see {@link TableState}
 * @property {string} tableName Table name
 * @property {string} schema Table schema, in JSON format
 * @property {TableLimits} tableLimits Table limits, see {@link TableLimits}
 * @property {string} operationId Operation id of the operation that returned
 * this result, if this result is returned by {@link NoSQLClient#tableDDL}
 * or {@link NoSQLClient#setTableLimits} methods.  It is used when the
 * {@link TableResult} is subsequently passed to
 * {@link NoSQLClient#forCompletion} or {@link NoSQLClient#getTable} as the
 * first parameter to identify the operation and check for any errors from
 * that operation
 */

/**
 * Note: this type is only relevant when using the driver with the Cloud
 * Service.  It is not relevant when using the driver
 * with on-premise NoSQL Database (see {@link ServiceType.KVSTORE}).
 * <p>
 * TableUsage objects are part of {@link TableUsageResult}, that is the result
 * of {@link NoSQLClient#getTableUsage} method.  TableUsage represents a
 * single usage record, or slice, that includes information about read and
 * write throughput consumed during that period as well as the current
 * information regarding storage capacity. In addition the count of throttling
 * exceptions for the period is reported.
 *
 * @global
 * @typedef {object} TableUsage
 * @property {Date} startTime Start time for this usage record as
 * JavaScript Date object
 * @property {number} secondsInPeriod Number of seconds in this usage record
 * @property {number} readUnits Number of read units consumed during this
 * period, see {@link TableLimits} for explanation
 * @property {number} writeUnits Number of write units consumed during this
 * period, see {@link TableLimits} for explanation
 * @property {number} storageGB Amount of storage in Gigabytes consumed by the
 * table. This information may be out of date as it is not maintained in real
 * time
 * @property {number} readThrottleCount Number of read throttling exceptions
 * on this table in the time period, see {@link ErrorCode.READ_LIMIT_EXCEEDED}
 * @property {number} writeThrottleCount Number of write throttling exceptions
 * on this table in the time period, see {@link ErrorCode.WRITE_LIMIT_EXCEEDED}
 * @property {number} storageThrottleCount Number of storage throttling
 * exceptions on this table in the time period, see
 * {@link ErrorCode.SIZE_LIMIT_EXCEEDED}
 */

/**
 * Note: this type is only relevant when using the driver with the Cloud
 * Service.  It is not relevant when using the driver
 * with on-premise NoSQL Database (see {@link ServiceType.KVSTORE}).
 * <p>
 * TableUsageResult is the result of {@link NoSQLClient#getTableUsage} method.
 * It encapsulates the dynamic state of the requested table.
 * @see {@link NoSQLClient#getTableUsage}
 * @see {@link TableUsage}
 *
 * @global
 * @typedef {object} TableUsageResult
 * @property {string} tableName Table name
 * @property {TableUsage[]} usageRecords Array of {@link TableUsage} records
 * based on options provided to {@link NoSQLClient#getTableUsage}. May be
 * empty if no usage records is found for requested time period
 */

/**
 * IndexInfo represents the information about a single index including its
 * name and field names.  Array of IndexInfo objects is the result of
 * {@link NoSQLClient#getIndexes} method and a single IndexInfo object is
 * the result of {@link NoSQLClient#getIndex} method.
 * @see {@link NoSQLClient#getIndexes}
 * @see {@link NoSQLClient#getIndex}
 *
 * @global
 * @typedef {object} IndexInfo
 * @property {string} indexName Index name
 * @property {string[]} fields Array of field names that define the index
 */

/**
 * Represents the result of a {@link NoSQLClient#listTables} operation.
 * <p>
 * On a successful operation the table names are available as well as the
 * index of the last returned table. Tables are returned in an array, sorted
 * alphabetically.
 * @see {@link NoSQLClient#listTables}
 *
 * @global
 * @typedef {object} ListTablesResult
 * @property {string[]} tables Array of table names returned by the operation
 * @property {number} lastIndex Next index after the last table name returned
 * (last table index + 1). This can be used as <em>opt.startIndex</em> when
 * calling {@link NoSQLClient#listTables} to page table list
 */

/**
 * Note: this type is only relevant when using the driver with the Cloud
 * Service or Cloud Simulator.  It is not relevant when using the driver
 * with on-premise NoSQL Database (see {@link ServiceType.KVSTORE}), in which
 * case it is not a part of the operation results mentioned below.
 * <p>
 * ConsumedCapacity is part of results of data operations such as
 * {@link GetResult}, {@link PutResult}, {@link DeleteResult},
 * {@link MultiDeleteResult}, {@link WriteMultipleResult},
 * {@link PrepareResult} and {@link QueryResult}.  It contains read and write
 * throughputs consumed by the operation in KBytes as well as in read and
 * write units.  Thoughput in read and write units is defined as following:
 * <p>
 * A read unit represents 1 eventually consistent read per second for data up
 * to 1 KB in size. A read that is absolutely consistent is double that,
 * consuming 2 read units for a read of up to 1 KB in size. This means that if
 * an application is to use {@link Consistency.ABSOLUTE} it may need to
 * specify additional read units when creating a table. A write unit
 * represents 1 write per second of data up to 1 KB in size.  Note that:
 * <ul>
 * <li>For read operations, such as {@link NoSQLClient#get},
 * {@link NoSQLClient#prepare} and {@link NoSQLClient#query}, the number of
 * units consumed {@link ConsumedCapacity}#readUnits maybe larger than the
 * number of read KBytes {@link ConsumedCapacity}#readKB if the operation used
 * absolute consistency.  See {@link Consistency.ABSOLUTE}.</li>
 * <li>For update operations, such as {@link NoSQLClient#put},
 * {@link NoSQLCLient#delete}, {@link NoSQLClient#deleteRange},
 * {@link NoSQLClient#writeMany} and others, the number of read units consumed
 * {@link ConsumedCapacity}#readUnits may also be larger than the number of
 * read KBytes {@link ConsumedCapacity}#readKB.</li>
 * </ul>
 * <p>
 * When driver-side rate limiting is enabled (see {@link Config}#rateLimiter),
 * two additional properties, <em>readRateLimitDelay</em> and
 * <em>writeRateLimitDelay</em> may be set.  They specify how long given
 * operation was delayed by the rate limiter due to reads and writes
 * performed, respectively (note that each of these values is set only if
 * given operation does reads and/or writes, correspondingly).  These values
 * may be useful in gathering statistics to analyze performance and adjust
 * rate limiter configuration (when using custom rate limiter).
 * See {@link RateLimiter}.  Note that total time the operation was delayed
 * due to rate limiting is <em>readRateLimitDelay</em> (if set) +
 * <em>writeRateLimitDelay</em> (if set).
 * 
 * @global
 * @typedef {object} ConsumedCapacity
 * @property {number} readKB Read throughput consumed by this operation, in
 * KBytes
 * @property {number} writeKB Write throughtput consumed by this operation, in
 * KBytes
 * @property {number} readUnits Read throughput consumed by this operation, in
 * read units
 * @property {number} writeUnits Write throughtput consumed by this operation,
 * in write units
 * @property {number} readRateLimitDelay When rate limiting is enabled,
 * specifies how long the operation has been delayed, in milliseconds, due to
 * the table read limit.  This value may be 0 if given operation was not
 * delayed by the read rate limiter.  Not set if rate limiting is disabled or
 * if given operation does not perform reads.
 * @property {number} writeRateLimitDelay When rate limiting is
 * enabled, specifies how long the operation has been delayed, in
 * milliseconds, due to the table write limit.  This value may be 0 if the
 * operation was not delayed by the write rate limiter.  Not set if rate
 * limiting is disabled or if given operation does not perform writes.
 */

/**
 * Represents the result of {@link NoSQLClient#get} operation.
 *
 * @global
 * @typedef {object} GetResult
 * @property {ConsumedCapacity} consumedCapacity Capacity consumed by this
 * operation, see {@link ConsumedCapacity}
 * @property {Row|null} row Value of the returned {@link Row} or null if
 * the row does not exist
 * @property {Date} expirationTime Expiration time of the row.  If
 * the row exists but does not expire or the row does not exist, this value is
 * undefined
 * @property {Version} version {@link Version} of the returned row.  If the
 * row does not exist, this value is undefined
 */

/**
 * Represents the result of {@link NoSQLClient#put},
 * {@link NoSQLClient#putIfAbsent}, {@link NoSQLClient#putIfPresent} and
 * {@link NoSQLClient#putIfVersion} methods and may also be one of results
 * in {@link WriteMultipleResult}.
 *
 * @global
 * @typedef {object} PutResult
 * @property {ConsumedCapacity} consumedCapacity Capacity consumed by this
 * operation, see {@link ConsumedCapacity}
 * @property {boolean} success Whether the put operation was successful, as
 * described in {@link NoSQLClient#put}
 * @property {Version} version {@link Version} of the new row if the put
 * operation was successful, otherwise undefined
 * @property {Row} existingRow Existing {@link Row} value if
 * available, otherwise undefined.  This value will only be available if the
 * conditional put operation failed and <em>opt.returnExisting</em> was set to
 * true for {@link NoSQLClient#put}, {@link NoSQLClient#putIfAbsent} or
 * {@link NoSQLClient#putIfVersion} methods
 * @property {Version} existingVersion Existing row {@link Version} if
 * available, otherwise undefined.  This value will only be available if the
 * conditional put operation failed and <em>opt.returnExisting</em> was set
 * to true for {@link NoSQLClient#put}, {@link NoSQLClient#putIfAbsent} or
 * {@link NoSQLClient#putIfVersion} methods
 * @property {FieldValue} generatedValue Value generated if the operation
 * created a new value for an identity column or string as uuid column. Present
 * only if a value was generated for that column by this operation
 */

/**
 * Represents the result of {@link NoSQLClient#delete} and
 * {@link NoSQClient#deleteIfVersion} methods and may also be one of results
 * in {@link WriteMultipleResult}.
 *
 * @global
 * @typedef {object} DeleteResult
 * @property {ConsumedCapacity} consumedCapacity Capacity consumed by this
 * operation, see {@link ConsumedCapacity}
 * @property {boolean} success Whether the delete operation was successful, as
 * described in {@link NoSQLClient#delete}
 * @property {Row} existingRow Existing {@link Row} value if available,
 * otherwise undefined.  This value will only be available if the conditional
 * delete operation failed and <em>opt.returnExisting</em> was set
 * to true for {@link NoSQLClient#delete} or
 * {@link NoSQLClient#deleteIfVersion} methods
 * @property {Version} existingVersion Existing row {@link Version} if
 * available, otherwise undefined.  This value will only be available if the
 * conditional put operation failed and <em>opt.returnExisting</em> was set
 * to true for {@link NoSQLClient#delete}
 * or {@link NoSQLClient#deleteIfVersion} methods
 */

/**
 * Represents the result of a {@link NoSQLClient#deleteRange} method.
 * <p>
 * On a successful operation the number of rows deleted is available using
 * {@link MultiDeleteResult}#deletedCount. There is a limit to the amount of
 * data consumed by a single request to the server. If there are still more
 * rows to delete, the continuation key will be available as
 * {@link MultiDeleteResult}#continuationKey.
 * @see NoSQLClient#deleteRange
 *
 * @global
 * @typedef {object} MultiDeleteResult
 * @property {ConsumedCapacity} consumedCapacity Capacity consumed by this
 * operation, see {@link ConsumedCapacity}
 * @property {number} deletedCount Number of rows deleted
 * @property {ContinuationKey} continuationKey Continuation key where the
 * next call to {@link NoSQLClient#deleteRange} can resume from, or null if
 * there are no more rows to delete
 */

/**
 * Represents the result of a {@link NoSQLClient#writeMany},
 * {@link NoSQLClient#putMany} or {@link NoSQLClient#deleteMany} methods.
 * <p>
 * If the operation succeeds, the execution result of each sub operation is
 * available in {@link WriteMultipleResult}#results property.
 * <p>
 * If the operation is aborted because of the failure of a sub operation with
 * <em>opt.abortOnFail</em> set to true (either for that operation or for
 * the whole method), then the index of failed operation is available
 * as {@link WriteMultipleResult}#failedOpIndex and the execution result of
 * failed operation is available as
 * {@link WriteMultipleResult}#failedOpResult.  The
 * {@link WriteMultipleResult}#results property will be undefined in this
 * case.  You may check for the success of the entire operation by whether
 * {@link WriteMultipleResult}#results is defined.
 *
 * @see {@link NoSQLClient#writeMany}
 * @see {@link NoSQLClient#putMany}
 * @see {@link NoSQLClient#deleteMany}
 *
 * @global
 * @typedef {object} WriteMultipleResult
 * @property {ConsumedCapacity} consumedCapacity Capacity consumed by this
 * operation, see {@link ConsumedCapacity}
 * @property {object[]} results Array of results if the
 * operation succeeded, undefined otherwise.  Each result in the array is
 * either {@link PutResult} or {@link DeleteResult} depending on the sub
 * operation and has the same index in the array as its corresponding
 * operation object provided in the <em>operations</em> array to
 * {@link NoSQLClient#writeMany} (same holds for rows and keys provided to
 * {@link NoSQLClient#putMany} and {@link NoSQLClient#deleteMany} methods).
 * Note that sub operation results do not contain {@link ConsumedCapacity}
 * @property {number} failedOpIndex Index of failed sub operation that
 * resulted in the entire operation aborting.  Undefined if the operation was
 * successul
 * @property {(PutResult|DeleteResult)} failedOpResult Result of failed sub
 * operation that resulted in the entire operation aborting.  Undefined if
 * the operation was successful
 */

/**
 * This is a super type for {@link PreparedStatement} class, instance
 * of which is the result of {@link NoSQLClient#prepare} method.  The
 * properties described below are available as properties of
 * {@link PreparedStatement} class instances.
 *
 * @global
 * @typedef {object} PrepareResult
 * @property {ConsumedCapacity} consumedCapacity Capacity consumed by
 * <em>prepare</em> operation, see {@link ConsumedCapacity}
 */

/**
 * QueryResult represents the result of {@link NoSQLClient#query} method and
 * results returned by iteration over {@link NoSQLClient#queryIterable}.
 * It contains a list of {@link Row} instances representing the query results.
 * <p>
 * The shape of the values is based on the schema implied by the query. For
 * example a query such as "SELECT * FROM ..." that returns an intact row will
 * return values that conform to the schema of the table. Projections return
 * instances that conform to the schema implied by the statement. UPDATE
 * queries either return values based on a RETURNING clause or, by default,
 * the number of rows affected by the statement.
 * <p>
 * For {@link NoSQLCLient#query} method, if the value of
 * {@link QueryResult}#continuationKey is not null there are additional
 * results available.  That value can be supplied as
 * <em>opt.continuationKey</em> to subsequent call to
 * {@link NoSQLClient#query} to continue the query.  It is possible for a
 * query to return no results in an empty list but still have a non-null
 * continuation key. This happens if the query reads the maximum amount of
 * data allowed in a single request without matching a query predicate. In
 * this case, the continuation key must be used to get results, if any exist.
 * <p>
 *
 * @see {@link NoSQLClient#query}
 *
 * @global
 * @typedef {object} QueryResult
 * @property {ConsumedCapacity} consumedCapacity Capacity consumed by this
 * operation, see {@link ConsumedCapacity}
 * @property {Row[]} rows Results for the query as array of {@link Row}
 * instances, the array may be empty
 * @property {ContinuationKey} continuationKey Continuation key, or null if
 * there are no more results available
 */

/**
 * On-premise only.
 * <p>
 * AdminResult object is the result of {@link NoSQLClient#adminDDL},
 * {@link NoSQLClient#adminStatus} and may also be the result of
 * {@link NoSQLClient#forCompletion} methods.  It encapsulates the state of
 * admin DDL operation (see {@link NoSQLClient#adminDDL}).
 * <p>
 * Some operations initiated by {@link NoSQLClient#adminDDL} are performed by
 * the service asynchronously so that getting result from
 * {@link NoSQLClient#adminDDL} does not imply operation completion.  In this
 * case you may call {@link NoSQLClient#forCompletion} to be notified when
 * the operation is completed by the service.  You may also call
 * {@link NoSQLClient#adminStatus} to receive current status of the operation.
 * Other operations are immediate and are completed when result from
 * {@link NoSQLClient#adminDDL} is returned.
 * <p>
 * You may distinguish these types of operations in the following way:
 * <ul>
 * <li>Asynchronous operations may return a non-null <em>operationId</em></li>
 * <li>Asynchronous operations modify system state, while immediate operations
 * are read-only</li>
 * <li>Result returned by {@link NoSQLClient#adminDDL} for immediate
 * operations has <em>state</em> {@link AdminState.COMPLETE} and has a
 * non-null <em>output</em></li>
 * </ul>
 *
 * @see {@link NoSQLClient#adminDDL}
 * @see {@link NoSQLClient#forCompletion}
 * @see {@link NoSQLClient#adminStatus}
 *
 * @global
 * @typedef {object} AdminResult
 * @property {AdminState} state Current state of the operation, which is
 * either complete or in-progress, see {@link AdminState}
 * @property {string} operationId Operation id of the operation that returned
 * this result, if this result is returned by {@link NoSQLClient#adminDDL} and
 * the operation is performed by the service asynchronously.   It is used when
 * this {@link AdminResult} is subsequently passed to
 * {@link NoSQLClient#forCompletion} or {@link NoSQLClient#adminStatus} as the
 * first parameter to identify the operation and check for any errors from
 * that operation
 * @property {string} statement Statement for the operation
 * @property {string} output The output of the operation as a string.  It is
 * non-null for read-only immediate operations such as SHOW operations and is
 * null for operations that modify system state and are performed by the service
 * asynchronously such as CREATE, DROP, GRANT, etc.
 */

/**
 * On-premise only.
 * <p>
 * Represents information associated with a user including the id and user
 * name in the system.  {@link NoSQLClient#listUsers} method returns array of
 * {@link UserInfo} objects for each user.
 * @see {@link NoSQLClient#listUsers}
 * @global
 * @typedef {object} UserInfo
 * @property {string} id User id
 * @property {string} name User name
 */
