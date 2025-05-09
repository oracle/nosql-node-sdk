/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { AgentOptions as HttpsAgentOptions } from "https";
import type { ServiceType } from "./constants";
import type { CompletionOpt, TableDDLOpt, AdminDDLOpt } from "./opt";
import type { Consistency } from "./constants";
import type { Durability } from "./param";
import type { Region } from "./region";
import type { AuthConfig } from "./auth/config";
import type { DBNumberConfig } from "./db_number";
import type { RateLimiter, RateLimiterConstructor } from
    "./rate_limiter/rate_limiter";
import type { Operation } from "./param";
import type { NoSQLClient } from "./nosql_client";
import type { NoSQLError } from "./error";
import type { IAMConfig } from "./auth/iam/types";

/**
 * Configuration object passed to construct {@link NoSQLClient} instance.
 * <p>
 * This configuration can be passed to {@link NoSQLClient}
 * directly as JavaScript object or stored in a file as JSON or JavaScript
 * object (in which case the file path is passed to the NoSQLClient
 * constructor).  Note that most of the properties are optional and
 * applicable default values will be used in their absense.
 * <p>
 * Note that methods of {@link NoSQLClient} that perform operations on NoSQL
 * database take <em>opt</em> parameter as one of the arguments.  In addition
 * to options specific to particular operation, the <em>opt</em> parameter
 * may have some of the same properties present in {@link Config} and
 * will override thier values for particular operation.  Not all options can
 * be overriden in the <em>opt</em> parameter.  {@link NoSQLClient} method
 * descriptions provide list of options that can override the property values
 * in {@link Config} for particular method.  Remaining properties can only be
 * specified in {@link Config} and thus are set for the lifetime of
 * {@link NoSQLClient} instance.  Note that all parameters present in
 * {@link Config}, with the exception of user-defined class instances, will
 * be copied upon creation of {@link NoSQLClient} instance, so their
 * modification will have no effect after {@link NoSQLClient} instance is
 * created.
 * <p>
 * Note that all timeouts, durations, and other numeric options here and
 * elsewhere are restricted to being non-negative 32 bit integers, unless
 * specified otherwise (the exception to this is when dates are represented as
 * absolute value of milliseconds).
 * <p>
 * Note that since currently JavaScript and Node.js do not have a way to work
 * with arbitrary precision decimal numbers, the driver supports integration
 * with 3rd party number libraries to use for database type <em>Number</em>.
 * This allows you to use a 3rd party of your choice (e.g. decimal.js,
 * bignumber.js, etc.) to represent arbitrary precision numbers.  See
 * {@link DBNumberConfig} for details.
 */
export interface Config {
    /**
     * Type of service the driver will be using.  May be specified as either
     * {@link ServiceType} enumeration or string.  Currently supported values
     * are {@link ServiceType.CLOUD}, {@link ServiceType.CLOUDSIM} and
     * {@link ServiceType.KVSTORE}. Although this property is optional, it is
     * recommended to specify it to avoid ambiguity. If not specified, in most
     * cases the driver will deduce the service type from other information in
     * {@link Config}.  See {@link ServiceType} for details.
     */
    serviceType?: ServiceType | string;

    /**
     * Endpoint to use to connect to the service.  See the online
     * documentation for the complete set of available regions. For example,
     * <em>ndcs.uscom-east-1.oraclecloud.com</em> or <em>localhost:8080</em>.
     * Endpoint specifies the host to connect to but may optionally specify
     * port and/or protocol.  Protocol is usually not needed and is inferred
     * from the host and port information: if no port is specified, port 443
     * and protocol HTTPS are assumed, if port 443 is specified, HTTPS is
     * assumed, if port is specified and it is not 443, HTTP is assumed. If
     * protocol is specified, it must be either HTTP or HTTPS. For example,
     * <em>https://nosql.us-phoenix-1.oci.oraclecloud.com</em> or
     * <em>http://localhost:8080</em>.  In this case, in addition to string,
     * the endpoint may also be specified as Node.js URL instance.  If
     * protocol is specified but not port, 443 is assumed for HTTPS and 8080
     * for HTTP (which is the default port for CloudSim).  You may specify
     * <em>endpoint</em> or <em>region</em> but not both.
     */
    endpoint?: string|URL;

    /**
     * Cloud service only. Specify a region to use to connect to the Oracle
     * NoSQL Database Cloud Service. This property may be specified instead of
     * {@link endpoint}. The service endpoint will be inferred from the
     * region. May be specified either as {@link Region} enumeration constant,
     * e.g. {@link Region.AP_MUMBAI_1} or as a string (so it can be specified
     * in config file), which must be either one of {@link Region} enumeration
     * constant names, e.g. <em>AP_MUMBAI_1</em>, <em>US_ASHBURN_1</em>, etc.
     * or one of region identifiers, e.g. <em>ap-mumbai-1</em>,
     * <em>us-ashburn-1</em>, etc.  You must specify either {@link region} or
     * {@link endpoint} but not both. The only exception to this is if you set
     * the region identifier in an OCI configuration file together with your
     * credentials, in which case you need not specify either {@link region}
     * or {@link endpoint}. This implies that you store your credentials and
     * region identifier in the OCI configuration file and provide
     * configuration in {@link IAMConfig} to access this file or use the
     * defaults. See {@link IAMConfig} for more information. Note that setting
     * {@link region} or {@link endpoint} takes precedence over region
     * identifier in an OCI configuration file.
     */
    region?: Region|string;

    /**
     * Timeout in for non-DDL operations in milliseconds.  Note that for
     * operations that are automatically retried, the timeout is cumulative
     * over all retries and not just a timeout for a single retry.  This means
     * that all retries and waiting periods between retries are counted
     * towards the timeout.
     * @defaultValue 5000 (5 seconds)
     */
    timeout?: number;

    /**
     * Timeout for DDL operations, that is operations executed by
     * {@link NoSQLClient#tableDDL}, {@link NoSQLClient#setTableLimits} or
     * {@link NoSQLClient#adminDDL} methods, in milliseconds.  Used as a
     * default value for {@link TableDDLOpt#timeout} and
     * {@link AdminDDLOpt#timeout} for these methods.  Note that if
     * {@link TableDDLOpt#complete} or {@link AdminDDLOpt#complete} is true,
     * separate default timeouts are used for issuing the DDL operation and
     * waiting for its completion, with values of {@link ddlTimeout} for the
     * former and {@link tablePollTimeout} or {@link adminPollTimeout} for the
     * latter (if not set, these poll timeouts default to
     * {@link !Infinity | Infinity}).
     * @defaultvalue 10000 (10 seconds)
     */
    ddlTimeout?: number;

    /**
     * Timeout for all operations while waiting for security information to be
     * available in the system, in milliseconds.  It is different from regular
     * operation timeout and is used while automatically retrying operations
     * that failed with error code
     * {@link ErrorCode.SECURITY_INFO_UNAVAILABLE}).
     * @defaultValue 10000 (10 seconds)
     */
    securityInfoTimeout?: number;

    /**
     * Timeout when polling for table state using
     * {@link NoSQLClient#forCompletion} while waiting for completion of
     * {@link NoSQLClient#tableDDL} operation, in milliseconds. Can be
     * overriden by {@link CompletionOpt#timeout} or
     * {@link TableDDLOpt#timeout} respectively.
     * @defaultValue {@link !Infinity | Infinity} (no timeout). This is to
     * allow for potentially long running table DDL operations.
     */
    tablePollTimeout?: number;

    /**
     * Delay between successive poll attempts when polling for table state
     * using {@link NoSQLClient#forCompletion} while waiting for completion of
     * {@link NoSQLClient#tableDDL} operation, in milliseconds.  Can be
     * overriden by {@link CompletionOpt#delay} or {@link TableDDLOpt#delay}
     * respectively.
     * @defaultValue 1000 (1 second)
     */
    tablePollDelay?: number;

    /**
     * Timeout when waiting for completion of {@link NoSQLClient#adminDDL}
     * operation, as used by {@link NoSQLClient#forCompletion}, in
     * milliseconds. Can be overriden by {@link CompletionOpt#timeout} or
     * {@link AdminDDLOpt#timeout} respectively.
     * @defaultValue {@link !Infinity | Infinity} (no timeout). This is to
     * allow for potentially long running admin DDL operations.
     */
    adminPollTimeout?: number;

    /**
     * Delay between successive poll attempts when waiting for completion of
     * {@link NoSQLClient#adminDDL} operation, as used by
     * {@link NoSQLClient#forCompletion}, in milliseconds. Can be overriden by
     * {@link CompletionOpt#delay} or {@link TableDDLOpt#delay} respectively.
     * @defaultValue 1000 (1 second)
     */
    adminPollDelay?: number;

    /**
     * {@link Consistency} used for read operations.
     * @defaultValue {@link Consistency.EVENTUAL} (eventual consistency)
     */
    consistency?: Consistency;
   
    /**
     * On-premises only. {@link Durability} used for write operations.
     * @defaultValue If not set, the default server-side durability settings
     * are used.
     */
    durability?: Durability;

    /**
     * Maximum amount of memory in megabytes that may be used by the
     * driver-side portion of execution of queries for operations such as
     * duplicate elimination (which may be required if using an index on an
     * array or a map) and sorting. Such operations may require significant
     * amount of memory as they need to cache full result set or a large
     * subset of it locally. If memory consumption exceeds this value, error
     * will result.
     * @defaultValue 1024 (1 GB)
     */
    maxMemoryMB?: number;
   
    /**
     * Cloud service only.  Compartment to use for operations with this
     * {@link NoSQLClient} instance.
     * <p>
     * If using specific user's identity, this can be specified either as
     * compartment OCID or compartment name. If compartment name is used it
     * can be either the name of a top-level compartment or a path to
     * a nested compartment, e.g.
     * <em>compartmentA.compartmentB.compartmentC</em>. The path should not
     * include the root compartment name (tenant). If this property is not
     * specified either here or for an individual operation the tenant OCID is
     * used as the compartment id for the operation, which is the id of the
     * root compartment for the tenancy. See
     * {@link https://docs.cloud.oracle.com/iaas/Content/GSG/Concepts/settinguptenancy.htm | Setting Up Your Tenancy}
     * for more information.
     * <p>
     * If using Instance Principal or Resource Principal, compartment OCID
     * must be used and there is no default.
     * @see {@link IAMConfig}
     */
    compartment?: string;

    /**
     * On-premises only. Default namespace for operations with this
     * {@link NoSQLClient} instance.
     * Any non-namespace qualified table name in requests and/or SQL
     * statements will be resolved/qualified to the specified namespace.
     * <p>
     * Note: if a namespace is specified in the table name for the request
     * (using the <em>namespace:table_name</em> format), that value will
     * override this setting.
     */
    namespace?: string;

    /**
     * Configuration for operation retries as specified by {@link RetryConfig}
     * object. If not specified, default retry configuration is used, see
     * {@link RetryConfig}. May be set to <em>null</em> to disable operation
     * retries alltogether.
     * @see {@link RetryConfig}
     */
    retry?: RetryConfig|null;

    /**
     * Http or https options used for the driver http requests.
     * See {@link HttpOpt}. These are options passed to constructors of
     * Node.js <em>HTTP.Agent</em> or <em>HTTPS.Agent</em>. If not specified,
     * default global<em>HTTP.Agent</em> or <em>HTTPS.Agent</em> will be used
     * instead.
     * @see {@link HttpOpt}
     */
    httpOpt?: HttpOpt;

    /**
     * Authorization configuration, see {@link AuthConfig}.
     * @see {@link AuthConfig}
     */
    auth?: AuthConfig;

    /**
     * Configuration to use 3rd party number/decimal library for values of
     * datatype <em>Number</em>. If not specified, the driver will use
     * Javascript <em>number</em> type to represent values of type Number.
     * @see {@link DBNumberConfig}
     */
    dbNumber?: DBNumberConfig;

    /**
     * If set to <em>true</em>, Database Type <em>Long</em> is represented as
     * JavaScript type {@link !BigInt | BigInt}. This allows to represent
     * 64-bit integers without loss of precsision, even when they are outside
     * of range from
     * {@link !Number.MIN_SAFE_INTEGER | Number.MIN_SAFE_INTEGER} to
     * {@link !Number.MAX_SAFE_INTEGER | Number.MAX_SAFE_INTEGER} (that is,
     * their magnitude exceeds 53 bits in size). If this option is set, the
     * values of datatype <em>Long</em> returned by the service by operations
     * such as {@link NoSQLClient#get} as well as query results will be of
     * type <em>bigint</em>. For values of datatype <em>Long</em> passed to
     * the service by operations such as {@link NoSQLClient#put} you may use
     * either {@link !BigInt | BigInt} or <em>number</em>. If not specified,
     * defaults to <em>false</em>, meaning that the values of datatype
     * <em>Long</em> are returned as <em>number</em>. In this case, loss of
     * precision is possible for values outside the safe integer range as
     * indicated above.
     * @defaultValue false
     */
    longAsBigInt?: boolean;

    /**
     * For Cloud Service or Cloud Simulator only. Enables rate limiting
     * based on table limits.  You may use default rate limiter provided by
     * the driver or supply a custom rate limiter.  Set this value to
     * <em>true</em> to use default rate limiter (see
     * {@link SimpleRateLimiter}). To use custom rate limiter, set this value
     * to the constructor function of your custom {@link RateLimiter} class.
     * Alternatively, provide a module name which exports the constructor
     * function. If not specified or set to <em>false</em>, rate limiting is
     * disabled.
     * @see {@link RateLimiter}
     */
    rateLimiter?: boolean|RateLimiterConstructor|string;

    /**
     * For Cloud Service or Cloud Simulator only.  When rate limiting is
     * enabled (see {@link rateLimiter}), specifies percentage of table limits
     * this {@link NoSQLClient} instance will use.  This is useful when
     * running multiple clients and allotting each client only a portion of
     * the table limits. Must be > 0 and <= 100.
     * @defaultValue 100%, meaning to use full table limits.
     * @see {@link RateLimiter}
     */
    rateLimiterPercent?: number;
}

/**
 * Configuration for operation retries, which is set as {@link Config#retry}.
 * <p>
 * When an operation fails with {@link NoSQLError} or its subclass, the driver
 * has an option to retry the operation automatically, transparently to the
 * application.  The operation may be retried multiple times until the
 * operation timeout is reached.  The driver may only retry the operations
 * that failed with retryable {@link ErrorCode} (see
 * {@link NoSQLError#errorCode}).  Whether the operation is retried and how
 * depends on the what {@link RetryHandler} is used.  Retry handler is an
 * object that provides two properties/methods: {@link RetryHandler#doRetry}
 * that determines whether the operation should be retried at given time and
 * {@link RetryHandler#delay} that determines how long to wait between
 * successive retries.
 * <p>
 * {@link RetryConfig} object may contain {@link RetryHandler} and applicable
 * parameters customize that retry handler.  Unless application sets its
 * own {@link RetryHandler}, the driver will use default retry handler which
 * is suitable for most applications.  Default {@link RetryHandler} works as
 * follows:
 * <p>
 * Whether the operation is retried depends on:
 * <ul>
 * <li>Whether the error is retryable as mentioned above. This is the case for
 * any {@link RetryHandler}.  Default {@link RetryHandler} has special
 * handling for {@link ErrorCode.INVALID_AUTHORIZATION}, see the description
 * of that error code for details.
 * </li>
 * <li>Type of the operation.  In general, only data operations are retried,
 * not DDL or metadata operations (such as {@link NoSQLClient#listTables} or
 * {@link NoSQLClient#getIndexes}).  However, if DDL operation caused
 * {@link ErrorCode.OPERATION_LIMIT_EXCEEDED}.
 * the operation will be retried with large delay as described below.</li>
 * <li>Whether the limit on the number of retries has been reached as
 * configured by {@link maxRetries} property.</li>
 * </ul>
 * For retry delay, an exponential backoff algorithm is used.  The delay
 * starts with {@link baseDelay} and then doubles on successive
 * retries.  In addition a random value between 0 and
 * {@link baseDelay} is added to this result.
 * <p>
 * Exceptions to this are:
 * <ul>
 * <li>If DDL operation resulted in {@link ErrorCode.OPERATION_LIMIT_EXCEEDED}
 * because of more stringent system limits for control operations, a much
 * larger delay is needed to retry the operation.  In this case the
 * exponential backoff algorithm will start with a large delay of
 * {@link controlOpBaseDelay}.  You may customize this value
 * depending on what limits the system has for DDL operations.  You may
 * disable automatic retries for this error by setting
 * {@link controlOpBaseDelay} to null.</li>
 * <li>Network errors (see {@link ErrorCode.NETWORK_ERROR}) and errors caused
 * by unavailability of security information (see
 * {@link ErrorCode.SECURITY_INFO_UNAVAILABLE}) are always retried regardless
 * of the number of retries reached without regard to
 * {@link maxRetries}.  As for other errors, the retries are
 * stopped when operation timeout is reached that results in
 * {@link NoSQLTimeoutError}.</li>
 * <li>When the retry is caused by unavailability of security information as
 * determined by {@link ErrorCode.SECURITY_INFO_UNAVAILABLE } the algorithm
 * starts with constant delay of {@link secInfoBaseDelay} for a
 * maximum number of retries {@link secInfoNumBackoff} and then
 * switches to exponential backoff algorithm described above also starting
 * with {@link secInfoBaseDelay}.  You can set
 * {@link secInfoNumBackoff} to 0 to start exponential backoff algorithm
 * immediately.</li>
 * </ul>
 * <p>
 * You may customize the default retry handler by overriding the values of any
 * properties mentioned above.
 */
export interface RetryConfig {
    /**
     * Retry handler used. Set this property if you want to use custom retry
     * handler. You may set this to <em>null</em> to disable retries
     * alltogether.
     */
    handler?: RetryHandler|null;

    /**
     * Maximum number of retries, including initial API invocation, for
     * default retry handler.
     * @defaultValue 10
     */
    maxRetries?: number;

    /**
     * Base delay between retries for exponential backoff algorithm in default
     * retry handler, in milliseconds.
     * @defaultValue 200
     */
    baseDelay?: number;

    /**
     * Base retry delay for {@link ErrorCode.OPERATION_LIMIT_EXCEEDED} used by
     * default retry handler exponential backoff algorithm.  Note that
     * automatic retries for this error only take effect if the timeout used
     * for the operation that caused the error (see {@link Config#timeout} and
     * {@link Config#ddlTimeout}) is greater than the value of
     * <em>controlOpBaseDelay</em>. Otherwise the operation won't be retried
     * and {@link ErrorCode.OPERATION_LIMIT_EXCEEDED} will be returned to the
     * application. You may also set this property to <em>null</em> to disable
     * automatic retries for this error (if it is prefferred that application
     * does manual retries for this error).
     * @defaultValue 60000 (1 minute)
     */
    controlOpBaseDelay?: number|null;

    /**
     * Base delay when waiting for availability of security information as in
     * error code {@link ErrorCode.SECURITY_INFO_UNAVAILABLE} for default
     * retry handler, in milliseconds.
     * @defaultValue 100
     */
    secInfoBaseDelay?: number;

    /**
     * Maximum number of retries with constant delay when waiting for
     * availability of security information, as in error code
     * {@link ErrorCode.SECURITY_INFO_UNAVAILABLE} for default retry handler.
     * @defaultValue 10
     */
    secInfoNumBackoff?: number;
}

/**
 * Retry handler set as {@link RetryConfig#handler}.  Use this to set custom
 * retry handler.  This type should provide two properties which can
 * be functions or constants (see below): {@link doRetry} and {@link delay}.
 * It may be a plain object or an instance of a class.
 */
export interface RetryHandler {
    /**
     * Determines whether an operation should be retried.  Can be either
     * boolean, which applies to all operations, or a function that determines
     * whether given operation should be retried based on operation, number of
     * retries so far and the error occured.  See {@link doRetry}.
     */
    doRetry: boolean | ((operation: Operation, numRetries: number,
        err: NoSQLError) => boolean);

    /**
     * Determines delay between successive retries in milliseconds.  Can be
     * either number, which indicates constant delay in milliseconds, or a
     * function that determines delay based on operation, number of retries so
     * far and the error occurred. See {@link delay}.
     */
    delay: number | ((operation: Operation, numRetries: number,
        err: NoSQLError) => number);
}

/**
 * Represents http or https connection options used for driver http requests.
 * These are the same options that can be passed to constructors of Node.js
 * <em>HTTP.Agent</em> or <em>HTTPS.Agent</em>.
 */
export type HttpOpt = HttpsAgentOptions;
