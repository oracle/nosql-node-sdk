/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { NoSQLError, NoSQLArgumentError, NoSQLTimeoutError,
    NoSQLNetworkError, NoSQLServiceError, NoSQLAuthorizationError,
    NoSQLQueryError } from "./error";
import type { NoSQLClient } from "./nosql_client";
import type { Config, RetryConfig, RetryHandler } from "./config";
import type { AuthorizationProvider } from "./auth/config";
import type { ServiceType } from "./constants";
import type { TableResult } from "./result";
import type { QueryOpt } from "./opt";

/**
 * This enumeration lists error codes for different errors raised by the
 * driver.  Error codes constants also store additional information
 * such as if the error is retryable. ErrorCode is used by {@link NoSQLError}
 * and its subclasses.  It is indicated below which errors are retryable.
 * @see {@page tables.md}
 */
export enum ErrorCode {
    /**
     * Server received unknown or unsupported operation.
     */
    UNKNOWN_OPERATION = "UNKNOWN_OPERATION",

    /**
     * The operation attempted to access a table that does not exist
     * or is not in a visible state.
     */
    TABLE_NOT_FOUND = "TABLE_NOT_FOUND",

    /**
     * The operation attempted to access a index that does not exist
     * or is not in a visible state.
     */
    INDEX_NOT_FOUND = "INDEX_NOT_FOUND",

    /**
     * Operation is called with invalid argument value(s) or invalid options.
     * This error code is also used if invalid configuration is passed to
     * {@link NoSQLClient} constructor.
     * @see {@link NoSQLArgumentError}
     */
    ILLEGAL_ARGUMENT = "ILLEGAL_ARGUMENT",

    /**
     * Indicates that an attempt has been made to create a row with a
     * size that exceeds the system defined limit.
     */
    ROW_SIZE_LIMIT_EXCEEDED = "ROW_SIZE_LIMIT_EXCEEDED",

    /**
     * Indicates that an attempt has been made to create a row with a
     * primary key or index key size that exceeds the system defined limit.
     */
    KEY_SIZE_LIMIT_EXCEEDED = "KEY_SIZE_LIMIT_EXCEEDED",

    /**
     * Indicates that the number of operations passed to
     * {@link NoSQLClient#writeMany}, {@link NoSQLClient#putMany} or
     * {@link NoSQLClient#deleteMany} methods exceeds the system defined
     * limit.
     */
    BATCH_OP_NUMBER_LIMIT_EXCEEDED = "KEY_SIZE_LIMIT_EXCEEDED",

    /**
     * Indicates that the size of a request to the server exceeds the system
     * defined limit.
     */
    REQUEST_SIZE_LIMIT_EXCEEDED = "REQUEST_SIZE_LIMIT_EXCEEDED",

    /**
     * The operation attempted to create a table but the named table already
     * exists.
     */
    TABLE_EXISTS = "TABLE_EXISTS",

    /**
     * The operation attempted to create an index for a table but the named
     * index already exists.
     */
    INDEX_EXISTS = "INDEX_EXISTS",

    /**
     * Indicates that an application presented an invalid authorization string
     * in a request to the server.  Whether this error is retryalble depends
     * on the cause.  If the error is due to access token expiration, it can
     * be retried, in which case a fresh access token should be obtained
     * before the retry.  However if the retry results in the same error,
     * then the cause is not access token expiration and the error is no
     * longer retryable and should be returned to the application.  This logic
     * is implemented by default {@link RetryHandler} and default
     * {@link AuthorizationProvider}.
     * @see {@link RetryConfig}
     * @see {@link Config}
     */
    INVALID_AUTHORIZATION = "INVALID_AUTHORIZATION",

    /**
     * Indicates that an application does not have sufficient permission
     * to perform an operation.
     */
    INSUFFICIENT_PERMISSION = "INSUFFICIENT_PERMISSION",

    /**
     * The operation attempted to create a resource but it already exists.
     */
    RESOURCE_EXISTS = "RESOURCE_EXISTS",

    /**
     * The operation attempted to access a resource that does not exist
     * or is not in a visible state.
     */
    RESOURCE_NOT_FOUND = "RESOURCE_NOT_FOUND",

    /**
     * Indicates that an attempt has been made to create a number of tables
     * that exceeds the system defined limit.
     */
    TABLE_LIMIT_EXCEEDED = "TABLE_LIMIT_EXCEEDED",

    /**
     * Indicates that an attempt has been made to create more indexes on
     * a table than the system defined limit.
     */
    INDEX_LIMIT_EXCEEDED = "INDEX_LIMIT_EXCEEDED",

    /**
     * Invalid protocol message is received by the server or by the client.
     * Indicates communication error between the server and the driver.
     */
    BAD_PROTOCOL_MESSAGE = "BAD_PROTOCOL_MESSAGE",

    /**
     * Indicates that an attempt has been made to evolve the schema of a
     * a table more times than allowed by the system defined limit.
     */
    EVOLUTION_LIMIT_EXCEEDED = "EVOLUTION_LIMIT_EXCEEDED",

    /**
     * Indicates that an attempt has been made to create or modify a table
     * using limits that exceed the maximum allowed for a single table.
     */
    TABLE_DEPLOYMENT_LIMIT_EXCEEDED = "TABLE_DEPLOYMENT_LIMIT_EXCEEDED",

    /**
     * Indicates that an attempt has been made to create or modify a table
     * using limits that cause the tenant's aggregate resources to exceed
     * the maximum allowed for a tenant.
     */
    TENANT_DEPLOYMENT_LIMIT_EXCEEDED = "TENANT_DEPLOYMENT_LIMIT_EXCEEDED",

    /**
     * Indicates that the requested operation is not supported.  Some
     * operations are supported for Cloud Service but not for On-Premise NoSQL
     * Database (see {@link ServiceType}) and vice versa.
     */
    OPERATION_NOT_SUPPORTED = "OPERATION_NOT_SUPPORTED",

    /**
     * Indicates a record version mismatch. REST operations only.
     */
    ETAG_MISMATCH = "ETAG_MISMATCH",

    /**
     * Indicates the client protocol version is not supported by the server,
     * i.e. the client is newer than the server. The driver will try to
     * decrement the protocol version, if possible, and try again. This error
     * will result if the protocol version cannot be further decremented.
     */
    UNSUPPORTED_PROTOCOL = "UNSUPPORTED_PROTOCOL",

    /**
     * Cloud service only.
     * Indicates that an operation is attempted on a replicated table that
     * is not yet fully initialized.
     * @see {@link TableResult#isLocalReplicaInitialized}
     * @see {@link NoSQLClient#addReplica}
     */
    TABLE_NOT_READY = "TABLE_NOT_READY",

    /**
     * Indicates that the server does not support the current query protocol
     * version, i.e. the client is using newer query version than the server.
     * The driver will try to decrement the query version, if possible, and
     * try again. This error will result if the query version cannot be
     * further decremented.
     * @type {ErrorCode}
     */
    UNSUPPORTED_QUERY_VERSION = "UNSUPPORTED_QUERY_VERSION",

    /**
     * Indicates that the provisioned read throughput has been exceeded.
     * <p>
     * This error is retryable and will be retried by the driver's default
     * {@link RetryHandler}.  However, it is recommended that applications
     * attempt to avoid throttling exceptions by rate limiting themselves to
     * the degree possible.
     * <p>
     * Retries and behavior related to throttling can be managed by
     * configuring retry handler and options in {@link RetryConfig}.
     * @see {@link RetryConfig}
     */
    READ_LIMIT_EXCEEDED = "READ_LIMIT_EXCEEDED",

    /**
     * Indicates that the provisioned write throughput has been exceeded.
     * <p>
     * This error is retryable and will be retried by the driver's default
     * {@link RetryHandler}.  However, it is recommended that applications
     * attempt to avoid throttling exceptions by rate limiting themselves to
     * the degree possible.
     * <p>
     * Retries and behavior related to throttling can be managed by
     * configuring retry handler and options in {@link RetryConfig}.
     * @see {@link RetryConfig}
     */
    WRITE_LIMIT_EXCEEDED = "WRITE_LIMIT_EXCEEDED",

    /**
     * Indicates that a table size limit has been exceeded by writing more
     * data than the table can support. This error is not retryable because the
     * conditions that lead to it being thrown, while potentially transient,
     * typically require user intervention.
     */
    SIZE_LIMIT_EXCEEDED = "SIZE_LIMIT_EXCEEDED",

    /**
     * This error happens when a non-data operation is throttled.
     * This can happen if an application attempts too many control operations
     * such as table creation, deletion, or similar methods. Such operations
     * do not use throughput or capacity provisioned for a given table but
     * they consume system resources and their use is limited.
     * <p>
     * This error is retryable but a large delay should be used in order to
     * minimize the chance that a retry will also be throttled.  This delay
     * can be configured by {@link RetryConfig#controlOpBaseDelay}
     * property of the default {@link RetryHandler}.
     * @see {@link RetryConfig}
     */
    OPERATION_LIMIT_EXCEEDED = "OPERATION_LIMIT_EXCEEDED",

    /**
     * Indicates that operation cannot be processed because the provided timeout
     * interval is exceeded. If the operation is retryable, it is possible that
     * it has been retried a number of times before the timeout occurs.
     * @see {@link Config#timeout}
     * @see {@link Config#ddlTimeout}
     * @see {@link NoSQLTimeoutError}
     */
    REQUEST_TIMEOUT = "REQUEST_TIMEOUT",

    /**
     * Indicates that there is an internal system problem.
     * Most system problems are temporary, so this is a retryable error.
     */
    SERVER_ERROR = "SERVER_ERROR",

    /**
     * Indicates that the service is temporarily unavailable.  This is retryable
     * error.
     */
    SERVICE_UNAVAILABLE = "SERVICE_UNAVAILABLE",

    /**
     * Indicates that a table operation failed because the table is in use or
     * busy.  Only one modification operation at a time is allowed on a table.
     * This is a retryable error.
     */
    TABLE_BUSY = "TABLE_BUSY",

    /**
     * Indicates that security information is not ready in the system. This error
     * will occur as the system acquires security information and must be retried
     * in order for authorization to work properly.
     */
    SECURITY_INFO_UNAVAILABLE = "SECURITY_INFO_UNAVAILABLE",

    /**
     * Indicates that authentication to kvstore failed either because
     * authentication information was not provided or because authentication
     * session has expired.  The driver will automatically retry
     * authentication.
     */
    RETRY_AUTHENTICATION = "RETRY_AUTHENTICATION",

    /**
     * Indicates that a server error occured that is not classified by known
     * error codes.  Server response may still provide additional information.
     */
    UNKNOWN_ERROR = "UNKNOWN_ERROR",

    /**
     * Indicates that a service is in incorrect state.  Administrative
     * intervention may be required.
     */
    ILLEGAL_STATE = "ILLEGAL_STATE",

    /**
     * Indicates network error when trying to communicate with the service.
     * Can be due to inability to connect (e.g. if the network or
     * the service is down).  Note that this is different from unsuccessful
     * response from the service, which is indicated by
     * {@link ErrorCode.SERVICE_ERROR}.
     * @see {@link NoSQLNetworkError} 
     */
    NETWORK_ERROR = "NETWORK_ERROR",

    /**
     * Indicates unsuccessful response from the service.  Even though the client
     * was able to communicate with the service, the service was not able to
     * process client request and thus returned unsuccessful response.
     * Additional information is provided in the error message.  Note that
     * this is different from inability to communicate with the service which is
     * indicated by {@link ErrorCode.NETWORK_ERROR}.
     * @see {@link NoSQLServiceError}
     */
    SERVICE_ERROR = "SERVICE_ERROR",

    /**
     * Indicates authorization error caused by problem with accessing user or
     * application credentials.  The reason for this error depends on what
     * credential provider is used for the authorization.  E.g. if file system
     * credentials are used, this error may result if the credentials file is
     * not found or not accessible.
     * @see {@link NoSQLAuthorizationError}
     */
    CREDENTIALS_ERROR = "CREDENTIALS_ERROR",

    /**
     * Indicates that the operation to obtain access token or other data
     * from authorization server was unauthorized.  See
     * {@link NoSQLAuthorizationError} for more information on this error.
     * @see {@link NoSQLAuthorizationError}
     */
    UNAUTHORIZED = "UNAUTHORIZED",

    /**
     * Memory consumed by client-side query execution exceeded the limit set by
     * {@link QueryOpt#maxMemoryMB}, {@link Config#maxMemoryMB} or default
     * limit of 1 GB.  To execute the query successfully you may need to
     * increase this limit.
     * @see {@link NoSQLQueryError}
     * @see {@link NoSQLClient#query}
     * @see {@link Config#maxMemoryMB}
     */
    MEMORY_LIMIT_EXCEEDED = "MEMORY_LIMIT_EXCEEDED"
}
