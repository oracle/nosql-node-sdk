/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { ErrorCode } from "./error_code";
import type { Operation } from "./param";
import type { Config } from "./config";

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
 * addition, an error may have an optional {@link cause}, which is another
 * error that caused this error.  The {@link cause} is typically also
 * instance of {@link NoSQLError} or its subclass, but sometimes may not be.
 * E.g. if an authorization error is caused by invalid JSON response, the
 * {@link cause} would be instance of {@link !SyntaxError | SyntaxError}.
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
 * @see {@page tables.md}
 */
export class NoSQLError extends Error {
    /**
     * @hidden
     */
    protected constructor();

    /**
     * {@link ErrorCode} of this error.
     * @readonly
     */
    readonly errorCode: ErrorCode;

    /**
     * An error that caused this error.  In many cases it is also instance of
     * {@link NoSQLError} and may itself have a cause.  You could iterate
     * through the chain of causes like this:
     * <p>
     * <em>for(let cause = err.cause; cause; cause = cause.cause) \{...</em>
     * <p>
     * If this error does not have a cause, the value of this property is
     * <em>undefined</em>.
     * @readonly
     */
    readonly cause?: Error;

    /**
     * Indicates whether this error is retryable.
     * <p>
     * APIs that result in retryable errors are automatically retried by the
     * driver's default {@link RetryHandler}.  Default retry handler can be
     * customized by properties in {@link RetryConfig}.  Alternatively, a
     * custom {@link RetryHandler} can be set as {@link RetryConfig#handler}.
     * <p>
     * If necessary, APIs that result in retryable errors may also be
     * explicitly retried by the application.
     * @see {@link RetryConfig}
     * @readonly
     */
    readonly retryable?: boolean;

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
     * @readonly
     */
    readonly operation?: Operation|Config;
}

/**
 * This error indicates that invalid argument(s) were passed to the API which
 * may include options in the <em>opt</em> argument passed to
 * {@link NoSQLClient} methods.  You may examine the arguments and options
 * passed using {@link operation} property.
 * <p>
 * This error may also result from invalid configuration provided to
 * {@link NoSQLClient} constructor when {@link NoSQLClient} is created in
 * which case the {@link operation} property will contain the configuration\
 * object.
 * <p>
 * Errors of this class have error code {@link ErrorCode.ILLEGAL_ARGUMENT}.
 * @see {@link ErrorCode.ILLEGAL_ARGUMENT}
 * @see {@link NoSQLError#operation}
 */
export class NoSQLArgumentError extends NoSQLError {}

/**
 * This error indicates communication problem between the client and the
 * server that resulted from invalid protocol message from either client or
 * server.  It can be caused version mismatch between client and server or
 * other reasons and is not retryable.
 * Errors of this class have error code
 * {@link ErrorCode.BAD_PROTOCOL_MESSAGE}.
 * @see {@link ErrorCode.BAD_PROTOCOL_MESSAGE}
 */
export class NoSQLProtocolError extends NoSQLError {}

/**
 * This error indicates that the server is running at a lower protocol
 * version than the client (i.e. the client is using a newer protocol
 * version than the server supports). The client should attempt to
 * decrement its internal protocol version and try again.
 * Errors of this class have error code
 * {@link ErrorCode.UNSUPPORTED_PROTOCOL}.
 * @see {@link ErrorCode.UNSUPPORTED_PROTOCOL}
 * @extends NoSQLError
 */
export class NoSQLUnsupportedProtocolError extends NoSQLError {}

/**
 * Indicates network error when trying to communicate with the service.
 * Can be due to inability to connect (e.g. if the network or
 * the service is down).  Note that this is different from unsuccessful
 * response from the service, which is indicated by {@link NoSQLServiceError}.
 * Errors of this class have error code {@link ErrorCode.NETWORK_ERROR}.
 * @see {@link ErrorCode.NETWORK_ERROR}
 */
export class NoSQLNetworkError extends NoSQLError {}

/**
 * Indicates unsuccessful response from the service.  Even though the client
 * was able to communicate with the service, the service was not able to
 * process client request and thus returned unsuccessful response.
 * Additional information is provided in the error message.  Note that
 * this is different from inability to communicate with the service which is
 * indicated by {@link NoSQLNetworkError}.
 * Errors of this class have error code {@link ErrorCode.SERVICE_ERROR}
 * @see {@link ErrorCode.SERVICE_ERROR}
 */
export class NoSQLServiceError extends NoSQLError {}

/**
 * This error occurs if operation has exceeded the provided timeout interval.
 * It is possible that the operation has been retried a number of times before
 * this timeout occurred.  Whether the operation was retried depends on the
 * operation type, the errors caused by the operation and configured retry
 * handler(see {@link retryable} for explanation).  For retryable
 * operations, the timeout is considered cumulative over all retries (not as
 * timeout of a single retry). If this error occurs when the service is
 * operating properly, you may want to adjust timeout values configured for
 * {@link NoSQLClient} or passed to the {@link NoSQLClient} methods in
 * <em>opt</em> argument.
 * <p>
 * Errors of this class have error code {@link ErrorCode.REQUEST_TIMEOUT}.
 * @see {@link Config#timeout}
 * @see {@link Config#ddlTimeout}
 * @see {@link ErrorCode.REQUEST_TIMEOUT}
 */
export class NoSQLTimeoutError extends NoSQLError {}

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
 * {@link cause}.  The message should contain HTTP status code and
 * authorization server response if they are present.
 * <p>
 * Note that this class is used only for errors that occur while
 * trying to obtain authorization string from authorization provider and not
 * errors that occur when making request to NoSQL DB with invalid
 * authorization string.  In the latter case, {@link NoSQLError} is returned
 * with error code {@link ErrorCode.INVALID_AUTHORIZATION}.
 */
export class NoSQLAuthorizationError extends NoSQLError {}

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
 */
export class NoSQLQueryError extends NoSQLError {}
