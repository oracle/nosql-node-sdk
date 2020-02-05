/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
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

function makeMsg(errCode, msg, cause) {
    let m = `[${errCode.name}] ${msg}`;
    if (cause) {
        m += '; Caused by: ' + cause.message;
    }
    return m;
}

/**
 * This is the base class for all errors returned by the driver.
 * {@link NoSQLError} extends JavaScript Error class and all other errors used
 * by the driver extend {@link NoSQLError}.  Note that you don't create these
 * error objects explicitly, but the driver returns errors in the following
 * ways:
 * <ul>
 * <li>For synchronous APIs the error is thrown as an exception</li>
 * <li>For asynchronous APIs, which is most of the APIs in {@link NoSQLClient}
 * class, the error is the result of the rejection of Promise returned by
 * the API.  In async function, you can use <em>try...catch</em> to handle
 * these errors as if they were exceptions.
 * </ul>
 * <p>
 * Each error contains {@link ErrorCode} which can be used in the application
 * logic to take different actions upon different kinds of errors.  In
 * addition, an error may have an optional <em>cause</em>, which is another
 * error that caused this error.  The <em>cause</em> is typically also
 * instance of {@link NoSQLError} or its subclass, but sometimes may not be.
 * E.g. if an authorization error is caused by invalid JSON response, the
 * <em>cause</em> would be instance of <em>SyntaxError</em>.
 * <p>
 * In addition, each error has an optional operation object which describes
 * the operation that caused the error, including the API and its arguments,
 * see {@link Operation}. Not all errors have operation available.
 * <p>
 * Most errors returned from the server result in {@link NoSQLError}, but for
 * other cases specialized subclasses are used such as
 * {@link NoSQLArgumentError}, {@link NoSQLServiceError},
 * {@link NoSQLNetworkError}, {@link NoSQLAuthorizationError} and others.
 * 
 * @extends {Error}
 * @hideconstructor
 * @tutorial tables
 */
class NoSQLError extends Error {
    
    constructor(errCode, msg, cause, operation) {
        super(makeMsg(errCode, msg, cause));
        this._errCode = errCode;
        this.name = this.constructor.name;
        this._cause = cause;
        this._req = operation;
    }

    /**
     * {@link ErrorCode} of this error.
     * @type {ErrorCode}
     * @readonly
     */
    get errorCode() {
        return this._errCode;
    }

    /**
     * An error that caused this error.  In many cases it is also instance of
     * {@link NoSQLError} and may itself have a cause.  You could iterate
     * through the chain of causes like this:
     * <p>
     * <em>for(let cause = err.cause; cause; cause = cause.cause) {...</em>
     * <p>
     * If this error does not have a cause, the value of this property is
     * <em>undefined</em>.
     * @type {Error|undefined}
     * @readonly
     */
    get cause() {
        return this._cause;
    }

    /**
     * Indicates whether this error is retryable.
     * <p>
     * APIs that result in retryable errors are automatically retried by the
     * driver's default {@link RetryHandler}.  Default retry handler can be
     * customized by properties in {@link RetryConfig}.  Alternatively, a
     * custom {@link RetryHandler} can be set as
     * {@link RetryConfig}#handler.
     * <p>
     * If necessary, APIs that result in retryable errors may also be
     * explicitly retried by the application.
     * @see {@link RetryConfig}
     * @type {boolean}
     * @readonly
     */
    get retryable() {
        return this._errCode.retryable;
    }

    /**
     * Operation that resulted in this error.
     * {@link Operation} object contains the API and its arguments including
     * the options used.  Operation object may not always be available, in
     * which case the value of this property is <em>undefined</em>.
     * <p>
     * If this error happened during creation of new {@link NoSQLClient} then
     * instead of {@link Operation} this property contains {@link Config}
     * used to create {@link NoSQLClient} instance.
     * @see {@link Operation}
     * @see {@link Config}
     * @type {Operation|Config|undefined}
     * @readonly
     */
    get operation() {
        return this._req;
    }

    /**
     * @ignore
     */
    static create(errCode, msg, cause, operation) {
        switch(errCode) {
        case ErrorCode.ILLEGAL_ARGUMENT:
            return new NoSQLArgumentError(msg, operation, cause);
        case ErrorCode.BAD_PROTOCOL_MESSAGE:
            return new NoSQLProtocolError(msg, cause, operation);
        case ErrorCode.NETWORK_ERROR:
            return new NoSQLNetworkError(msg, operation, cause);
        case ErrorCode.SERVICE_ERROR:
            return new NoSQLServiceError(msg, operation, cause);
        default:
            return new NoSQLError(errCode, msg, cause, operation);
        }
    }
}

/**
 * This error indicates that invalid argument(s) were passed to the API which
 * may include options in the <em>opt</em> argument passed to
 * {@link NoSQLClient} methods.  You may examine the arguments and options
 * passed using [operation]{@link NoSQLError#operation} property.
 * <p>
 * This error may also result from invalid configuration provided to
 * {@link NoSQLClient} constructor when {@link NoSQLClient} is created in
 * which case the [operation]{@link NoSQLError#operation} property will
 * contain the configuration object.
 * <p>
 * Errors of this class have error code {@link ErrorCode.ILLEGAL_ARGUMENT}.
 * @see {@link ErrorCode.ILLEGAL_ARGUMENT}
 * @see {@link NoSQLError#operation}
 * @extends NoSQLError
 * @hideconstructor
 */
class NoSQLArgumentError extends NoSQLError {
    constructor(msg, operation, cause) {
        super(ErrorCode.ILLEGAL_ARGUMENT, msg, cause, operation);
        this._rejectedByDriver = true; //for testing
    }
}

/**
 * This error indicates communication problem between the client and the
 * server that resulted from invalid protocol message from either client or
 * server.  It can be caused version mismatch between client and server or
 * other reasons and is not retryable.
 * Errors of this class have error code
 * {@link ErrorCode.BAD_PROTOCOL_MESSAGE}.
 * @see {@link ErrorCode.BAD_PROTOCOL_MESSAGE}
 * @extends NoSQLError
 * @hideconstructor
 */
class NoSQLProtocolError extends NoSQLError {
    constructor(msg, cause, operation) {
        super(ErrorCode.BAD_PROTOCOL_MESSAGE,
            msg ? msg : 'Invalid protocol message',
            cause, operation);
    }
}

/**
 * Indicates network error when trying to communicate with the service.
 * Can be due to inability to connect (e.g. if the network or
 * the service is down).  Note that this is different from unsuccessful
 * response from the service, which is indicated by {@link NoSQLServiceError}.
 * Errors of this class have error code {@link ErrorCode.NETWORK_ERROR}.
 * @see {@link ErrorCode.NETWORK_ERROR}
 * @extends NoSQLError
 * @hideconstructor
 */
class NoSQLNetworkError extends NoSQLError {
    constructor(msg, operation, cause) {
        super(ErrorCode.NETWORK_ERROR,
            msg ? msg : 'Network error',
            cause,
            operation);
    }
}

/**
 * Indicates unsuccessful response from the service.  Even though the client
 * was able to communicate with the service, the service was not able to
 * process client request and thus returned unsuccessful response.
 * Additional information is provided in the error message.  Note that
 * this is different from inability to communicate with the service which is
 * indicated by {@link NoSQLNetworkError}.
 * Errors of this class have error code {@link ErrorCode.SERVICE_ERROR}
 * @see {@link ErrorCode.SERVICE_ERROR}
 * @extends NoSQLError
 * @hideconstructor
 */
class NoSQLServiceError extends NoSQLError {
    constructor(res, errOutput, operation) {
        super(ErrorCode.SERVICE_ERROR,
            `Unsuccessful HTTP response.  Status code: ${res.statusCode}. ` +
            `Status message: ${res.statusMessage}` +
            (errOutput ? `.  Error output: ${errOutput}` : ''),
            null, operation);
        this._statusCode = res.statusCode;
        this._statusMessage = res.statusMessage;
        this._errOutput = errOutput;
    }

    /**
     * HTTP status code.
     * @type {number}
     * @readonly
     * @ignore
     */
    get statusCode() {
        return this._statusCode;
    }

    /**
     * HTTP status message that describes the status code.
     * @type {string}
     * @readonly
     * @ignore
     */
    get statusMessage() {
        return this._statusMessage;
    }

    /**
     * Custom response message from the service.  If not present, the result
     * of this property is <em>undefined</em>.
     * @type {string|undefined}
     * @readonly
     * @ignore
     */
    get response() {
        return this._errOutput;
    }
}

/**
 * This error occurs if operation has exceeded the provided timeout interval.
 * It is possible that the operation has been retried a number of times before
 * this timeout occurred.  Whether the operation was retried depends on the
 * operation type, the errors caused by the operation and configured retry
 * handler(see {@link NoSQLError#retryable} for explanation).  For retryable
 * operations, the timeout is considered cumulative over all retries (not as
 * timeout of a single retry). If this error occurs when the service is
 * operating properly, you may want to adjust timeout values configured for
 * {@link NoSQLClient} or passed to the {@link NoSQLClient} methods in
 * <em>opt</em> argument.
 * <p>
 * Errors of this class have error code {@link ErrorCode.REQUEST_TIMEOUT}.
 * @see {@link Config}#timeout
 * @see {@link Config}#ddlTimeout
 * @see {@link ErrorCode.REQUEST_TIMEOUT}
 * @extends NoSQLError
 * @hideconstructor
 */
class NoSQLTimeoutError extends NoSQLError {
    
    static _timeoutMsg(timeout, numRetries) {
        let ret = `Operation timed out after ${timeout} ms`;
        if (numRetries) {
            ret += ` and ${numRetries} retries`;
        }
        return ret;
    }

    constructor(timeout, numRetries, operation, cause) {
        super(ErrorCode.REQUEST_TIMEOUT,
            NoSQLTimeoutError._timeoutMsg(timeout, numRetries), cause,
            operation);
    }
}

/**
 * This class covers all errors that occur while acquiring authorization to
 * perform an operation on NoSQL DB.  Because there could be several problems
 * acquiring authorization, the errors of this class may have one of several
 * error codes:
 * <ul>
 * <li>{@link ErrorCode.BAD_PROTOCOL_MESSAGE} indicates problem in
 * authorization protocol.</li>
 * <li>{@link ErrorCode.ILLEGAL_ARGUMENT} indicates problem with
 * authorization configuration provided as {@link AuthConfig} when
 * {@link NoSQLClient} instance is created.</li>
 * <li>{@link ErrorCode.REQUEST_TIMEOUT} indicates that timeout was exceeded
 * trying to obtain authorization information.</li>
 * <li>{@link ErrorCode.SERVICE_ERROR} indicates unsuccessful response
 * from authorization server.  This may be due to many factors, including
 * invalid user credentials (user name and password).  See error message for
 * more information</li>
 * <li>{@link ErrorCode.UNAUTHORIZED} may indicate insufficient permissions
 * while trying to obtain authorization information.
 * <li>{@link ErrorCode.CREDENTIALS_ERROR} indicates error accessing user or
 * application credentials.  The reason for this error depends on what
 * credential provider is used for the authorization.</li>
 * <li>{@link ErrorCode.NETWORK_ERROR} indicates error communicating with the
 * authorization server.  This error code is used for errors not due to any
 * cases above.
 * </ul>
 * <p>
 * Because the error could have different causes even for the same error code,
 * it is important to check the message of the error as well as its
 * {@link NoSQLError#cause}.  The message should contain HTTP status code and
 * authorization server response if they are present.
 * <p>
 * Note that this class is used only for errors that occur while
 * trying to obtain authorization string from authorization provider and not
 * errors that occur when making request to NoSQL DB with invalid
 * authorization string.  In the latter case, {@link NoSQLError} is returned
 * with error code {@link ErrorCode.INVALID_AUTHORIZATION}.
 * @extends NoSQLError
 * @hideconstructor
 */
class NoSQLAuthorizationError extends NoSQLError {
    constructor(errCode, msg, cause, operation) {
        super(errCode, 'Authorization error: ' + msg, cause, operation);
    }

    static badProto(msg, cause, operation) {
        return new NoSQLAuthorizationError(ErrorCode.BAD_PROTOCOL_MESSAGE,
            '[protocol error]: ' + msg, cause, operation);
    }

    static invalidArg(msg, cause, operation) {
        return new NoSQLAuthorizationError(ErrorCode.ILLEGAL_ARGUMENT,
            '[invalid arguments]: ' + msg, cause, operation);
    }

    static timeout(msg, cause, operation) {
        return new NoSQLAuthorizationError(ErrorCode.REQUEST_TIMEOUT,
            '[operation timeout]: ' + msg, cause, operation);
    }

    static unauthorized(msg, cause, operation) {
        return new NoSQLAuthorizationError(ErrorCode.UNAUTHORIZED,
            '[unauthorized]: ' + msg, cause, operation);
    }

    static service(msg, cause, operation) {
        return new NoSQLAuthorizationError(ErrorCode.SERVICE_ERROR,
            '[unsuccessful service response]: ' + msg, cause, operation);
    }

    static creds(msg, cause, operation) {
        return new NoSQLAuthorizationError(ErrorCode.CREDENTIALS_ERROR,
            '[credentials error]: ' + msg, cause, operation);
    }

    static network(msg, cause, operation) {
        return new NoSQLAuthorizationError(ErrorCode.NETWORK_ERROR,
            '[invalid state]: ' + msg, cause, operation);
    }
}

/**
 * This class covers errors that occur during client-side portion of query
 * execution, that is parts of the query plan executed by the driver.
 * Because different such problems may arise, the errors of this class may
 * have one of several error codes:
 * <ul>
 * <li>{@link ErrorCode.BAD_PROTOCOL_MESSAGE} indicates invalid protocol
 * message received by the client such as invalid part of a query plan or
 * invalid or inconsistent data for partition sorting.</li>
 * <li>{@link ErrorCode.ILLEGAL_ARGUMENT} indicates invalid or missing query
 * parameters or operands, such as missing value for bound variable,
 * non-numeric operand for arithmetic expression, non-numeric parameter for
 * OFFSET or LIMIT clause, etc.</li>
 * <li>{@link ErrorCode.ILLEGAL_STATE} indicates illegal state in the query
 * engine, which may be caused by a problem in the engine.  See the error
 * message for details.</li>
 * <li>{@link ErrorCode.MEMORY_LIMIT_EXCEEDED} indicates that local memory
 * consumed by the query execution exceeded the limit set by
 * <em>maxMemoryMB</em>.  See {@link ErrorCode.MEMORY_LIMIT_EXCEEDED}</li>
 * </ul>
 * <p>
 * Note that this class does not cover all errors that may occur during query
 * execution.  Besides error cases described above thrown by
 * {@link NoSQLQueryError}, other errors that are common to execution of all
 * APIs may also occur during execution of queries, such as network, service
 * or authorization-related errors and also errors due to invalid arguments
 * provided to the {@link NoSQLClient#query} API.  These may be thrown as
 * {@link NoSQLError}, {@link NoSQLServiceError}, {@link NoSQLArgumentError},
 * etc.
 * @see {@link NoSQLClient#query}
 * @extends NoSQLError
 * @hideconstructor
 */
class NoSQLQueryError extends NoSQLError {
    constructor(errCode, msg, cause, operation) {
        super(errCode, 'Query error: ' + msg, cause, operation);
    }

    static badProto(msg, operation, cause) {
        return new NoSQLQueryError(ErrorCode.BAD_PROTOCOL_MESSAGE,
            '[protocol error]: ' + msg, cause, operation);
    }

    static illegalArg(msg, operation, cause) {
        return new NoSQLQueryError(ErrorCode.ILLEGAL_ARGUMENT,
            '[invalid argument]: ' + msg, cause, operation);
    }

    static illegalState(msg, operation, cause) {
        return new NoSQLQueryError(ErrorCode.ILLEGAL_STATE,
            '[illegal state]: ' + msg, cause, operation);
    }

    static memory(msg, operation, cause) {
        return new NoSQLQueryError(ErrorCode.MEMORY_LIMIT_EXCEEDED,
            '[memory exceeded]: ' + msg, cause, operation);
    }

}

module.exports = {
    ErrorCode,
    NoSQLError,
    NoSQLArgumentError,
    NoSQLProtocolError,
    NoSQLNetworkError,
    NoSQLServiceError,
    NoSQLTimeoutError,
    NoSQLAuthorizationError,
    NoSQLQueryError
};
