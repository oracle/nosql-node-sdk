/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const Enum = require('./constants').Enum;

/**
 * Defines errors and related classes used by the driver.
 */

/**
 * This enumeration lists error codes for different errors raised by the
 * driver.  Error code constants also store additional properties of the error
 * such as if the error is retryable.  ErrorCode is used by {@link NoSQLError}
 * and its subclasses.  It is indicated below which errors are retryable.
 * @extends Enum
 * @hideconstructor
 * @tutorial tables
 */
class ErrorCode extends Enum {
    constructor(ordinal, desc, name) {
        super(ordinal, desc, name);
        this.retryable = false;
    }
}

/*
 * Error codes for user-generated errors, range from 1 to 50(exclusive).
 * These include illegal arguments, exceeding size limits for some objects,
 * resource not found, etc.
 */

/**
 * Server received unknown or unsupported operation.
 * @type {ErrorCode}
 */
ErrorCode.UNKNOWN_OPERATION = new ErrorCode(1);

/**
 * The operation attempted to access a table that does not exist
 * or is not in a visible state.
 * @type {ErrorCode}
 */
ErrorCode.TABLE_NOT_FOUND = new ErrorCode(2, 'Table not found');

/**
 * The operation attempted to access a index that does not exist
 * or is not in a visible state.
 * @type {ErrorCode}
 */
ErrorCode.INDEX_NOT_FOUND = new ErrorCode(3);

/**
 * Operation is called with invalid argument value(s) or invalid options.
 * This error code is also used if invalid configuration is passed to
 * {@link NoSQLClient} constructor.
 * @type {ErrorCode}
 * @see {@link NoSQLArgumentError}
 */
ErrorCode.ILLEGAL_ARGUMENT = new ErrorCode(4);

/**
 * Indicates that an attempt has been made to create a row with a
 * size that exceeds the system defined limit.
 * @type {ErrorCode}
 */
ErrorCode.ROW_SIZE_LIMIT_EXCEEDED = new ErrorCode(5);

/**
 * Indicates that an attempt has been made to create a row with a
 * primary key or index key size that exceeds the system defined limit.
 * @type {ErrorCode}
 */
ErrorCode.KEY_SIZE_LIMIT_EXCEEDED = new ErrorCode(6);

/**
 * Indicates that the number of operations passed to
 * {@link NoSQLClient#writeMany}, {@link NoSQLClient#putMany} or
 * {@link NoSQLClient#deleteMany} methods exceeds the system defined limit.
 * @type {ErrorCode}
 */
ErrorCode.BATCH_OP_NUMBER_LIMIT_EXCEEDED = new ErrorCode(7);

/**
 * Indicates that the size of a request to the server exceeds the system
 * defined limit.
 * @type {ErrorCode}
 */
ErrorCode.REQUEST_SIZE_LIMIT_EXCEEDED = new ErrorCode(8);

/**
 * The operation attempted to create a table but the named table already
 * exists.
 * @type {ErrorCode}
 */
ErrorCode.TABLE_EXISTS = new ErrorCode(9);

/**
 * The operation attempted to create an index for a table but the named index
 * already exists.
 * @type {ErrorCode}
 */
ErrorCode.INDEX_EXISTS = new ErrorCode(10);

/**
 * Indicates that an application presented an invalid authorization string
 * in a request to the server.  Whether this error is retryalble depends on
 * the cause.  If the error is due to access token expiration, it can be
 * retried, in which case a fresh access token should be obtained before the
 * retry.  However if the retry results in the same error, then the cause is
 * not access token expiration and the error is no longer retryable and should
 * be returned to the application.  This logic is implemented by default
 * {@link RetryHandler} and default {@link AuthorizationProvider}.
 * @type {ErrorCode}
 * @see {@link RetryConfig}
 * @see {@link Config}
 */
ErrorCode.INVALID_AUTHORIZATION = new ErrorCode(11);

/**
 * Indicates that an application does not have sufficient permission
 * to perform an operation.
 * @type {ErrorCode}
 */
ErrorCode.INSUFFICIENT_PERMISSION = new ErrorCode(12);

//Not used by the driver
/** @ignore */
ErrorCode.RESOURCE_EXISTS = new ErrorCode(13);

//Not used by the driver
/** @ignore */
ErrorCode.RESOURCE_NOT_FOUND = new ErrorCode(14);

/**
 * Indicates that an attempt has been made to create a number of tables
 * that exceeds the system defined limit.
 * @type {ErrorCode}
 */
ErrorCode.TABLE_LIMIT_EXCEEDED = new ErrorCode(15);

/**
 * Indicates that an attempt has been made to create more indexes on
 * a table than the system defined limit.
 * @type {ErrorCode}
 */
ErrorCode.INDEX_LIMIT_EXCEEDED = new ErrorCode(16);

/**
 * Invalid protocol message is received by the server or by the client.
 * Indicates communication error between the server and the driver.
 * @type {ErrorCode}
 */
ErrorCode.BAD_PROTOCOL_MESSAGE = new ErrorCode(17);

/**
 * Indicates that an attempt has been made to evolve the schema of a
 * a table more times than allowed by the system defined limit.
 * @type {ErrorCode}
 */
ErrorCode.EVOLUTION_LIMIT_EXCEEDED = new ErrorCode(18);

/**
 * Indicates that an attempt has been made to create or modify a table
 * using limits that exceed the maximum allowed for a single table.
 * @type {ErrorCode}
 */
ErrorCode.TABLE_DEPLOYMENT_LIMIT_EXCEEDED = new ErrorCode(19);

/**
 * Indicates that an attempt has been made to create or modify a table
 * using limits that cause the tenant's aggregate resources to exceed
 * the maximum allowed for a tenant.
 * @type {ErrorCode}
 */
ErrorCode.TENANT_DEPLOYMENT_LIMIT_EXCEEDED = new ErrorCode(20);

/**
 * Indicates that the requested operation is not supported.  Some operations
 * are supported for Cloud Service but not for On-Premise NoSQL Database
 * (see {@link ServiceType}) and vice versa.
 * @type {ErrorCode}
 */
ErrorCode.OPERATION_NOT_SUPPORTED = new ErrorCode(21);

/*
 * Error codes for user throttling, range from 50 to 100(exclusive).
 */

/**
 * Indicates that the provisioned read throughput has been exceeded.
 * <p>
 * This error is retryable and will be retried by the driver's default
 * {@link RetryHandler}.  However, it is recommended that applications
 * attempt to avoid throttling exceptions by rate limiting themselves to
 * the degree possible.
 * <p>
 * Retries and behavior related to throttling can be managed by configuring
 * retry handler and options in {@link RetryConfig}.
 * @type {ErrorCode}
 * @see {@link RetryConfig}
 */
ErrorCode.READ_LIMIT_EXCEEDED = new ErrorCode(50);

/**
 * Indicates that the provisioned write throughput has been exceeded.
 * <p>
 * This error is retryable and will be retried by the driver's default
 * {@link RetryHandler}.  However, it is recommended that applications
 * attempt to avoid throttling exceptions by rate limiting themselves to
 * the degree possible.
 * <p>
 * Retries and behavior related to throttling can be managed by configuring
 * retry handler and options in {@link RetryConfig}.
 * @type {ErrorCode}
 * @see {@link RetryConfig}
 */
ErrorCode.WRITE_LIMIT_EXCEEDED = new ErrorCode(51);

/**
 * Indicates that a table size limit has been exceeded by writing more
 * data than the table can support. This error is not retryable because the
 * conditions that lead to it being thrown, while potentially transient,
 * typically require user intervention.
 * @type {ErrorCode}
 */
ErrorCode.SIZE_LIMIT_EXCEEDED = new ErrorCode(52);

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
 * property of the default {@link RetryHandler}
 * @type {ErrorCode}
 * @see {@link RetryConfig}
 */
ErrorCode.OPERATION_LIMIT_EXCEEDED = new ErrorCode(53);

/*
 * Error codes for server issues, range from 100 to 150(exclusive).
 */

/*
 * Retryable server issues, range from 100 to 125(exclusive).
 * These are internal problems, presumably temporary, and need to be sent
 * back to the application for retry.
 */

/**
 * Indicates that operation cannot be processed because the provided timeout
 * interval is exceeded. If the operation is retryable, it is possible that
 * it has been retried a number of times before the timeout occurs.
 * @type {ErrorCode}
 * @see {@link Config}#timeout
 * @see {@link Config}#ddlTimeout
 * @see {@link NoSQLTimeoutError}
 */
ErrorCode.REQUEST_TIMEOUT = new ErrorCode(100);

/**
 * Indicates that there is an internal system problem.
 * Most system problems are temporary, so this is a retryable error.
 * @type {ErrorCode}
 */
ErrorCode.SERVER_ERROR = new ErrorCode(101);

/**
 * Indicates that the service is temporarily unavailable.  This is retryable
 * error.
 * @type {ErrorCode}
 */
ErrorCode.SERVICE_UNAVAILABLE = new ErrorCode(102);

/**
 * Indicates that a table operation failed because the table is in use or
 * busy.  Only one modification operation at a time is allowed on a table.
 * This is a retryable error.
 * @type {ErrorCode}
 */
ErrorCode.TABLE_BUSY = new ErrorCode(103);

/**
 * Indicates that security information is not ready in the system. This error
 * will occur as the system acquires security information and must be retried
 * in order for authorization to work properly.
 * @type {ErrorCode}
 */
ErrorCode.SECURITY_INFO_UNAVAILABLE = new ErrorCode(104);

/**
 * Indicates that authentication to kvstore failed either because
 * authentication information was not provided or because authentication
 * session has expired.  The driver will automatically retry
 * authentication.
 */
ErrorCode.RETRY_AUTHENTICATION = new ErrorCode(105);

ErrorCode.SECURITY_INFO_UNAVAILABLE.retryable = true;
ErrorCode.SERVER_ERROR.retryable = true;
ErrorCode.TABLE_BUSY.retryable = true;
ErrorCode.READ_LIMIT_EXCEEDED.retryable = true;
ErrorCode.WRITE_LIMIT_EXCEEDED.retryable = true;
ErrorCode.INVALID_AUTHORIZATION.retryable = true;
ErrorCode.RETRY_AUTHENTICATION.retryable = true;
ErrorCode.OPERATION_LIMIT_EXCEEDED.retryable = true;
ErrorCode.SERVICE_UNAVAILABLE.retryable = true;
ErrorCode.REQUEST_TIMEOUT.retryable = true;

/*
 * Other server issues, begin from 125.
 * These include server illegal state, unknown server error, etc.
 * They might be retry-able, or not.
 */

/**
 * Indicates that a server error occured that is not classified by known
 * error codes.  Server response may still provide additional information.
 * @type {ErrorCode}
 */
ErrorCode.UNKNOWN_ERROR = new ErrorCode(125);

/**
 * Indicates that a service is in incorrect state.  Administrative
 * intervention may be required.
 * @type {ErrorCode}
 */
ErrorCode.ILLEGAL_STATE = new ErrorCode(126);

/*
 * Node.js driver error codes.
 */
const DRV_ERR_START = 1000;

/**
 * Indicates network error when trying to communicate with the service.
 * Can be due to inability to connect (e.g. if the network or
 * the service is down).  Note that this is different from unsuccessful
 * response from the service, which is indicated by
 * {@link ErrorCode.SERVICE_ERROR}.
 * @type {ErrorCode}
 * @see {@link NoSQLNetworkError} 
 */
ErrorCode.NETWORK_ERROR = new ErrorCode(DRV_ERR_START);

ErrorCode.NETWORK_ERROR.retryable = true;

/**
 * Indicates unsuccessful response from the service.  Even though the client
 * was able to communicate with the service, the service was not able to
 * process client request and thus returned unsuccessful response.
 * Additional information is provided in the error message.  Note that
 * this is different from inability to communicate with the service which is
 * indicated by {@link ErrorCode.NETWORK_ERROR}.
 * @type {ErrorCode}
 * @see {@link NoSQLServiceError}
 */
ErrorCode.SERVICE_ERROR = new ErrorCode(DRV_ERR_START + 1);

/**
 * Indicates authorization error caused by problem with accessing user or
 * application credentials.  The reason for this error depends on what
 * credential provider is used for the authorization.  E.g. if file system
 * credentials are used, this error may result if the credentials file is
 * not found or not accessible.
 * @type {ErrorCode}
 * @see {@link NoSQLAuthorizationError}
 */
ErrorCode.CREDENTIALS_ERROR = new ErrorCode(DRV_ERR_START + 2);

/**
 * Indicates that the operation to obtain access token or other data
 * from authorization server was unauthorized.  See
 * {@link NoSQLAuthorizationError} for more information on this error.
 * @type {ErrorCode}
 * @see {@link NoSQLAuthorizationError}
 */
ErrorCode.UNAUTHORIZED = new ErrorCode(DRV_ERR_START + 3);

/**
 * Memory consumed by client-side query execution exceeded the limit set by
 * <em>opt.maxMemoryMB</em> in {@link NoSQLClient#query} API,
 * {@link Config}#maxMemoryMB or default limit of 1 GB.  To execute the
 * query successfully you may need to increase this limit.
 * @type {ErrorCode}
 * @see {@link NoSQLQueryError}
 * @see {@link NoSQLClient#query}
 * @see {@link Config}#maxMemoryMB
 */
ErrorCode.MEMORY_LIMIT_EXCEEDED = new ErrorCode(DRV_ERR_START + 4); 

ErrorCode.seal();

module.exports = ErrorCode;
