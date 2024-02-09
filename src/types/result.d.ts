/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { NoSQLClient } from "./nosql_client";
import type { TableState, AdminState, CapacityMode } from "./constants";
import type { TableLimits, TableETag, DefinedTags, FreeFormTags, RowVersion,
    MultiDeleteContinuationKey, QueryContinuationKey } from "./param";
import type { AnyRow, IdentityField } from "./data";
import type { PutOpt, DeleteOpt, QueryOpt, ListTablesOpt, ReplicaStatsOpt }
    from "./opt";
import type { PreparedStatement } from "./stmt";
import type { Region } from "./region";

/**
 * Cloud Service only.
 * ReplicaInfo represents information about a single remote replica of a
 * Global Active table. For more information, see
 * {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
 * You can retrieve information about table replicas from any method that
 * returns {@link TableResult} (such as {@link NoSQLClient#getTable},
 * {@link NoSQLClient#addReplica}, etc.) via {@link TableResult#replicas}.
 * @see {@link TableResult#replicas}
 */
export interface ReplicaInfo {
    /**
     * Name of the replica. This is the same as a region id (see
     * {@link Region#regionId}) of the replica's region.
     */
    readonly replicaName: string;

    /**
     * Region of the replica, if given {@link Region} constant is defined in
     * the SDK.
     * @see {@link Region}
     */
    readonly region?: Region;
    
    /**
     * OCID of the replica table.
     */
    readonly replicaOCID: string;

    /**
     * Capacity mode of the replica table.
     * <p>
     * Capacity mode may be set separately for each replica.
     * @see {@link CapacityMode}
     */
    readonly capacityMode: CapacityMode;

    /**
     * Write units of the replica table.
     * <p>
     * From the standpoint of the local table, write units of the replica
     * table define the maximum throughput used for replicating writes from
     * the replica to the local table. This throughput adds to the total
     * write througput of the local table. If the replica has capacity mode
     * {@link CapacityMode.ON_DEMAND}, system-configured limits will be used.
     * <p>
     * Note that reads are done locally so the read units of the replica table
     * do not affect the read throughput of the local table.
     * <p>
     * Both write and read units can be set separately for each replica.
     * @see {@link TableLimits#writeUnits}
     */
    readonly writeUnits: number;

    /**
     * Operational state of the replica table.
     * <p>
     * Note that replica initialization process (see
     * {@link TableResult#isLocalReplicaInitialized}) does not affect the
     * replica table state (it will still be {@link TableState.ACTIVE}).
     * @see {@link TableState}
     */
    readonly state: TableState;
}

/**
 * TableResult object is the result of {@link NoSQLClient#tableDDL},
 * {@link NoSQLClient#setTableLimits }, {@link NoSQLClient#getTable} and
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
 * {@link TableState.DROPPED }.
 * You may also call {@link NoSQLClient#getTable} to receive static
 * information about the table as well as its current state.
 */
export interface TableResult {
    /**
     * Cloud service only.  Compartment id of the table.
     */
    readonly compartmentId?: string;

    /**
     * On-premise NoSQL database only. The namespace of the table.
     */
    readonly namespace?: string;

    /**
     * Cloud service only. The OCID of the table.
     */
    readonly tableOCID?: string;

    /**
     * Current table state, see {@link TableState}.
     */
    readonly tableState: TableState;
    
    /**
     * Table name.
     */
    readonly tableName: string;

    /**
     * Table schema, in JSON format, if available.
     */
    readonly schema?: string;

    /**
     * DDL (CREATE TABLE) statement used to create this table if available. If
     * the table has been altered since initial creation, the statement is
     * also altered to reflect the current table schema. This value, when
     * defined, is functionally equivalent to the schema returned by
     * {@link schema}. The most reliable way to get the DDL statement is by
     * using {@link NoSQLClient#getTable} on an existing table.
     */
    readonly tableDDL?: string;

    /**
     * Cloud service only. Table limits, see {@link TableLimits}
     */
    readonly tableLimits?: TableLimits;

    /**
     * Cloud service only. Entity tag associated with the table. See
     * {@link TableETag}.
     */
    readonly etag?: TableETag;

    /**
     * Cloud service only. Defined tags associated with the table. See
     * {@link DefinedTags}.
     */
    readonly definedTags?: DefinedTags;

    /**
     * Cloud Service only. Free-form tags associated with the table. See
     * {@link FreeFormTags}.
     */
    readonly freeFormTags?: FreeFormTags;

    /**
     * Operation id of the operation that returned this result, if this result
     * is returned by {@link NoSQLClient#tableDDL},
     * {@link NoSQLClient#setTableLimits} or {@link NoSQLClient#setTableTags}
     * methods.  It is used when the {@link TableResult} is subsequently
     * passed to {@link NoSQLClient#forCompletion} or
     * {@link NoSQLClient#getTable} as the first parameter to identify the
     * operation and check for any errors from that operation.
     * This value is undefined if the request did not generate a new
     * operation.
     */
    readonly operationId?: string;

    /**
     * Cloud Service only.
     * Indicates whether or not the table's schema is frozen. Frozen schema is
     * required for Global Active tables. For more information, see
     * {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
     */
    readonly isSchemaFrozen?: boolean;

    /**
     * Cloud Service only.
     * Indicates whether the table has replicas, that is whether it is a
     * Global Active table. For more information, see
     * {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
     */
    readonly isReplicated?: boolean;

    /**
     * Cloud Service only.
     * If this table is a replica, indicates whether its initialization
     * process has been completed. The initialization process starts after the
     * replica table is created and involves copying of the table data from
     * the sender region to the receiver region. For more information, see
     * {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
     * This value is <em>true</em> if the table is a replica and its
     * initialization process has been completed, otherwise it is
     * <em>false</em>.
     * @see {@link NoSQLClient#addReplica}
     */
    readonly isLocalReplicaInitialized?: boolean;

    /**
     * Cloud Service only.
     * An array containing information for each replica, if this table is
     * replicated (Global Active Table), otherwise <em>undefined</em>.
     * For more information, see
     * {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
     * @see {@link ReplicaInfo}
     */
    readonly replicas?: ReplicaInfo[];
}

/**
 * Cloud service only.
 * Note: this type is only relevant when using the driver with the Cloud
 * Service.  It is not relevant when using the driver
 * with on-premise NoSQL Database (see {@link ServiceType.KVSTORE }).
 * <p>
 * TableUsage objects are part of {@link TableUsageResult}, that is the result
 * of {@link NoSQLClient#getTableUsage} method.  TableUsage represents a
 * single usage record, or slice, that includes information about read and
 * write throughput consumed during that period as well as the current
 * information regarding storage capacity. In addition the count of throttling
 * exceptions for the period is reported.
 */
export interface TableUsage {
    /**
     * Start time for this usage record as {@link !Date | Date}.
     */
    readonly startTime: Date;

    /**
     * Number of seconds in this usage record.
     */
    readonly secondsInPeriod: number;

    /**
     * Number of read units consumed during this period, see
     * {@link TableLimits}.
     */
    readonly readUnits: number;

    /**
     * Number of write units consumed during this period, see
     * {@link TableLimits}.
     */
    readonly writeUnits: number;

    /**
     * Amount of storage in Gigabytes consumed by the table. This information
     * may be out of date as it is not maintained in real time.
     */
    readonly storageGB: number;

    /**
     * Number of read throttling exceptions on this table in the time period,
     * see {@link ErrorCode.READ_LIMIT_EXCEEDED}.
     */
    readonly readThrottleCount: number;

    /**
     * Number of write throttling exceptions on this table in the time period,
     * see {@link ErrorCode.WRITE_LIMIT_EXCEEDED}.
     */
    readonly writeThrottleCount: number;

    /**
     * Number of storage throttling exceptions on this table in the time
     * period, see {@link ErrorCode.SIZE_LIMIT_EXCEEDED}.
     */
    readonly storageThrottleCount: number;

    /**
     * Percentage of allowed storage usage for the shard with the highest
     * usage percentage across all table shards. This property can be used as
     * a gauge of total storage available as well as a hint for key
     * distribution across shards.
     */
    readonly maxShardUsagePercent: number;
}

/**
 * Cloud Service only.
 * Note: this type is only relevant when using the driver with the Cloud
 * Service.  It is not relevant when using the driver with on-premise NoSQL
 * Database (see {@link ServiceType.KVSTORE}).
 * <p>
 * TableUsageResult is the result of {@link NoSQLClient#getTableUsage} method.
 * It encapsulates the dynamic state of the requested table.
 */
export interface TableUsageResult {
    /**
     * Table name.
     */
    readonly tableName: string;

    /**
     * Array of {@link TableUsage} records based on options provided to
     * {@link NoSQLClient#getTableUsage }. May be empty if no usage records
     * are found for requested time period.
     */
    readonly usageRecords: TableUsage[];

    /**
     * The next index after the last table usage record returned. Can be used
     * for paging table usage records. For manual paging, assign this value
     * to {@link TableUsageOpt#startIndex} as shown in the example of
     * {@link NoSQLClient#getTableUsage}. This property is not needed if you
     * are using {@link NoSQLClient#tableUsageIterable}.
     */
    readonly nextIndex: number;
}

/**
 * IndexInfo represents the information about a single index including its
 * name and field names. Array of IndexInfo objects is the result of
 * {@link NoSQLClient#getIndexes} method and a single IndexInfo object is
 * the result of {@link NoSQLClient#getIndex} method.
 */
export interface IndexInfo {
    /**
     * Index name.
     */
    readonly indexName: string;

    /**
     * Array of field names that define the index.
     */
    readonly fields: string[];

    /**
     * Array of field types corresponding to the array of field names. The
     * type in the list is only defined if the index is on a field of type
     * JSON and is explicitly typed. If using a server that does not support
     * this information, this property will be undefined.
     */
    readonly fieldTypes?: (string|undefined)[];
}

/**
 * Represents the result of a {@link NoSQLClient#listTables} operation.
 * <p>
 * On a successful operation the table names are available as well as the
 * index of the last returned table. Tables are returned in an array, sorted
 * alphabetically.
 */
export interface ListTablesResult {
    /**
     * Array of table names returned by the operation.
     */
    readonly tables: string[];

    /**
     * Next index after the last table name returned
     * (last table index + 1). This can be used as
     * {@link ListTablesOpt#startIndex} when calling
     * {@link NoSQLClient#listTables} to page table list.
     */
    readonly lastIndex: number;
}

/**
 * Cloud service only.
 * Note: this type is only relevant when using the driver with the Cloud
 * Service or Cloud Simulator. It is not relevant when using the driver
 * with on-premise NoSQL Database (see {@link ServiceType.KVSTORE}), in which
 * case it is not a part of the operation results mentioned below.
 * <p>
 * ConsumedCapacity is part of results of data operations such as
 * {@link GetResult}, {@link PutResult}, {@link DeleteResult},
 * {@link MultiDeleteResult}, {@link WriteMultipleResult},
 * {@link PreparedStatement} and {@link QueryResult}.  It contains read and
 * write throughputs consumed by the operation in KBytes as well as in read
 * and write units.  Thoughput in read and write units is defined as
 * following:
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
 * units consumed {@link readUnits} maybe larger than the
 * number of read KBytes {@link readKB} if the operation used
 * absolute consistency.  See {@link Consistency.ABSOLUTE }.</li>
 * <li>For update operations, such as {@link NoSQLClient#put},
 * {@link NoSQLClient#delete}, {@link NoSQLClient#deleteRange},
 * {@link NoSQLClient#writeMany} and others, the number of read units consumed
 * {@link ConsumedCapacity#readUnits} may also be larger than the number of
 * read KBytes {@link readKB}.</li>
 * </ul>
 * <p>
 * When driver-side rate limiting is enabled (see {@link Config#rateLimiter}),
 * two additional properties, {@link readRateLimitDelay} and
 * {@link writeRateLimitDelay} may be set.  They specify how long given
 * operation was delayed by the rate limiter due to reads and writes
 * performed, respectively (note that each of these values is set only if
 * given operation does reads and/or writes, correspondingly).  These values
 * may be useful in gathering statistics to analyze performance and adjust
 * rate limiter configuration (when using custom rate limiter).
 * See {@link RateLimiter}.  Note that total time the operation was delayed
 * due to rate limiting is {@link readRateLimitDelay} (if set) +
 * {@link writeRateLimitDelay} (if set).
 */
export interface ConsumedCapacity {
    /**
     * Read throughput consumed by this operation, in KBytes.
     */
    readonly readKB: number;

    /**
     * Write throughtput consumed by this operation, in KBytes.
     */
    readonly writeKB: number;
    
    /**
     * Read throughput consumed by this operation, in read units.
     */
    readonly readUnits: number;

    /**
     * Write throughtput consumed by this operation, in write units.
     */
    readonly writeUnits: number;

    /**
     * When rate limiting is enabled, specifies how long the operation has
     * been delayed, in milliseconds, due to the table read limit.  This value
     * may be 0 if given operation was not delayed by the read rate limiter.
     * Not set if rate limiting is disabled or if given operation does not
     * perform reads.
     */
    readonly readRateLimitDelay?: number;

    /**
     * When rate limiting is enabled, specifies how long the operation has
     * been delayed, in milliseconds, due to the table write limit.  This
     * value may be 0 if the operation was not delayed by the write rate
     * limiter.  Not set if rate limiting is disabled or if given operation
     * does not perform writes.
     */
    readonly writeRateLimitDelay?: number;
}

/**
 * Base interface for DML and query result interfaces that have consumed
 * capacity.
 */
export interface ConsumedCapacityResult {
    /**
     * Capacity consumed by this operation, see {@link ConsumedCapacity}.
     * Undefined if using on-premises service or if this is a result of a put
     * or a delete sub-operation as part of {@link WriteMultipleResult}.
     */
    readonly consumedCapacity?: ConsumedCapacity;
}

/**
 * Represents the result of {@link NoSQLClient#get} operation.
 * @typeParam TRow Type of table row instance, defaults to {@link AnyRow}
 */
export interface GetResult<TRow = AnyRow> extends ConsumedCapacityResult {
    /**
     * Value of the returned row or null if the row does not exist.
     */
    readonly row: TRow | null;

    /**
     * Expiration time of the row. If the row exists but does not expire or
     * the row does not exist, this value is undefined.
     */
    readonly expirationTime?: Date;

    /**
     * Modification time of the row if available from the server, or
     * undefined if th erow does not exist or the server does not support
     * modification time.
     * @since 5.3.0
     */
    readonly modificationTime?: Date;

    /**
     * {@link RowVersion} of the returned row.  If the row does not exist,
     * this value is undefined.
     */
    readonly version?: RowVersion;
}

/**
 * Represents the result of <em>put</em> sub-operation in
 * {@link WriteMultipleResult}. This is also a base interface for
 * {@link PutResult}.
 * @typeParam TRow Type of table row instance, defaults to {@link AnyRow}
 * @see {@link PutResult}
 */
export interface PutOpResult<TRow = AnyRow> {
    /**
     * Whether the put operation was successful, as described in
     * {@link NoSQLClient#put}.
     */
    readonly success: boolean;

    /**
     * {@link RowVersion} of the new row if the put operation was successful,
     * otherwise undefined.
     */
    readonly version?: RowVersion;
     
    /**
     * Existing modification time if available, otherwise undefined.  This
     * value will only be available if the conditional put operation failed
     * and {@link PutOpt#returnExisting} was set to true.
     * @since 5.3.0
     */
    readonly existingModificationTime?: Date;

    /**
     * Existing row value if available, otherwise undefined. This
     * value will only be available if the conditional put operation failed
     * and {@link PutOpt#returnExisting} was set to true.
     */
    readonly existingRow?: TRow;

    /**
     * Existing {@link RowVersion} if available, otherwise undefined. This
     * value will only be available if the conditional put operation failed
     * and {@link PutOpt#returnExisting} was set to true.
     */
    readonly existingVersion?: RowVersion;

    /**
     * Value generated if the operation created a new value for an identity
     * column or string as uuid column. Present only if a value was generated
     * for that column by this operation.
     */
    readonly generatedValue?: IdentityField;
}

/**
 * Represents the result of {@link NoSQLClient#put},
 * {@link NoSQLClient#putIfAbsent}, {@link NoSQLClient#putIfPresent} and
 * {@link NoSQLClient#putIfVersion} methods.
 * @typeParam TRow Type of table row instance, defaults to {@link AnyRow}
 */
export interface PutResult<TRow = AnyRow> extends PutOpResult<TRow>,
    ConsumedCapacityResult {}

/**
 * Represents the result of <em>delete</em> sub-operation in
 * {@link WriteMultipleResult}. This is also a base interface for
 * {@link DeleteResult}.
 * @typeParam TRow Type of table row instance, defaults to {@link AnyRow}
 * @see {@link DeleteResult}
 */
export interface DeleteOpResult<TRow = AnyRow> {
    /**
     * Whether the delete operation was successful, as described in
     * {@link NoSQLClient#delete}.
     */
    readonly success: boolean;

    /**
     * Existing modification time if available, otherwise undefined.  This
     * value will only be available if the conditional put operation failed
     * and {@link DeleteOpt#returnExisting} was set to true.
     * @since 5.3.0
     */
    readonly existingModificationTime?: Date;

     /**
      * Existing row value if available, otherwise undefined. This
      * value will only be available if the conditional put operation failed
      * and {@link DeleteOpt#returnExisting} was set to true.
      */
    readonly existingRow?: TRow;
 
     /**
      * Existing {@link RowVersion} if available, otherwise undefined. This
      * value will only be available if the conditional put operation failed
      * and {@link DeleteOpt#returnExisting} was set to true.
      */
    readonly existingVersion?: RowVersion;
}

/**
 * Represents the result of {@link NoSQLClient#delete} and
 * {@link NoSQLClient#deleteIfVersion} methods.
 * @typeParam TRow Type of table row instance, defaults to {@link AnyRow}
 */
export interface DeleteResult<TRow = AnyRow> extends ConsumedCapacityResult,
    DeleteOpResult<TRow> {}

/**
 * Represents the result of a {@link NoSQLClient#deleteRange} method.
 * <p>
 * On a successful operation the number of rows deleted is available using
 * {@link MultiDeleteResult#deletedCount}. There is a limit to the amount of
 * data consumed by a single request to the server. If there are still more
 * rows to delete, the continuation key will be available as
 * {@link MultiDeleteResult#continuationKey}.
 */
export interface MultiDeleteResult extends ConsumedCapacityResult {
    /**
     * Number of rows deleted.
     */
    readonly deletedCount: number;

    /**
     * Continuation key where the next call to {@link NoSQLClient#deleteRange}
     * can resume from, or undefined if there are no more rows to delete.
     */
    readonly continuationKey?: MultiDeleteContinuationKey;
}

/**
 * Represents the result of a {@link NoSQLClient#writeMany},
 * {@link NoSQLClient#putMany} or {@link NoSQLClient#deleteMany} methods.
 * <p>
 * If the operation succeeds, the execution result of each sub operation is
 * available in {@link WriteMultipleResult#results} property.
 * <p>
 * If the operation is aborted because of the failure of a sub operation with
 * {@link WriteOperation#abortOnFail} set to true or if
 * {@link WriteMultipleOpt#abortOnFail} is set to true, then the index of
 * failed operation is available as {@link WriteMultipleResult#failedOpIndex}
 * and the execution result of failed operation is available as
 * {@link WriteMultipleResult#failedOpResult}. The
 * {@link WriteMultipleResult#results} property will be undefined in this
 * case. You may check for the success of the entire operation by whether
 * {@link WriteMultipleResult#results} is defined.
 * @typeParam TRow Type of table row instance, defaults to {@link AnyRow}
 */
export interface WriteMultipleResult<TRow = AnyRow>
    extends ConsumedCapacityResult {
    /**
     * Array of results if the operation succeeded, undefined otherwise.  Each
     * result in the array is either {@link PutResult} or {@link DeleteResult}
     * depending on the sub operation and has the same index in the array as
     * its corresponding operation object provided in the <em>operations</em>
     * array to {@link NoSQLClient#writeMany} (same holds for rows and keys
     * provided to {@link NoSQLClient#putMany} and
     * {@link NoSQLClient#deleteMany} methods). Note that sub operation
     * results do not contain {@link ConsumedCapacity}.
     */
    readonly results?: (PutOpResult<TRow>|DeleteOpResult<TRow>)[];

    /**
     * Index of failed sub operation that resulted in the entire operation
     * aborting. Undefined if the operation was successul.
     */
    readonly failedOpIndex?: number;

    /**
     * Result of failed sub operation that resulted in the entire operation
     * aborting. Undefined if the operation was successful.
     */
    readonly failedOpResult?: PutOpResult<TRow>|DeleteOpResult<TRow>;
}

/**
 * QueryResult represents the result of {@link NoSQLClient#query } method and
 * results returned by iteration over {@link NoSQLClient#queryIterable}.
 * It contains a list of row instances representing the query results.
 * <p>
 * The shape of the values is based on the schema implied by the query. For
 * example a query such as "SELECT * FROM ..." that returns an intact row will
 * return values that conform to the schema of the table. Projections return
 * instances that conform to the schema implied by the statement. UPDATE
 * queries either return values based on a RETURNING clause or, by default,
 * the number of rows affected by the statement.
 * <p>
 * For {@link NoSQLClient#query} method, if the value of
 * {@link QueryResult#continuationKey} is not null there are additional
 * results available.  That value can be supplied as
 * {@link QueryOpt#continuationKey} to subsequent call to
 * {@link NoSQLClient#query} to continue the query.  It is possible for a
 * query to return no results in an empty list but still have a non-null
 * continuation key. This happens if the query reads the maximum amount of
 * data allowed in a single request without matching a query predicate. In
 * this case, the continuation key must be used to get results, if any exist.
 * @typeParam TRow Type of table row instance, defaults to {@link AnyRow}
 */
export interface QueryResult<TRow = AnyRow> extends ConsumedCapacityResult {
    /**
     * Results for the query as array of <em>TRow</em> instances, the array
     * may be empty.
     */
    readonly rows: TRow[];

    /**
     * Continuation key, undefined if there are no more results available.
     */
    readonly continuationKey?: QueryContinuationKey;
}

/**
 * On-premises only.
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
 * <li>Asynchronous operations may return a non-null {@link operationId}.</li>
 * <li>Asynchronous operations modify system state, while immediate operations
 * are read-only.</li>
 * <li>Result returned by {@link NoSQLClient#adminDDL} for immediate
 * operations has <em>state</em> {@link AdminState.COMPLETE} and has a
 * non-null {@link output}.</li>
 * </ul>
 */
export interface AdminResult {
    /**
     * Current state of the operation, which is either complete or
     * in-progress, see {@link AdminState}.
     */
    readonly state: AdminState;

    /**
     * Operation id of the operation that returned
     * this result, if this result is returned by {@link NoSQLClient#adminDDL}
     * and the operation is performed by the service asynchronously. It is
     * used when this {@link AdminResult} is subsequently passed to
     * {@link NoSQLClient#forCompletion} or {@link NoSQLClient#adminStatus} as
     * the first parameter to identify the operation and check for any errors
     * from that operation.
     */
    readonly operationId?: string;

    /**
     * Statement for the operation.
     */
    readonly statement: string;

    /**
     * The output of the operation as a string.  It is defined for read-only
     * immediate operations such as SHOW operations and is undefined for
     * operations that modify system state and are performed by the service
     * asynchronously such as CREATE, DROP, GRANT, etc.
     */
    readonly output?: string;
}

/**
 * On-premises only.
 * <p>
 * Represents information associated with a user including the id and user
 * name in the system.  {@link NoSQLClient#listUsers} method returns array of
 * {@link UserInfo} objects for each user.
 */
export interface UserInfo {
    /**
     * User id.
     */
    readonly id: string;

    /**
     * User name.
     */
    readonly name: string;
}

/**
 * Cloud Service only.
 * <p>
 * ReplicaStats contains information about replica lag for a specific replica.
 * <p>
 * Replica lag is a measure of how current this table is relative to the
 * remote replica and indicates that this table has not yet received updates
 * that happened within the lag period.
 * <p>
 * For example, if the replica lag is 5,000 milliseconds(5 seconds), then this
 * table will have all updates that occurred at the remote replica that are
 * more than 5 seconds old.
 * <p>
 * Replica lag is calculated based on how long it took for the latest
 * operation from the table at the remote replica to be replayed at this
 * table. If there have been no application writes for the table at the remote
 * replica, the service uses other mechanisms to calculate an approximation of
 * the lag, and the lag statistic will still be available.
 */
export interface ReplicaStats {
    /**
     * The time the replica stats collection was performed.
     */
    readonly collectionTime: Date;

    /**
     * The replica lag collected at the specified time in milliseconds. In
     * rare cases where the replica lag could not be determined, this value is
     * <em>undefined</em>.
     */
    readonly replicaLag?: number;
}

/**
 * Cloud Service only.
 * <p>
 * Result returned by {@link NoSQLClient#getReplicaStats}. It contains replica
 * statistics for the requested table.
 * @see {@link NoSQLClient#getReplicaStats}
 */
export interface ReplicaStatsResult {
    /**
     * Table name.
     */
    readonly tableName: string;

    /**
     * Next start time. This can be used when retrieving large number of
     * replica stats records over multiple calls to
     * {@link NoSQLClient#getReplicaStats}. Pass this value as
     * {@link ReplicaStatsOpt#startTime} on the subsequent call to
     * {@link NoSQLClient#getReplicaStats}.
     */
    readonly nextStartTime: Date;

    /**
     * Replica statistics information. Represented as an object with keys
     * being region id (see {@link Region#regionId}) of a replica and values
     * being an array of {@link ReplicaStats} for that replica. If
     * {@link ReplicaStatsOpt#region} option is set, this object will contain
     * only one key-value pair for the given region.
     * <p>
     * Note that in either case this object will contain only keys for which
     * there is at least one {@link ReplicaStats} record returned (it will not
     * contain keys for regions for which no stats records were found
     * according to values specified in {@link ReplicaStatsOpt} or applicable
     * defaults).
     * @see {@link ReplicaStatsOpt}
     * 
     * @example
     * Print replica lag info for EU_ZURICH_1 region.
     * ```ts
     * for(const rec of statsResult.statsRecords['eu-zurich-1']) {
     *     console.log(rec.replicaLag);
     * }
     * ```
     */
    readonly statsRecords: {
        readonly [regionId: string]: ReplicaStats[]
    };
}
