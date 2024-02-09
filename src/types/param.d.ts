/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { CapacityMode } from "./constants";
import type { PutOpt, DeleteOpt, WriteMultipleOpt } from "./opt";
import type { SyncPolicy, ReplicaAckPolicy } from "./durability";
import type { AnyRow, KeyField, RowKey, FieldValue } from "./data";
import type { OpaqueType } from "./type_utils";
import type { AuthorizationProvider } from "./auth/config";

/**
 * Cloud service only.
 * Note: this type is only relevant when using the driver with the Cloud
 * Service or Cloud Simulator.  It is not relevant when using the driver
 * with on-premise NoSQL Database (see {@link ServiceType.KVSTORE}), in which
 * case it is ignored in the operations mentioned below and is not returned as
 * part of {@link TableResult }.
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
 * In {@link CapacityMode.PROVISIONED} mode (the default), all 3 values must
 * be specified whenever using this object. There are no defaults and no
 * mechanism to indicate "no change."
 * <p>
 * In {@link CapacityMode.ON_DEMAND} mode, only the storageGB parameter must
 * be specified.
 */
export interface TableLimits {
    /**
     * The desired throughput of read operation in terms of read units, as a
     * positive integer.  A read unit represents 1 eventually consistent read
     * per second for data up to 1 KB in size. A read that is absolutely
     * consistent is double that, consuming 2 read units for a read of up to
     * 1 KB in size.
     * @see {@link Consistency}
     */
    readUnits?: number;

    /**
     * The desired throughput of write operation in terms of write units, as a
     * positive integer. A write unit represents 1 write per second of data up
     * to 1 KB in size.
     */
    writeUnits?: number;

    /**
     * The maximum storage to be consumed by the table, in gigabytes, as
     * positive integer.
     */
    storageGB: number;

    /**
     * Capacity mode of the table, {@link CapacityMode.PROVISIONED} or
     * {@link CapacityMode.ON_DEMAND}.
     * @defaultValue {@link CapacityMode.PROVISIONED}
     */
    mode?: CapacityMode;
}

/**
 * RowVersion is an opaque type that represents the version of a row in the
 * database.  The driver uses Node.js Buffer to store the version.  The
 * version is returned by successful {@link NoSQLClient#get} operation
 * and can be used by {@link NoSQLClient#put},
 * {@link NoSQLClient#putIfVersion }, {@link NoSQLClient#delete} and
 * {@link NoSQLClient#deleteIfVersion } methods to conditionally perform those
 * operations to ensure an atomic read-modify-write cycle. This is an opaque
 * object from an application perspective.  Use of {@link RowVersion} in this
 * way adds cost to operations so it should be done only if necessary.
 */
export type RowVersion = OpaqueType<Buffer, "RowVersion">;

/**
 * An opaque type that represents continuation key for
 * {@link NoSQLClient#deleteRange}. It is used to perform an operation across
 * multiple calls to this method (such as in a loop until continuation
 * key becomes null).  This is an opaque type from application perspective
 * and only values from previous results should be used.
 */
export type MultiDeleteContinuationKey =
    OpaqueType<Buffer, "MultiDeleteContinuationKey">;

/**
 * An opaque type that represents continuation key for
 * {@link NoSQLClient#query}. It is used to perform an operation across
 * multiple calls to this method (such as in a loop until continuation
 * key becomes null).  This is an opaque type from application perspective
 * and only values from previous results should be used.
 */
export type QueryContinuationKey = OpaqueType<Buffer, "QueryContinuationKey">;

/**
 * Note: On-Prem only.
 * <p>
 * Durability specifies the master and replica sync and ack policies to be
 * used for a write operation.
 * @see {@link SyncPolicy}
 * @see {@link ReplicaAckPolicy}
 */
export interface Durability {
    /**
     * The sync policy to use on the master node.
     */
    masterSync: SyncPolicy;

    /**
     * The sync policy to use on a replica.
     */
    replicaSync: SyncPolicy;
    
    /**
     * The replica acknowledgement policy
     * to be used.
     */
    replicaAck: ReplicaAckPolicy;
}

/**
 * Used to specify time to live (TTL) for rows provided to
 * {@link NoSQLClient#put} and other put methods, such as
 * {@link NoSQLClient#putIfAbsent}, {@link NoSQLClient#putIfPresent} and
 * {@link NoSQLClient#putIfVersion}.
 * <p>
 * TTL is restricted to durations of days and hours, with day being
 * 24 hours.  Note that you may only specify only one of
 * {@link days} or {@link hours} fields, not both.
 * You may specify TTL as object such as <em>\{ days: numDays \}</em> or
 * <em>\{ hours: numHours \}</em>, or if you are using duration of days
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
 * rounded up to the nearest day (or hour). The day and hour boundaries (the
 * day boundary is at midnight) are considered in UTC time zone.
 * <p>
 * The minimum TTL that can be specified is 1 hour. Because of the rounding
 * behavior described above, the actual record duration will be longer than
 * specified in the TTL (because of rounding up).
 * <p>
 * Also note that using duration of days are recommended as it will result in
 * the least amount of storage overhead compared to duration of hours.
 * <p>
 * {@link TTLUtil } class provides functions to create and manage TTL
 * instances and convert between TTL and record expiration time.
 * @see {@link TTLUtil}
 */
export interface TimeToLive {
    /**
     * Duration in days as positive integer or Infinity. Exclusive with
     * {@link TimeToLive#hours}.
     */
    days?: number;

    /**
     * Duration in hours as positive integer or Infinity. Exclusive with
     * {@link TimeToLive#days}.
     */
    hours?: number;
}

/**
 * FieldRange defines a range of values to be used in a
 * {@link NoSQLClient#deleteRange } operation, as specified in
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
 * (for upper bound) the value.  Properties {@link startWith} and
 * {@link endWith} specify inclusive bounds and properties {@link startAfter}
 * and {@link endBefore} specify exclusive bounds. Note that for each end of
 * the range you may specify either inclusive or exclusive bound, but not
 * both.
 * <p>
 * Validation of this object is performed when it is used in an operation.
 * Validation includes verifying that the field is in the required key and,
 * in the case of a composite key, that the field is in the proper order
 * relative to the key used in the operation.
 */
export interface FieldRange {
    /**
     * Field name for the range.
     */
    fieldName: string;

    /**
     * Field value for the lower bound of the range, inclusive. May be
     * undefined if no lower bound is enforced. May not be used together with
     * {@link startAfter}.
     */
    startWith?: KeyField;

    /**
     * Field value for the lower bound of the range, exclusive. May be
     * undefined if no lower bound is enforced. May not be used together with
     * {@link startWith}.
     */
    startAfter?: KeyField;

    /**
     * Field value for the upper bound of the range, inclusive. May be
     * undefined if no upper bound is enforced. May not be used together with
     * {@link endBefore}.
     */
    endWith?: KeyField;

    /**
     * {@link KeyField} value for the upper bound of the range, exclusive. May
     * be undefined if no upper bound is enforced. May not be used together
     * with {@link endWith}.
     */
    endBefore?: KeyField;
}

/**
 * Represents one of <em>put</em> or <em>delete</em> sub operations in the
 * <em>operations</em> array argument provided to
 * {@link NoSQLClient#writeMany} method. It contains row for put operation
 * (as <em>put</em> key) or primary key for delete operation (as
 * <em>delete</em> key) and may contain additional properties representing
 * options for this sub operation. These options are the same as used for
 * {@link NoSQLClient#put} and {@link NoSQLClient#delete} and they override
 * options specified in {@link WriteMultipleOpt}.
 * for this sub operation. Exceptions to this are
 * {@link WriteMultipleOpt#timeout}, {@link WriteMultipleOpt#compartment},
 * {@link WriteMultipleOpt#namespace} and {@link WriteMultipleOpt#durability}
 * which cannot be specified per sub-operation, but only for the whole
 * {@link NoSQLClient#writeMany} operation.
 * <p>
 * If issuing operations for multiple tables, you must also specify
 * {@link WriteOperation#tableName} for each operation. See
 * {@link NoSQLClient#writeMany } for more details.
 * <p>
 * Note that in a more simple case where operations are for a single table and
 * are either all <em>put</em> or all <em>delete</em> and you don't need to
 * set per-operation options, you may prefer to use
 * {@link NoSQLClient#putMany} or {@link NoSQLClient#deleteMany} methods and
 * avoid using this type.
 * @typeParam TRow Type of table row instance. Must include primary key
 * fields. Defaults to {@link AnyRow}.
 */
export interface WriteOperation<TRow = AnyRow> {
    /**
     * Table name for the operation. Only needed when issuing operations for
     * multiple tables. This property is mutually exclusive with
     * <em>tableName</em> parameter to {@link NoSQLClient#writeMany}.
     */
    tableName?: string;

    /**
     * Row for <em>put</em> operation, designates this operation as
     * <em>put</em>. One and only one of {@link put} or {@link delete}
     * properties must be set.
     */
    put?: TRow;

    /**
     * Primary key for <em>delete</em> operation, designates this operation as
     * <em>delete</em>. One and only one of {@link put} or {@link delete}
     * properties must be set.
     * @see {@link RowKey}
     */
    delete?: RowKey<TRow>;

    /**
     * If true, and if this operation fails, it will cause the entire
     * {@link NoSQLClient#writeMany} operation to abort.
     */
    abortOnFail?: boolean;

    /**
     * Same as {@link PutOpt#ifAbsent}, valid only for <em>put</em> operation.
     */
    ifAbsent?: boolean;

    /**
     * Same as {@link PutOpt#ifPresent}, valid only for <em>put</em>
     * operation.
     */
    ifPresent?: boolean;

    /**
     * Same as {@link PutOpt#matchVersion} for <em>put</em> operation or
     * {@link DeleteOpt#matchVersion} for <em>delete</em> operation.
     */
    matchVersion?: RowVersion;

    /**
     * Same as {@link PutOpt#ttl}, valid only for <em>put</em> operation.
     */
    ttl?: TimeToLive | number;

    /**
     * Same as {@link PutOpt#updateTTLToDefault}, only valid for <em>put</em>
     * operation.
     */
    updateTTLToDefault?: boolean;

    /**
     * Same as {@link PutOpt#exactMatch}, valid only for <em>put</em>
     * operation.
     */
    exactMatch?: boolean;

    /**
     * Same as {@link PutOpt#returnExisting} for <em>put</em> operation or
     * {@link DeleteOpt#returnExisting} for <em>delete</em> operation.
     */
    returnExisting?: boolean;

    /**
     * Same as {@link PutOpt#identityCacheSize}, valid only for <em>put</em>
     * operation.
     */
    identityCacheSize?: number;
}

/**
 * Represents information about invocation of a method on {@link NoSQLClient}
 * instance. Contains the method that was called and its parameters including
 * the options <em>opt</em> parameter. Operation object may be used in the
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
 * {@link AuthorizationProvider#getAuthorization} method of authorization
 * provider. If the application is using custom authorization mechanism, it
 * can customize its behavior based on what operation requires authorization.
 * </li>
 * </ul>
 * <p> Note that the {@link Operation#opt} property also extends
 * {@link Config} object with which {@link NoSQLClient} instance was created,
 * so in addition to properties in <em>opt</em> argument you may use
 * {@link Operation#opt} to access all additional properties of
 * {@link Config}.
 * <p>
 * Besides the properties described below, the remaining properties of
 * {@link Operation} object represent parameters passed to the
 * {@link NoSQLClient} method and are named as such. The values of these
 * properties are the values passed as corresponding parameters of the method.
 * E.g. if the method takes parameter <em>tableName</em> with value 'Employee'
 * then the {@link Operation} object will have property
 * <em>tableName: 'Employee'</em>.
 */
export interface Operation {
    /**
     * The API represented by the operation, which is the
     * instance method of {@link NoSQLClient} class.
     */
    readonly api: Function;
    
    /**
     * <em>opt</em> parameter that is passed to {@link NoSQLClient} methods.
     * Extends {@link Config}.
     */
    readonly opt?: object;

    /**
     * Parameters passed to {@link NoSQLClient} method.
     */
    [name: string]: any;
}

/**
 * Cloud Service only.  Represents table entity tag (ETag).
 * <p>
 * Table ETag is an opaque value that represents the current
 * version of the table itself and can be used in table modification
 * operations such as {@link NoSQLClient#tableDDL},
 * {@link NoSQLClient#setTableLimits} and {@link NoSQLClient#setTableTags} to
 * only perform them if the ETag for the table has not changed. This is an
 * optimistic concurrency control mechanism allowing an application to ensure
 * that no unexpected modifications have been made to the table.
 * <p>
 * The value of the ETag passed to the table modification operations must be
 * the value {@link TableResult#etag} returned in the previous
 * {@link TableResult}. If set for on-premises service, the ETag is silently
 * ignored.
 */
export type TableETag = OpaqueType<string, "TableETag">;

/**
 * Cloud Service only. Represents defined tags for a table.
 * <p>
 * See chapter <em>Tagging Overview</em> in Oracle Cloud Infrastructure
 * documentation. Defined tags represent metadata managed by an administrator.
 * Users can apply these tags to a table by identifying the tag and supplying
 * its value.
 * <p>
 * Each defined tag belongs to a namespace, where a namespace serves as a
 * container for tag keys.  Defined tags are represented by a nested two-level
 * plain JavaScript object, with top-level keys representing tag namespaces
 * and the value of each key being an object containing tag keys and values
 * for a particular namespace.  All tag values must be strings.
 * <p>
 * Defined tags are used only in these cases: table creation operations
 * executed by {@link NoSQLClient#tableDDL} with <em>CREATE TABLE</em> SQL
 * statement and table tag modification operations executed by
 * {@link NoSQLClient#setTableTags}. They are not used for other table DDL
 * operations.  If set for an on-premises service, they are silently ignored.
 */
export interface DefinedTags {
    [namespace: string]: {
        [key: string]: string;
    }
}

/**
 * Cloud Service only. Represents free-form tags for a table.
 * <p>
 * See chapter <em>Tagging Overview</em> in Oracle Cloud Infrastructure
 * documentation. Free-form tags represent an unmanaged metadata created and
 * applied by the user. Free-form tags do not use namespaces.  Free-form tags
 * are represented by a plain JavaScript object containing tag keys and
 * values. All tag values must be strings.
 * <p>
 * Free-form tags are used only in these cases: table creation operations
 * executed by {@link NoSQLClient#tableDDL} with <em>CREATE TABLE</em> SQL
 * statement and table tag modification operations executed by
 * {@link NoSQLClient#setTableTags}. They are not used for other table DDL
 * operations. If set for an on-premises service, they are silently ignored.
 */
export interface FreeFormTags {
    [key: string]: string;
}
