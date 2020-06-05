/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/**
 * Defines types used for NoSQL driver configuration.
 */

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
  *
  * @tutorial connect-cloud
  * @tutorial connect-on-prem
  * @tutorial tables
  *
  * @example //Config object stored as JSON in a file ~/myapp/ndcs_config.json
  * //(1s are used for sensitive info)
  * {
  *     "serviceType": "CLOUD"
  *     "endpoint": "nosql.us-phoenix-1.oci.oraclecloud.com",
  *     "timeout": 20000,
  *     "auth":
  *     {
  *         "iam":
  *         {
  *             "configFile": "~/myapp/.oci/config",
  *             "profileName": "John"
  *         }
  *     }
  * }
  *
  * //In application code:
  * const client = new NoSQLClient('~/myapp/ndcs_config.json');
  *
  * @example //Same config directly passed as JavaScript object to
  * //{@link NoSQLClient#constructor}
  * const client = new NoSQLClient({
  *     serviceType: ServiceType.CLOUD,
  *     endpoint: 'nosql.us-phoenix-1.oci.oraclecloud.com',
  *     timeout: 20000,
  *     auth: {
  *         iam: {
  *             configFile: '~/myapp/.oci/config',
  *             profileName: 'John'
  *         }
  *     }
  * });
  *
  * @example //Overriding properties in Config for given API call:
  *
  * //Will use timeout of 8000 instead of 20000 specified at client's creation
  * client.getTableInfo('Table1', { timeout: 8000 }, (err, res) => {
  *     //.....
  * });
  *
  * @global
  * @typedef {object} Config
  * @property {(ServiceType|string)} [serviceType] Type of service the driver
  * will be using.  May be specified as either {@link ServiceType} enumeration
  * or string.  Currently supported values are CLOUD, CLOUDSIM and KVSTORE.
  * Although this property is optional, it is recommended to specify it to
  * avoid ambiguity.  If not specified, in most cases the driver will deduce
  * the service type from other information in {@link Config}.  See
  * {@link ServiceType} for details
  * @property {(string|URL)} [endpoint] Endpoint to use to connect to
  * the service.  See the online documentation for the complete set of
  * available regions.  For example,
  * <em>ndcs.uscom-east-1.oraclecloud.com</em> or <em>localhost:8080</em>.
  * Endpoint specifies the host to connect to but may optionally specify port
  * and/or protocol.  Protocol is usually not needed and is inferred from the
  * host and port information: if no port is specified, port 443 and
  * protocol HTTPS are assumed, if port 443 is specified, HTTPS is assumed,
  * if port is specified and it is not 443, HTTP is assumed.  If protocol is
  * specified, it must be either HTTP or HTTPS.  For example,
  * <em>https://nosql.us-phoenix-1.oci.oraclecloud.com</em> or
  * <em>http://localhost:8080</em>.  In this case, in addition to string, the
  * endpoint may also be specified as Node.js URL instance.  If protocol is
  * specified but not port, 443 is assumed for HTTPS and 8080 for HTTP (which
  * is the default port for CloudSim).  You may specify <em>endpoint</em> or
  * <em>region</em> but not both.
  * @property {Region|string} [region] Cloud service only. Specify a region
  * to use to connect to the Oracle NoSQL Database Cloud Service.
  * This property may be specified instead of {@link Config}#endoint.
  * The service endpoint will be inferred from the region.  May be
  * specified either as {@link Region} enumeration constant, e.g.
  * {@link Region.AP_MUMBAI_1} or as a string (so it can be specified in
  * config file), which must be either one of {@link Region} enumeration
  * constant names, e.g. <em>AP_MUMBAI_1</em>, <em>US_ASHBURN_1</em>, etc or
  * one of region identifiers, e.g. <em>ap-mumbai-1</em>,
  * <em>us-ashburn-1</em>, etc.  You must specify either {@link Config}#region
  * or {@link Config}#endpoint but not both.  The only exception to this is if
  * you set the region identifier in an OCI configuration file together with
  * your credentials, in which case you need not specify either
  * {@link Config}#region or {@link Config}#endpoint.  This implies that you
  * store your credentials and region identifier in the OCI configuration file
  * and provide configuration in {@link IAMConfig} to access this file or use
  * the defaults.  See {@link IAMConfig} for more information.  Note that
  * setting {@link Config}#region or {@link Config}#endpoint takes precedence
  * over region identifier in an OCI configuration file
  * @property {number} [timeout=5000] Timeout in for non-DDL operations in
  * milliseconds.  Note that for operations that are automatically retried,
  * the timeout is cumulative over all retries and not just a timeout for
  * a single retry.  This means that all retries and waiting periods between
  * retries are counted towards the timeout
  * @property {number} [ddlTimeout=10000] Timeout for DDL operations, that is
  * operations executed by {@link NoSQLClient#tableDDL},
  * {@link NoSQLClient#setTableLimits} or {@link NoSQLClient#adminDDL}
  * methods, in milliseconds.  Used as a default <em>opt.timeout</em> for
  * these methods.  Note that if <em>opt.complete</em> is true for any of
  * these methods, a corresponding poll timeout
  * ({@link Config}#tablePollTimeout or {@link Config}#adminPollTimeout) will
  * be added to the default <em>opt.timeout</em> for these operations
  * @property {number} [securityInfoTimeout=10000] Timeout for all operations
  * while waiting for security information to be available in the system, in
  * milliseconds.  It is different from regular operation timeout and is used
  * while automatically retrying operations that failed with error code
  * {@link ErrorCode.SECURITY_INFO_UNAVAILABLE})
  * @property {number} [tablePollTimeout=60000] Timeout when polling for table
  * state using {@link NoSQLClient#forCompletion} while waiting for completion
  * of {@link NoSQLClient#tableDDL} operation, in milliseconds.  Can be
  * overriden by <em>opt.timeout</em> for these methods
  * @property {number} [tablePollDelay=1000] Delay between successive poll
  * attempts when polling for table state using
  * {@link NoSQLClient#forCompletion} while waiting for completion
  * of {@link NoSQLClient#tableDDL} operation, in milliseconds.  Can be
  * overriden by <em>opt.delay</em> for these methods
  * @property {number} [adminPollTimeout=30000] Timeout when waiting for
  * completion of {@link NoSQLClient#adminDDL} operation, as used by
  * {@link NoSQLClient#forCompletion}, in milliseconds.  Can be overriden by
  * <em>opt.timeout</em> for these methods
  * @property {number} [adminPollDelay=1000] Delay between successive poll
  * attempts when waiting for completion of {@link NoSQLClient#adminDDL}
  * operation, as used by {@link NoSQLClient#forCompletion}, in milliseconds.
  * Can be overriden by <em>opt.delay</em> for these methods
  * @property {Consistency} [consistency=Consistency.EVENTUAL]
  * Consistency used for read operations
  * @property {number} [maxMemoryMB=1024] Maximum amount of memory in
  * megabytes that may be used by the driver-side portion of execution of
  * queries for operations such as duplicate elimination (which may be
  * required if using an index on an array or a map) and sorting. Such
  * operations may require significant amount of memory as they need to cache
  * full result set or a large subset of it locally. If memory consumption
  * exceeds this value, error will result.  The default is 1 GB
  * @property {string} [compartment] Cloud service only.  Compartment id (OCID)
  * or compartment name to use for operations with this {@link NoSQLClient}
  * instance. If the name is used it can be either the name of a top-level
  * compartment or a path to a nested compartment, e.g.
  * <em>compartmentA.compartmentB.compartmentC</em>.  The path should not
  * include the root compartment name (tenant).  If this property is not
  * specified either here or for an individual operation the
  * tenant OCID is used as the compartment id for the operation, which is the
  * id of the root compartment for the tenancy.  See
  * [Setting Up Your Tenancy]{@link https://docs.cloud.oracle.com/iaas/Content/GSG/Concepts/settinguptenancy.htm}
  * for more information
  * @property {RetryConfig|null} [retry] Configuration for operation retries
  * as specified by {@link RetryConfig} object.  If not specified, default
  * retry configuration is used, see {@link RetryConfig}.  May be set to null
  * to disable operation retries alltogether
  * @property {object} [httpOpt] Http or https options object for the driver
  * in the same format as passed to constructor of Node.js
  * <em>HTTP.Agent</em> or <em>HTTPS.Agent</em>.  If not specified, default
  * global<em>HTTP.Agent</em> or <em>HTTPS.Agent</em> will be used instead
  * @property {AuthConfig} [auth] Authorization configuration, see
  * {@link AuthConfig}
  * @property {DBNumberConfig} [dbNumber] Configuration to use 3rd party
  * number/decimal library for values of datatype <em>Number</em>.  If not
  * specified, the driver will use Javascript <em>number</em> type to
  * represent values of type Number.  See {@link DBNumberConfig}
  */

/**
 * Configuration for operation retries, which is set as {@link Config}#retry.
 * <p>
 * When an operation fails with {@link NoSQLError} or its subclass, the driver
 * has an option to retry the operation automatically, transparently to the
 * application.  The operation may be retried multiple times until the
 * operation timeout is reached.  The driver may only retry the operations
 * that failed with retryable {@link ErrorCode} (see
 * {@link NoSQLError#errorCode}).  Whether the operation is retried and how
 * depends on the what {@link RetryHandler} is used.  Retry handler is an
 * object that provides two properties/methods: {@link RetryHandler}#doRetry
 * that determines whether the operation should be retried at given time and
 * {@link RetryHandler}#delay that determines how long to wait between
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
 * configured by {@link RetryConfig}#maxRetries property.</li>
 * </ul>
 * For retry delay, an exponential backoff algorithm is used.  The delay
 * starts with {@link RetryConfig}#baseDelay and then doubles on successive
 * retries.  In addition a random value between 0 and
 * {@link RetryConfig}#baseDelay is added to this result.
 * <p>
 * Exceptions to this are:
 * <ul>
 * <li>If DDL operation resulted in {@link ErrorCode.OPERATION_LIMIT_EXCEEDED}
 * because of more stringent system limits for control operations, a much
 * larger delay is needed to retry the operation.  In this case the
 * exponential backoff algorithm will start with a large delay of
 * {@link RetryConfig}#controlOpBaseDelay.  You may customize this value
 * depending on what limits the system has for DDL operations.  You may
 * disable automatic retries for this error by setting
 * {@link RetryConfig}#controlOpBaseDelay to null.</li>
 * <li>Network errors (see {@link ErrorCode.NETWORK_ERROR}) and errors caused
 * by unavailability of security information (see
 * {@link ErrorCode.SECURITY_INFO_UNAVAILABLE}) are always retried regardless
 * of the number of retries reached without regard to
 * {@link RetryConfig}#maxRetries.  As for other errors, the retries are
 * stopped when operation timeout is reached that results in
 * {@link NoSQLTimeoutError}.</li>
 * <li>When the retry is caused by unavailability of security information as
 * determined by {@link ErrorCode.SECURITY_INFO_UNAVAILABLE} the algorithm
 * starts with constant delay of {@link RetryConfig}#secInfoBaseDelay for a
 * maximum number of retries {@link RetryConfig}#secInfoNumBackoff and then
 * switches to exponential backoff algorithm described above also starting
 * with {@link RetryConfig}#secInfoBaseDelay.  You can set
 * {@link RetryConfig}#secInfoNumBackoff to 0 to start exponential backoff
 * algorithm immediately.</li>
 * </ul>
 * <p>
 * You may customize the default retry handler by overriding the values of any
 * properties mentioned above.
 *
 * @see {@link RetryHandler}
 * @example //Customizing default retry handler
 * let config = {
 *     endpoint: '.....',
 *     .....
 *     retry: {
 *         numRetries: 3,
 *         baseDelay: 3000,
 *         //Default values to be used for security info errors
 *     }
 * };
 *
 * @example //Disable retries alltogether, application will retry manually
 * let config = {
 *     endpoint: '.....',
 *     .....
 *     retry: null
 * };
 *
 * @global
 * @typedef {object} RetryConfig
 * @property {RetryHandler|null} [handler] Retry handler used.  Set this
 * property if you want to use custom retry handler.  You may set this to
 * null to disable retries alltogether
 * @property {number} [maxRetries=10] Maximum number of retries, including
 * initial API invocation, for default retry handler
 * @property {number} [baseDelay=1000] Base delay between retries for
 * exponential backoff algorithm in default retry handler, in milliseconds
 * @property {number} [controlOpBaseDelay=60000] Base retry delay for
 * {@link ErrorCode.OPERATION_LIMIT_EXCEEDED} used by default retry handler
 * exponential backoff algorithm.  Note that automatic retries for this error
 * only take effect if the timeout used for the operation that caused the
 * error (see {@link Config}#timeout and {@link Config}#ddlTimeout) is greater
 * than the value of <em>controlOpBaseDelay</em>.  Otherwise the operation
 * won't be retried and {@link ErrorCode.OPERATION_LIMIT_EXCEEDED} will be
 * returned to the application.  You may also set this property to null
 * to disable automatic retries for this error (if it is prefferred that
 * application does manual retries for this error)
 * @property {number} [secInfoBaseDelay=1000] Base delay when waiting for
 * availability of security information as in error code
 * {@link ErrorCode.SECURITY_INFO_UNAVAILABLE} for default retry handler, in
 * milliseconds
 * @property {number} [secInfoNumBackoff=10] Maximum number of retries with
 * constant delay when waiting for availability of security information, as in
 * error code {@link ErrorCode.SECURITY_INFO_UNAVAILABLE}
 * for default retry handler
 */

/**
 * Retry handler set as {@link RetryConfig}#handler.  Use this to set custom
 * retry handler.  This type should provide two properties which can
 * be functions or constants (see below): {@link RetryHandler}#doRetry and
 * {@link RetryHandler}#delay.  It may be a plain object or an instance of a
 * class.
 *
 * @example //Using custom retry handler
 * let config = {
 *     endpoint: '.....',
 *     .....
 *     retry: {
 *         handler: {
 *             doRetry: (op, numRetries, err) => {
 *                 //for the sake of example
 *                 return numRetries < 5;
 *             }
 *             delay: (op, numRetries) => {
 *                 //for the sake of example
 *                 return (numRetries + 1) * 1000;
 *             }
 *         }
 *     }
 * };
 *
 * @global
 * @typedef {object} RetryHandler
 * @property {boolean|doRetry} doRetry Determines whether an
 * operation should be retried.  Can be either boolean, which applies to all
 * operations, or a function that determines whether given operation should be
 * retried based on operation, number of retries so far and the error
 * occured.  See {@link doRetry}
 * @property {number|delay} delay Determines delay between
 * successive retries in milliseconds.  Can be either number, which indicates
 * constant delay in milliseconds, or a function that determines delay based
 * on operation, number of retries so far and the error occurred. See
 * {@link delay}
 */

/**
 * Function definition for {@link RetryHandler}#doRetry.
 * @global
 * @callback doRetry
 * @param {Operation} operation Operation object describing the failed
 * operation
 * @param {number} numRetries How many retries happened so far for this
 * operation.  This includes the original API invokation, so numRetries
 * will be 1 after the first error
 * @param {NoSQLError} err Error that occurred as {@link NoSQLError} or its
 * subclass
 * @return {boolean} true if the operation should be retried.  If false,
 * no more retries will be done for this operation
 */

/**
 * Function definition for {@link RetryHandler}#delay.  This function
 * will be called only if {@link RetryHandler}#doRetry returned
 * <em>true</em>.
 * @global
 * @callback delay
 * @param {Operation} operation Operation object describing the failed
 * operation
 * @param {number} numRetries How many retries happened so far for this
 * operation.  This includes original API invokation, so numRetries
 * will be 1 after the first error
 * @param {NoSQLError} err Error that occurred as {@link NoSQLError} or its
 * subclass
 * @return {number} Number of milliseconds to before the next retry of this
 * operation
 */
