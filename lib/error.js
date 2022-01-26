/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const ErrorCode = require('./error_code');
const HttpConstants = require('./constants').HttpConstants;

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

    /**
     * @ignore
     */
    get retryable() {
        return this._statusCode === HttpConstants.HTTP_SERVER_ERROR ||
            this._statusCode === HttpConstants.HTTP_UNAVAILABLE;
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
 * <li>{@link ErrorCode.ILLEGAL_STATE} indicates that authorization operation
 * encountered unexpected state, such as missing or invalid information
 * received from authorization server.  See the error message for details.
 * </li>
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

    static illegalState(msg, cause, operation) {
        return new NoSQLAuthorizationError(ErrorCode.ILLEGAL_STATE,
            '[illegal state]: ' + msg, cause, operation);
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
