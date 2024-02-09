/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { TableLimits, TableETag, DefinedTags, FreeFormTags, Durability,
    FieldRange, RowVersion, TimeToLive, MultiDeleteContinuationKey,
    QueryContinuationKey } from "./param";
import type { Config } from "./config";
import type { NoSQLClient } from "./nosql_client";
import type { Consistency } from "./constants";
import type { Region } from "./region";

/**
 * Cloud service only. Base option to specify compartment.
 */
export interface CompartmentOpt {
    /**
     * Cloud service only.
     * Compartment id or name to use for this operation.
     * @defaultValue {@link Config#compartment | Config.compartment}.
     * @see {@link Config.compartment}
     */
     compartment?: string;
}

/**
 * Op-premises only. Base option to specify namespace.
 */
export interface NamespaceOpt {
    /**
     * On-premises only.
     * Namespace to use for this operation.
     * <p>
     * Note: if a namespace is specified in the table name for the request
     * (using the <em>namespace:table_name</em> format), that value will
     * override this setting.
     * @defaultValue {@link Config#namespace | Config.namespace}.
     * @see {@link Config.namespace}
     */
     namespace?: string;
}

/**
 * Options passed to {@link NoSQLClient.tableDDL},
 * {@link NoSQLClient#setTableLimits} and {@link NoSQLClient#setTableTags}.
 */
 export interface ModifyTableOpt extends CompartmentOpt, NamespaceOpt {
     /**
      * Timeout for the operation in milliseconds.  Defaults to
      * {@link Config#ddlTimeout} (if {@link complete} is true, separate
      * default timeouts are used for issuing the DDL operation and waiting for
      * its completion, with values of {@link Config#ddlTimeout} and
      * {@link Config#tablePollTimeout} correspondingly).
      */
    timeout?: number;

    /**
     * Cloud service only.
     * Entity tag that must be matched for the operation to proceed. See 
     * {@link TableETag}.
     */
    matchETag?: TableETag;

    /**
     * If set to true, the returned {@link !Promise | Promise} will only
     * resolve when the operation is completed and the table state becomes
     * {@link TableState.ACTIVE} or {@link TableState.DROPPED} (if using
     * {@link NoSQLClient#tableDDL} to execute "DROP TABLE" operation).
     */
    complete?: boolean;

    /**
     * If {@link complete} is true, specifies delay between successive polls
     * while waiting for operation completion.  Defaults to
     * {@link Config#tablePollDelay}.  Has no effect if {@link complete} is
     * not enabled.
     */
     delay?: number;
}

/**
 * Options passed to {@link NoSQLClient#tableDDL}.
 */
export interface TableDDLOpt extends ModifyTableOpt {
    /**
     * Cloud service only.
     * Specifies new table limits for a table. See {@link TableLimits}. Note
     * that this property is required when creating a table.
     */
    tableLimits?: TableLimits;

    /**
     * Cloud Service only.
     * Defined tags to use for the operation. See {@link DefinedTags}.
     */
    definedTags?: DefinedTags;

    /**
     * Cloud Service only.
     * Free-form tags to use for the operation. See {@link FreeFormTags}.
     */
    freeFormTags?: FreeFormTags;
}

/**
 * Base option to specify timeout.
 */
export interface TimeoutOpt {
    /**
     * Timeout for the operation in milliseconds.
     * @defaultValue {@link Config#timeout | Config.timeout}
     */
     timeout?: number;
}

/**
 * Options passed to {@link NoSQLClient#getTable}.
 */
export interface GetTableOpt extends CompartmentOpt, NamespaceOpt,
    TimeoutOpt {}

/**
 * Options passed to {@link NoSQLClient#forCompletion} and
 * {@link NoSQLClient#forTableState}.
 */
export interface CompletionOpt extends CompartmentOpt, NamespaceOpt {
    /**
     * Timeout in milliseconds, i.e. how long to keep polling for operation
     * completion.  Defaults to {@link Config#tablePollTimeout} for table DDL
     * operations and to {@link Config#adminPollTimeout} for admin DDL
     * operations.
     */
    timeout?: number;

    /**
     * Delay in milliseconds between successive polls, determines how often
     * the polls are performed. Defaults to {@link Config#tablePollDelay} for
     * table DDL operations or to {@link Config#adminPollDelay} for admin DDL
     * operations.
     */
    delay?: number;
}

/**
 * Options passed to {@link NoSQLClient#getTableUsage} and
 * {@link NoSQLClient#tableUsageIterable}.
 */
export interface TableUsageOpt extends CompartmentOpt, TimeoutOpt {

    /**
     * Start time for the time period.  Can be {@link !Date | Date}, string
     * representing date and time or number of milliseconds since epoch
     * (January 1, 1970, 00:00:00 UTC). For string representation see
     * {@link !Date.parse | Date.parse()}. If time range is not specified, the
     * most recent complete usage record is returned.
     */
    startTime?: Date|string|number;

    /**
     * End time for the time period, represented same as {@link startTime}.
     */
    endTime?: Date|string|number;

    /**
     * Limit to the number of usage records desired. If not specified or value
     * is 0, there is no limit, but not all usage records may be returned due
     * to size limitations.
     */
    limit?: number;

    /**
     * Index at which to start returning
     * table usage records. To page table usage records, set this value to
     * {@link TableUsageResult#nextIndex} returned from previous call to
     * {@link NoSQLClient#getTableUsage}. These operations are best done in a
     * loop. See the example at {@link NoSQLClient#getTableUsage}. This option
     * is not used for {@link NoSQLClient#tableUsageIterable}.
     * @defaultValue 0
     */
    startIndex?: number;
}

/**
 * Options passed to {@link NoSQLClient#getIndex}.
 */
export interface GetIndexOpt extends CompartmentOpt, NamespaceOpt,
    TimeoutOpt {}

/**
 * Options passed to {@link NoSQLClient#getIndexes}.
 */
export interface GetIndexesOpt extends GetIndexOpt
{
    /**
     * Return information only about specific
     * index, same as {@link NoSQLClient#getIndex}.  If not specified,
     * information on all indexes is returned.
     */
    indexName?: string;
}

/**
 * Options passed to {@link NoSQLClient#listTables}.
 */
export interface ListTablesOpt extends TimeoutOpt {
    /**
     * Cloud service only. Compartment id or name to use for this operation.
     * See {@link Config#compartment} for more information. Only tables
     * belonging to the given compartment (but not its child compartments)
     * will be listed.
     * @defaultValue {@link Config#compartment | Config.compartment}
     */
    compartment?: string;

    /**
     * On-premises only.  If set, list tables from given namespace only,
     * otherwise list all tables for the user.
     */
    namespace?: string;

    /**
     * The index to use to start returning table names. This is related to
     * the {@link ListTablesResult#lastIndex} from a previous request and can
     * be used to page table names.
     * @defaultValue If not set, the list starts at index 0.
     */
    startIndex?: number;

    /**
     * The maximum number of table names to return in the operation.
     * @defaultValue If not set or set to 0, there is no limit.
     */
    limit?: number;
}

/**
 * Base option to specify consistency.
 */
export interface ConsistencyOpt {
    /**
     * {@link Consistency} used for the operation.  Defaults to
     * {@link Config#consistency}.
     */
    consistency?: Consistency;
}

/**
 * Options passed to {@link NoSQLClient#get}.
 */
export interface GetOpt extends CompartmentOpt, NamespaceOpt, TimeoutOpt,
    ConsistencyOpt {}

/**
 * On-premises only. Base option to specify durability.
 */
export interface DurabilityOpt {
    /**
     * On-premises only. Set the desired durability for master/replica
     * sync/acks.  Defaults to {@link Config#durability} or if not set, the
     * default server-side durability settings are used. See
     * {@link Durability}.
     */
    durability?: Durability;
}

/**
 * Options passed to {@link NoSQLClient#putIfAbsent},
 * {@link NoSQLClient#putIfPresent} and {@link NoSQLClient#putIfVersion}.
 */
export interface PutIfOpt extends CompartmentOpt, NamespaceOpt, TimeoutOpt,
    DurabilityOpt {
    /**
     * If set to true, existing row and its version will be returned as part
     * of {@link PutResult} if put operation fails as discussed in
     * {@link NoSQLClient#put}.
     */
    returnExisting?: boolean;

    /**
     * Sets {@link TimeToLive} value, causing the time to live on the row to
     * be set to the specified value on Put. This value overrides any default
     * time to live setting on the table. If passed as number, interpreted as
     * number of days.
     * @see {@link TimeToLive}.
     */
    ttl?: TimeToLive|number;

    /**
     * If set to true, and there is an existing row, causes the operation to
     * update the time to live (TTL) value of the row based on the table's
     * default TTL if set. If the table has no default TTL this state has no
     * effect. By default updating an existing row has no effect on its TTL.
     * This option cannot be specified if {@link ttl} is specified.
     */
    updateTTLToDefault?: boolean;

    /**
     * If true the value must be an exact match for the table schema or the
     * operation will fail. An exact match means that there are no required
     * fields missing and that there are no extra, unknown fields. The default
     * behavior is to not require an exact match.
     */
    exactMatch?: boolean;

    /**
     * Sets the number of generated identity values that are requested from
     * the server during a put. This takes precedence over the DDL identity
     * CACHE option set during creation of the identity column. Must be
     * positive integer.
     * @defaultValue If not set, the DDL identity CACHE value is used.
     */
    identityCacheSize?: number;
}

/**
 * Options passed to {@link NoSQLClient#put}.
 */
export interface PutOpt extends PutIfOpt {
    /**
     * If set to true, do put only if there is no existing row that matches
     * the primary key.  Exclusive with {@link ifPresent} and
     * {@link matchVersion}.
     */
    ifAbsent?: boolean;

    /**
     * If set to true, do put only if there is existing row that matches
     * the primary key.  Exclusive with {@link ifAbsent} and
     * {@link matchVersion}.
     */
    ifPresent?: boolean;

    /**
     * If set, do a put only if there is an existing row that matches the
     * primary key and its {@link RowVersion} matches the value provided.
     * Exclusive with {@link ifAbsent} and {@link ifPresent}.
     */
    matchVersion?: RowVersion;
}

/**
 * Options passed to {@link NoSQLClient#deleteIfVersion}.
 */
export interface DeleteIfOpt extends CompartmentOpt, NamespaceOpt, TimeoutOpt,
    DurabilityOpt {
    /**
     * If set to true, existing row and its version will be returned as part
     * of {@link DeleteResult} if delete operation fails because of version
     * mismatch as discussed in {@link NoSQLClient#delete}.
     */
    returnExisting?: boolean;
}

/**
 * Options passed to {@link NoSQLClient#delete}.
 */
export interface DeleteOpt extends DeleteIfOpt {
    /**
     * If set, delete only if there is an existing row that matches the
     * primary key and its {@link RowVersion} matches the value provided.
     */
    matchVersion?: RowVersion;
}

/**
 * Options passed to {@link NoSQLClient#deleteRange}.
 */
export interface MultiDeleteOpt extends CompartmentOpt, NamespaceOpt,
    TimeoutOpt, DurabilityOpt {
    /**
     * Field range based on columns not provided in partial key.  For more
     * details, see {@link FieldRange}.
     */
    fieldRange?: FieldRange;

    /**
     * The limit on the total KB written during the operation. This value can
     * only reduce the system defined limit. An attempt to increase the limit
     * beyond the system defined limit will result in error.
     */
     maxWriteKB?: number;

     /**
     * Continuation key returned in {@link MultiDeleteResult} from the
     * previous call to this API and can be used to continue this operation.
     * Operations with a continuation key still require the primary key.
     */
    continuationKey?: MultiDeleteContinuationKey | null;
}

/**
 * Abort-if-unsuccessful option used by {@link NoSQLClient#writeMany},
 * {@link NoSQLClient#putMany} and {@link NoSQLClient#deleteMany}.
 */
export interface AbortOnFailOpt {
    /**
     * If set to true, aborts the whole transaction if any of the put or
     * delete operations fails.  This is only applicable to
     * failures due to inability to satisfy {@link PutOpt#ifAbsent},
     * {@link PutOpt#ifPresent} or {@link PutOpt#matchVersion} options for put
     * operation or {@link DeleteOpt#matchVersion} for delete operation, see
     * {@link NoSQLClient#put} and {@link NoSQLClient#delete}.  Other failures
     * will result in error.
     * <p>
     * For {@link NoSQLClient#writeMany}, this option can be overriden by
     * {@link WriteOperation#abortOnFail} on per-operation basis.
     */
    abortOnFail?: boolean;
}

/**
 * Options passed to {@link NoSQLClient#writeMany}.
 * <p>
 * Use this interface ot specify options that should be the same for all put
 * and delete sub operations (options relevant only to put but not to
 * delete will be ignored for delete operations). Options for specific sub
 * operation, other than {@link WriteMultipleOpt#compartment},
 * {@link WriteMultipleOpt#timeout} and {@link WriteMultipleOpt#durability}
 * may be specified in {@link WriteOperation} and will override values
 * specified here. For list of options, see {@link WriteOperation}.
 */
export interface WriteMultipleOpt extends PutOpt, DeleteOpt, AbortOnFailOpt {}

/**
 * Options passed to {@link NoSQLClient#putMany}.
 */
export interface PutManyOpt extends PutOpt, AbortOnFailOpt {}

/**
 * Options passed to {@link NoSQLClient#deleteMany}.
 */
export interface DeleteManyOpt extends DeleteOpt, AbortOnFailOpt {}

/**
 * Options passed to {@link NoSQLClient#prepare}.
 */
export interface PrepareOpt extends CompartmentOpt, NamespaceOpt, TimeoutOpt {

    /**
     * If <em>true</em>, requests a printout of query execution plan to be
     * included in the returned {@link PreparedStatement} as
     * {@link PreparedStatement#queryPlan}.
     */
    getQueryPlan?: boolean;

    /**
     * If <em>true</em>, requests a JSON value of query result schema to be
     * included in the returned {@link PreparedStatement} as
     * {@link PreparedStatement#resultSchema}.
     */
    getResultSchema?: boolean;
}

/**
 * Options passed to {@link NoSQLClient#query} and
 * {@link NoSQLClient#queryIterable}.
 */
export interface QueryOpt extends CompartmentOpt, NamespaceOpt, TimeoutOpt,
    ConsistencyOpt {
    /**
     * On-premises only.
     * {@link Durability} value used for the update query operation.  Defaults
     * to {@link Config#durability} or if not set, default server-side
     * durability settings are used. This option only applies for update
     * queries, i.e. queries issued via INSERT, UPDATE, UPSERT and DELETE
     * statements. For read-only SELECT queries this option is ignored.
     */
    durability?: Durability;

    /**
     * Sets the limit on number of rows returned by the operation. This allows
     * an operation to return less than the default amount of data.
     */
    limit?: number;

    /**
     * Sets the limit on the total data read during this operation, in KB.
     * This value can only reduce the system defined limit. An attempt to
     * increase the limit beyond the system defined limit will result in
     * error. This limit is independent of read units consumed by the
     * operation.
     */
    maxReadKB?: number;

    /**
     * Sets the limit on the total data written during this operation, in KB.
     * Relevant for update and delete queries.  This value can only reduce the
     * system defined limit. An attempt to increase the limit beyond the
     * system defined limit will result in error. This limit is independent of
     * the write units consumed by the operation.
     */
    maxWriteKB?: number;

    /**
     * Maximum amount of memory in megabytes that may be used locally in this
     * query execution for operations such as duplicate elimination (which may
     * be required if using an index on an array or a map) and sorting. Such
     * operations may require significant amount of memory as they need to
     * cache full result set or a large subset of it in locally. If memory
     * consumption exceeds this value, error will result.  Default is 1GB.
     * Defaults to {@link Config#maxMemoryMB}.
     */
    maxMemoryMB?: number;

    /**
     * Note: this option is not used and ignored when using
     * {@link NoSQLClient#queryIterable}.
     * <p>
     * Continuation key returned in {@link QueryResult} from previous call to
     * this API used to continue the query.  If there are no more results,
     * continuation key will be null.  Note that it is possible that
     * continuation key is not null, but the query has no more results
     * remaining. In this case the next call to {@link NoSQLClient#query} will
     * result in {@link QueryResult#rows} being empty array and next
     * continuation key being null. This is possible if the previous call to
     * {@link NoSQLClient#query} fetched all remaing rows in the result set
     * but was stopped due to the set limitations, including
     * {@link maxReadKB}, {@link maxWriteKB} and {@link limit}. In this case
     * the server will not look ahead to check if any more results remain.
     */
    continuationKey?: QueryContinuationKey | null;
}

/**
 * Options passed to {@link NoSQLClient#adminDDL}.
 */
export interface AdminDDLOpt {
    /**
     * Timeout for the operation in milliseconds.  Defaults to
     * {@link Config#ddlTimeout}. If {@link complete} is true, separate
     * default timeouts are used for issuing the DDL operation and waiting for
     * its completion, with values of {@link Config#ddlTimeout} and
     * {@link Config#adminPollTimeout} respectively.
     */
    timeout?: number;

    /**
     * If set to true, the returned {@link !Promise | Promise} will only
     * resolve when the admin operation is completed.
     */
    complete?: boolean;

    /**
     * If {@link complete} is true, specifies delay between successive polls
     * while waiting for operation completion. Defaults to
     * {@link Config#adminPollDelay}. Has no effect if {@link complete} is not
     * enabled.
     */
    delay?: number;
}

/**
 * Options passed to {@link NoSQLClient#adminStatus}.
 */
export interface AdminStatusOpt extends TimeoutOpt {}

/**
 * Options passed to {@link NoSQLClient#listNamespaces},
 * {@link NoSQLClient#listUsers} and {@link NoSQLClient#listRoles}.
 */
export interface AdminListOpt {
    /**
     * Timeout for the operation in milliseconds. Defaults to 30 seconds.
     * @defaultValue 30000 (30 seconds)
     */
    timeout?: number;

    /**
     * Specifies delay between successive polls while waiting for operation
     * completion. Defaults to {@link Config#adminPollDelay}.
     */
    delay?: number;
}

/**
 * Cloud Service only. Options passed to {@link NoSQLClient#addReplica}.
 * @see {@link NoSQLClient#addReplica}
 */
export interface AddReplicaOpt extends ModifyTableOpt {
    /**
     * Read units for the replica table.
     * @defaultValue Read units for the existing table
     */
    readUnits?: number;

    /**
     * Write units for the replica table.
     * @defaultValue Write units for the existing table
     */
    writeUnits?: number;
}

/**
 * Cloud Service only. Options passed to {@link NoSQLClient#getReplicaStats}.
 * @see {@link NoSQLClient#getReplicaStats}
 */
export interface ReplicaStatsOpt extends CompartmentOpt, TimeoutOpt {
    /**
     * Region from which to query replica statats stats information. If not
     * set, stats from all replicas (regions) will be returned.
     */
    region?: Region|string;

    /**
     * Start time from which to retrieve replica stats records. Can be
     * {@link !Date | Date}, string representing date and time or number of
     * milliseconds since epoch (January 1, 1970, 00:00:00 UTC). For string
     * representation see {@link !Date.parse | Date.parse()}.
     * <p>
     * If start time is not set, the number of most recent complete stats
     * records are returned, up to {@link limit}, per replica.
     */
    startTime?: Date|string|number;

    /**
     * Limit to the number of replica stats record returned by one call to
     * {@link NoSQLClient#getReplicaStats}.
     * <p>
     * Note that this limit is for the number of stats records for each
     * replica. E.g. if you have 3 replicas and the limit is 1000, then up
     * to 1000 stats records for each replica can be returned, up to 3000
     * stats records total.
     * @defaultValue 1000
     */
    limit?: number;
}
