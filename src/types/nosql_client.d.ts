/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { EventEmitter } from "events";
import type { Config } from "./config";
import type { TableDDLOpt, ModifyTableOpt, CompletionOpt, GetTableOpt,
    TableUsageOpt, GetIndexOpt, GetIndexesOpt, ListTablesOpt, GetOpt, PutOpt,
    PutIfOpt, DeleteOpt, DeleteIfOpt, MultiDeleteOpt, WriteMultipleOpt,
    PutManyOpt, DeleteManyOpt, PrepareOpt, QueryOpt, AdminDDLOpt,
    AdminStatusOpt, AdminListOpt, AddReplicaOpt, ReplicaStatsOpt }
    from "./opt";
import type { TableLimits, TableETag, DefinedTags, FreeFormTags,
    WriteOperation, RowVersion, Operation } from "./param";
import type { TableResult, TableUsageResult, IndexInfo, ListTablesResult,
    GetResult, PutResult, DeleteResult, MultiDeleteResult,
    WriteMultipleResult, QueryResult, AdminResult, UserInfo,
    ReplicaStats, ReplicaStatsResult } from "./result";
import type { ServiceType, TableState, AdminState } from "./constants";
import type { RowKey, AnyRow, AnyKey } from "./data";
import type { PreparedStatement } from "./stmt";
import type { AuthorizationProvider } from "./auth/config";
import type { IAMConfig } from "./auth/iam/types";
import type { KVStoreAuthConfig } from "./auth/kvstore/types";
import type { NoSQLError } from "./error";
import type { NoSQLClientEvents } from "./events";
import type { Region } from "./region";

/**
 * Defines NoSQLClient, which is the point of access to the
 * Oracle NoSQL Database Cloud service.
 */

/**
 * NoSQLClient class provides access to Oracle NoSQL Database
 * tables.  Methods of this class are used to create and manage tables and
 * indexes, and to read and write data. All operations are performed
 * asynchronously.
 * <p>
 * Each method returns a Promise object that will resolve to the
 * result of the operation if successful, or reject with an error upon
 * failure. To handle results and errors, you may use promise chains
 * with .then.catch or async functions with await.  The result of
 * operation is a JavaScript object with properties specific to each
 * operation and is documented for each method below.  If any error
 * has occurred, the promise will reject with {@link NoSQLError} or
 * one of its subclasses.
 * <p>
 * You instantiate NoSQLClient by providing connection and credential
 * information, either in the form of a configuration object of type
 * {@link Config} or a path to a file that holds {@link Config} information.
 * Some parameters, such as the service endpoint or region, are required.
 * Other parameters are optional and need not be specified in the
 * {@link Config}. Default values are used for optional parameters.
 * <p>
 * Note that it is possible to create {@link NoSQLClient} instance without
 * providing configuration if all of the following are true:
 * <ul>
 * <li>You are using {@link NoSQLClient} with the Cloud Service.</li>
 * <li>You store your credentials and region identifier in an OCI configuration
 * file with the default file path and default profile name.  See
 * {@link IAMConfig} for more information.</li>
 * <li>You use defaults for all other configuration properties.</li>
 * </ul>
 * <p>
 * Each method of NoSQLClient also takes an optional <em>opt</em>
 * parameter which contains options specific to a particular
 * operation.  Some of these options may be the same as those
 * specified by {@link Config} and will override the {@link Config}
 * values for this operation.  The method description describes which
 * options are pertinent for that operation. If an options is not
 * specified in the <em>opt</em> parameter and is also not present in
 * {@link Config}, the driver will use default values.
 * <p>
 * In general, same methods and options are applicable to both Oracle
 * NoSQL Database Cloud Service and On-Premise Oracle NoSQL Database.
 * However, some methods, options and result types may be specific to
 * particular {@link ServiceType}, which is specified in their documentation.
 * <p>
 * <em>For cloud service only:</em> for each method you may provide
 * <em>opt.compartment</em> which specifies the compartment of the given table
 * (or compartment used to perform given operation).  If not set in options or
 * initial config (see {@link Config#compartment}), the root
 * compartment of the tenancy is assumed. The compartment is a string that
 * may be either the id (OCID) of the compartment or a compartment name. Both
 * are acceptable. If a name is used it can be either the name of a top-level
 * compartment, or for nested compartments, it should be a compartment path
 * to the nested compartment that does not include the root compartment name
 * (tenant), e.g. <em>compartmentA.compartmentB.compartmentC</em>
 * <p>
 * Alternatively, instead of setting <em>opt.compartment</em>
 * you may prefix the table name with its compartment name (for top-level
 * compartments) or compartment path (for nested compartments), e.g.
 * <em>compartmentA.compartmentB.compartmentC:myTable</em>.
 * Note that the table name cannot be
 * prefixed with compartment id.  Prefixing the table with compartment
 * name/path takes precendence over other methods of specifying the
 * compartment.
 * <p>
 * For events emitted by {@link NoSQLClient}, see {@link NoSQLClientEvents}.
 *
 * @see {@page connect-cloud.md}
 * @see {@page connect-on-prem.md}
 * @see {@page tables.md}
 *
 * @example
 * Using {@link NoSQLClient} with async-await.
 * ```ts
 * const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
 *
 * async function test() {
 *      let client;
 *      try {
 *          client = new NoSQLClient('config.json');
 *          let res = await client.tableDDL(
 *              'CREATE TABLE foo(id INTEGER, name STRING, PRIMARY KEY(id))',
 *              {
 *                  tableLimits: {
 *                      readUnits: 100,
 *                      writeUnits: 100,
 *                      storageGB: 50
 *                  }
 *              }
 *          );
 *          console.log('Table: %s, state: %s', res.tableName,
 *              res.tableState);
 *          await client.forCompletion(res);
 *          res = await client.put('foo', { id: 1, name: 'test' });
 *          res = await client.get('foo', { id: 1 });
 *          console.log(res.row);
 *          //..........
 *      } catch(err) {
 *          //handle errors
 *      } finally {
 *          if (client) {
 *              client.close();
 *          }
 *      }
 * }
 * ```
 */
export class NoSQLClient extends EventEmitter {

    /**
     * Constructs an instance of NoSQLClient. This function is synchronous.
     * @param {string|Config|null} [config] Configuration for NoSQL client.
     * May be either a string indicating the file path to a configuration
     * file, or a {@link Config} object. If a file path is supplied,
     * the path can be absolute or relative to the current directory
     * of the application. The file should contain the {@link Config} object
     * and can be either JSON or JavaScript (in the latter case its
     * <em>module.exports</em> should be set to the {@link Config} object).
     * Note that you may pass <em>null</em> or omit this parameter (use
     * no-argument constructor) if using the cloud service with the default OCI
     * configuration file that contains credentials and region identifier, as
     * described above
     * @throws {NoSQLArgumentError} if the configuration is
     * missing required properties or contains invalid property values
     * @see {@link Config}
     */
    constructor(config?: string | Config | null);

    /**
     * The version of the driver.
     */
    static readonly version: string;

    /**
     * Returns the service type used by this {@link NoSQLClient} instance.
     * @returns {ServiceType} Service type
     */
    readonly serviceType: ServiceType;

    /**
     * Releases resources associated with NoSQLClient.  This method must be
     * called after NoSQLClient is no longer needed.
     * @returns {Promise} Promise, which may be resolved if closing
     * the client did not require asynchronous operations.  The resolved
     * value is ignored.  Currently, the close may need to perform
     * asynchronous operation only when using {@link ServiceType.KVSTORE},
     * otherwise resolved Promise is returned.  The Promise should not reject
     * (rather log the error if any), so you only need to <em>await</em> for
     * it if you need to perform an action upon its completion.
     * @see {@link ServiceType}
     */
    close(): Promise<void>;

    /**
     * Obtains and caches authorization information in advance of performing
     * database operations.
     * <p>
     * Built-in authorization providers use with this SDK obtain authorization
     * information such as authorization signature or token and cache it for
     * some time.  In some instances, obtaining this information make take
     * some time, especially in cases when a network request to authorization
     * server is required, e.g. when using Cloud Service with Instance
     * Principal (see {@link IAMConfig}).  By default, this information is
     * obtained on demand when database operation is issued and this may cause
     * timeout errors if the default timeout for database operations is not
     * sufficient to obtain this information.  You may call this method to
     * obtain and pre-cache authorization information, so that when database
     * operations are issued, they do not need to spend any extra time on
     * obtaining authorization.
     * <p> A current use case for this method is when using Cloud Service
     * with Instance Principal, because a network request is required to
     * obtain authorization token (as well additional requests to obtain
     * instance region, instance certificates, instance private key, etc).
     * An alternative solution is to increase operation timeouts to allot
     * enough time to obtain authorzation token when required.  However,
     * calling {@link NoSQLClient#precacheAuth} will provide better
     * performance when starting multiple concurrent database operations.
     * <p>
     * Call this method after creating {@link NoSQLClient} instance before
     * performing database operations.  Note that after the authorization
     * expires, it will need to be obtained again which make take some time in
     * some cases as described above.  However, build-in authoirzation
     * providers used with this SDK are configured to refresh the
     * authorization in background ahead of its expiration so that database
     * operations may use existing authorization while the new one is obtained
     * in the background.
     * <p>
     * Calling this method is equivalient to calling
     * {@link AuthorizationProvider#getAuthorization} method of authorization
     * provider which will pre-cache the authorzation in the process, so if
     * using custom {@link AuthorizationProvider} that does not cache
     * authorzation, this method will have no effect.
     * <p>
     * This method does not take explicit timeout, but uses timeouts specified
     * for authorization network requests for given built-in authorization
     * provider.  See properties {@link IAMConfig#timeout} and
     * {@link KVStoreAuthConfig#timeout}.
     * @example
     * Using precacheAuth on new NoSQLClient instance.
     * ```ts
     * let client;
     * try {
     *     client = await new NoSQLClient(config).precacheAuth();
     *     .....
     * } finally {
     *     client?.close();
     * }
     * ```
     * @async
     * @returns {Promise} Promise of {@link NoSQLClient} of this instance
     * @see {@link IAMConfig}
     * @see {@link KVStoreAuthConfig}
     * @see {@link AuthorizationProvider}
     */
    precacheAuth(): Promise<NoSQLClient>;

    /**
     * Executes a DDL operation on a table. The operations allowed are
     * defined by the Data Definition Language (DDL) portion of the
     * query language related to tables such as table creation and
     * drop, index add and drop, and the ability to alter table schema
     * and table limits.
     * <p>
     * Operations using table DDL statements infer the table name from the
     * statement itself, e.g. "CREATE TABLE mytable(...)". Table
     * creation requires a valid {@link TableLimits} object to define
     * the throughput and storage desired for the table. It is an
     * error for TableLimits to be specified with a statement other
     * than create or alter table.
     * <p>
     * Note that these are potentially long-running operations, so the
     * result returned by this API does not imply operation completion
     * and the table may be in an intermediate state. (see {@link
     * TableState}).  The caller should use the {@link NoSQLClient#getTable}
     * method to check the status of the operation or
     * {@link NoSQLClient#forCompletion} to asynchronously wait for the
     * operation completion.
     * <p>
     * Alternatively, if {@link TableDDLOpt#complete} is set to true, this API
     * will complete (i.e. the returned <em>Promise</em> will resolve) only
     * when the operation is completed and the table reaches state
     * {@link TableState.ACTIVE} or {@link TableState.DROPPED} (if the
     * operation was "DROP TABLE").  This is equivalent to sequentially
     * executing {@link NoSQLClient#tableDDL} and
     * {@link NoSQLClient#forCompletion}.  In this case,
     * {@link TableDDLOpt#timeout} covers the whole time interval until
     * operation completion.
     * If not specified, separate default timeouts are used for issuing the
     * DDL operation and waiting for its completion, with values of
     * {@link Config#ddlTimeout} and {@link Config#tablePollTimeout}
     * correspondingly (the latter defaults to no timeout if
     * {@link Config#tablePollTimeout} is not set).  You may also use
     * {@link TableDDLOpt#delay} to specify polling delay (see
     * {@link NoSQLClient#forCompletion}).
     * @async
     * @param {string} stmt SQL statement
     * @param {TableDDLOpt} [opt] Options object, see {@link TableDDLOpt}
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link TableResult}
     * @see {@link forCompletion}
     */
    tableDDL(stmt: string, opt?: TableDDLOpt): Promise<TableResult>;

    /**
     * Cloud service only.
     * This method is only supported when using the driver with the Cloud
     * Service or Cloud Simulator.  When using the driver with
     * On-Premise NoSQL Database (see {@link ServiceType.KVSTORE}), this
     * method is a no-op.
     * <p>
     * Sets new limits of throughput and storage for existing table.
     * <p>
     * Same considerations as described in {@link NoSQLClient#tableDDL} about
     * long-running operations, using {@link NoSQLClient#forCompletion} and
     * options {@link ModifyTableOpt#complete} and
     * {@link ModifyTableOpt#delay} apply to this API.
     * See {@link NoSQLClient#tableDDL}.
     * @async
     * @param {string} tableName Table name
     * @param {TableLimits} tableLimits New table limits for the table
     * @param {ModifyTableOpt} [opt] Options object, see
     * {@link ModifyTableOpt}
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link TableResult}
     * @see {@link NoSQLClient#tableDDL}
     */
    setTableLimits(tableName: string, tableLimits: TableLimits,
        opt?: ModifyTableOpt): Promise<TableResult>;

    /**
     * Cloud service only.
     * Note: this method is only supported when using the driver with the
     * Cloud Service or Cloud Simulator.  When using the driver with
     * On-Premise NoSQL Database (see {@link ServiceType.KVSTORE}), this
     * method is a no-op.
     * <p>
     * Sets defined and free-form tags on existing table.
     * <p> See {@link DefinedTags} and {@link FreeFormTags} for more
     * information on tagging.
     * <p>
     * Same considerations as described in {@link NoSQLClient#tableDDL} about
     * long-running operations, using {@link NoSQLClient#forCompletion} and
     * options {@link ModifyTableOpt#complete} and
     * {@link ModifyTableOpt#delay} apply to this API.
     * See {@link NoSQLClient#tableDDL}.
     * @async
     * @param {string} tableName Table name
     * @param {DefinedTags} definedTags Cloud Service only. Defined tags
     * to use for the operation. See {@link DefinedTags}.  Pass
     * <em>undefined</em> if you wish to set only free-form tags
     * @param {FreeFormTags} [freeFormTags] Cloud Service only. Free-form
     * tags to use for the operation.  See {@link FreeFormTags}. Pass
     * <em>undefined</em> (or omit if not using <em>opt</em> parameter) if you
     * wish to set only defined tags.
     * @param {ModifyTableOpt} [opt] Options object, see
     * {@link ModifyTableOpt}
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link DefinedTags}
     * @see {@link FreeFormTags}
     * @see {@link TableResult}
     * @see {@link NoSQLClient.tableDDL}
     */
    setTableTags(tableName: string, definedTags: DefinedTags|undefined,
        freeFormTags?: FreeFormTags, opt?: ModifyTableOpt):
        Promise<TableResult>;

    /**
     * Retrieves static information about a table, including its
     * provisioned througput, capacity and schema, in the form of {@link
     * TableResult}. Dynamic information such as usage() is obtained using
     * {@link getTableUsage}
     * @async
     * @param {string|TableResult} table Either a table name or a
     * {@link TableResult} object that was returned from a call to
     * {@link NoSQLClient#tableDDL}. If the latter,
     * error information for the DDL operation will be retrieved, so
     * if the original call failed, this follow-on call will also fail with
     * the same error.
     * @param {GetTableOpt} [opt] Options object, see {@link GetTableOpt}
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link NoSQLClient#tableDDL}
     */
    getTable(table: string | TableResult, opt?: GetTableOpt):
        Promise<TableResult>;
    
    /**
     * @overload
     * Asynchronously waits for table DDL operation completion.
     * <p>
     * Table DDL operations are operations initiated by {@link tableDDL}.
     * These are potentially long-running operations and {@link TableResult}
     * returned by {@link tableDDL} does not imply operation completion.
     * {@link forCompletion} takes {@link TableResult} as an argument and
     * completes (i.e. the returned {@link !Promise | Promise} resolves) when
     * the corresponding operation is completed by the service. This is
     * accomplished by polling the operation state at specified intervals
     * using {@link getTable} until the table state becomes
     * {@link TableState.ACTIVE} for all operations except "DROP TABLE", in
     * the latter case polling until the table state becomes
     * {@link TableState.DROPPED}.
     * <p>
     * The result of this method is {@link TableResult} representing the state
     * of the operation at the last poll. If the operation fails, this method
     * will result in error (i.e. the returned {@link !Promise | Promise} will
     * reject with an error) contaning information about the operation
     * failure.
     * <p>
     * Note that on operation completion, the passed {@link TableResult} is
     * modified in place (to reflect operation completion) in addition to
     * being returned.
     * <p>
     * As a more convenient way to perform table DDL operations to completion,
     * you may pass {@link TableDDLOpt#complete} to {@link tableDDL}. In this
     * case, after table DDL operation is initiated, {@link tableDDL} will use
     * {@link forCompletion} to await operation completion.
     * @example
     * Using forCompletion with table DDL operation.
     * ```ts
     * try {
     *     let res = await client.tableDDL('DROP TABLE.....');
     *     await client.forCompletion(res);
     * } catch(err) {
     *     // May be caused by client.forCompletion() if long running table
     *     // DDL operation was unsuccessful.
     * }
     * ```
     * @async
     * @param {TableResult} res Result of {@link NoSQLClient#tableDDL}. This
     * result is modified by this method on operation completion
     * @param {CompletionOpt} [opt] Options object, see {@link CompletionOpt}
     * @returns {Promise} Promise of {@link TableResult}, which is the object
     * passed as first argument and modified to reflect operation completion
     * @see {@link NoSQLClient#tableDDL}
     * @see {@link NoSQLClient#getTable}
     * @see {@link TableResult}
     */
    forCompletion(res: TableResult, opt?: CompletionOpt):
        Promise<TableResult>;

    /**
     * @overload
     * On-premises only.
     * Asynchronously waits for admin DDL operation completion.
     * <p>
     * Admin DDL operations are operations initiated by {@link adminDDL}.
     * These are potentially long-running operations and {@link AdminResult}
     * returned by {@link adminDDL} does not imply operation completion.
     * {@link forCompletion} takes {@link AdminResult} as an argument
     * and completes (i.e. the returned {@link !Promise | Promise} resolves)
     * when the corresponding operation is completed by the service. This is
     * accomplished by polling the operation state at specified intervals
     * using {@link adminStatus} until the state of operation becomes
     * {@link AdminState.COMPLETE}.
     * <p>
     * The result of this method is {@link AdminResult} representing the state
     * of the operation at the last poll. If the operation fails, this method
     * will result in error (i.e. the returned {@link !Promise | Promise} will
     * reject with an error) contaning information about the operation
     * failure.
     * <p>
     * Note that on operation completion, the passed {@link AdminResult} is
     * modified in place (to reflect operation completion) in addition to
     * being returned.
     * <p>
     * As a more convenient way to perform admin DDL operations to completion,
     * you may pass {@link AdminDDLOpt#complete} to {@link adminDDL}. In this
     * case, after DDL operation is initiated, {@link adminDDL} will use
     * {@link forCompletion} to await operation completion.
     * @example
     * Using forCompletion with admin DDL operation.
     * ```ts
     * try {
     *     res = await client.adminDDL('CREATE NAMESPACE.....');
     *     await client.forCompletion(res);
     * } catch(err) {
     *     // May be caused by client.forCompletion() if long running admin
     *     // DDL operation was unsuccessful.
     * }
     * ```
     * @async
     * @param {AdminResult} res Result of {@link NoSQLClient#adminDDL}. This
     * result is modified by this method on operation completion
     * @param {CompletionOpt} [opt] Options object, see {@link CompletionOpt}
     * @returns {Promise} Promise of {@link AdminResult}, which is the object
     * passed as first argument and modified to reflect operation completion
     * @see {@link NoSQLClient#adminDDL}
     * @see {@link NoSQLClient#adminStatus}
     * @see {@link AdminResult}
     */
    forCompletion(res: AdminResult, opt?: CompletionOpt):
        Promise<AdminResult>;

    /**
     * Waits asynchronously for the table to reach a desired state.  This is
     * achieved by polling the table at specified intervals.
     * <p>
     * This API is used to ensure that the table is ready for data
     * operations after it has been created or altered. It should only be used
     * if the table DDL operation has been performed outside of the current
     * flow of control (e.g. by another application) such that the
     * {@link TableResult} of the DDL operation is not available.  To wait for
     * completion of the table DDL operation that you issued, use
     * {@link NoSQLClient#forCompletion}.  This API waits until
     * the table has transitioned from an intermediate state like
     * {@link TableState.CREATING} or {@link TableState.UPDATING} to a
     * stable state like {@link TableState.ACTIVE}, at which point it
     * can be used.
     * <p>
     * The result of this operation, if successful, is a {@link TableResult}
     * that shows the table state from the last poll. The
     * state of {@link TableState.DROPPED} is treated specially in
     * that it will be returned as success, even if the table does not
     * exist. Other states will throw an exception if the table is not
     * found.
     * @async
     * @param {string} tableName Table name
     * @param {TableState} tableState Desired table state
     * @param {CompletionOpt} [opt] Options object, see {@link CompletionOpt}
     * @returns {Promise} Promise of {@link TableResult} representing
     * result of the last poll
     * @see {@link NoSQLClient#getTable}
     * @see {@link NoSQLClient#tableDDL}
     * @see {@link NoSQLClient#forCompletion}
     */
    forTableState(tableName: string, tableState: TableState,
        opt?: CompletionOpt): Promise<TableResult>;

    /**
     * Cloud service only.
     * Note: this method is only supported when using the driver with the
     * Cloud Service.  It is not supported when using the driver with
     * On-Premise NoSQL Database (see {@link ServiceType.KVSTORE}), in which
     * case it will result in error.
     * <p>
     * Retrieves dynamic information associated with a table, as returned in
     * {@link TableUsageResult}. This information includes a time series of
     * usage snapshots, each indicating data such as read and write
     * throughput, throttling events, etc, as found in {@link TableUsage}.
     * <p>
     * Usage information is collected in time slices and returned in
     * individual usage records.  It is possible to return a range of usage
     * records within a given time period.  Unless the time period is
     * specified, only the most recent usage record is returned. Usage records
     * are created on a regular basis and maintained for a period of time.
     * Only records for time periods that have completed are returned so that
     * a user never sees changing data for a specific range.
     * <p>
     * Because the number of table usage records can be very large, you may
     * page the results over multiple calls to
     * {@link NoSQLClient#getTableUsage} using
     * {@link TableUsageOpt#startIndex} and {@link TableUsageOpt#limit}
     * parameters as shown in the example.  However, the
     * recommended way is to call {@link NoSQLClient#tableUsageIterable} and
     * iterate over its result.
     * @example
     * Paging over table usage records.
     * <p>  
     * We iterate until the number of returned table usage records becomes
     * less than the limit (and possibly 0), which means that the last
     * partial result has been received.
     * </p>
     * 
     * ```ts
     * const now = Date.now();
     * const opt = {
     *     startTime: now - 3600 * 1000, // last 1 hour
     *     endTime: now,
     *     limit: 100
     * };
     * do {
     *     const res = await client.getTableUsage('MyTable', opt);
     *     for(const rec of res.usageRecords) {
     *         console.log(rec);
     *     }
     *     opt.startIndex = res.nextIndex;
     * } while(res.usageRecords.length === opt.limit);
     * ```
     * @async
     * @param {string} tableName Table name
     * @param {TableUsageOpt} [opt] Options object, see {@link TableUsageOpt}.
     * @returns {Promise} Promise of {@link TableUsageResult}
     * @see {@link TableUsageResult}
     * @see {@link #tableUsageIterable}
     */
    getTableUsage(tableName: string, opt?: TableUsageOpt):
        Promise<TableUsageResult>;
    
    /**
     * Cloud service only.
     * Note: this method is only supported when using the driver with the
     * Cloud Service.  It is not supported when using the driver with
     * On-Premise NoSQL Database (see {@link ServiceType.KVSTORE}), in which
     * case it will result in error.
     * <p>
     * Retrieves dynamic information associated with a table, as returned in
     * {@link TableUsageResult}.
     * <p>
     * Use this API when you need to retrieve a
     * large number of table usage records and you wish to page the results
     * rather than returning the whole list at once.  The iteration is done
     * by using <em>for-await-of</em> loop. The iteration is asynchronous and
     * each step of the iteration returns a Promise of
     * {@link TableUsageResult}. Using this API is equivalent to paging table
     * usage records as shown in the example of
     * {@link NoSQLClient#getTableUsage}.
     * <p>
     * Note that you must specify a time range (at least one of
     * {@link TableUsageOpt#startTime} and {@link TableUsageOpt#endTime} for
     * which to return table usage records, otherwise only one (the most
     * recent) table usage record will be returned.
     * <p>
     * You may optionally specify a limit on the number of table usage records
     * returned in each partial result using {@link TableUsageOpt#limit}. If
     * not specified, a default system limit will be used.
     * @example
     * Paging table usage records.
     * ```ts
     * const now = Date.now();
     * 
     * const opt = {
     *     startTime: now - 3600 * 1000, // last 1 hour
     *     endTime: now,
     *     limit: 100
     * };
     * 
     * for await(const res of client.tableUsageIterable('MyTable', opt)) {
     *     for(const rec of res.usageRecords) {
     *         console.log(rec);
     *     }
     * }
     * ```
     * @param {string} tableName Table name
     * @param {TableUsageOpt} [opt] Options object, see {@link TableUsageOpt}
     * @returns {AsyncIterable} Async iterable of {@link TableUsageResult}
     * @see {@link #getTableUsage}
     * @since 5.4
     */
    tableUsageIterable(tableName: string, opt?: TableUsageOpt):
        AsyncIterable<TableUsageResult>;

    /**
     * Retrieves information about indexes of the table as array of
     * {@link IndexInfo} objects.
     * @async
     * @param {string} tableName Table name
     * @param {GetIndexesOpt} [opt] Options object, see {@link GetIndexesOpt}
     * @returns {Promise} Promise of {@link IndexInfo}[]
     * @see {@link IndexInfo}
     */
    getIndexes(tableName: string, opt?: GetIndexesOpt):
        Promise<IndexInfo[]>;

    /**
     * Retrieves information about specific index of the table as
     * {@link IndexInfo} object.
     * @async
     * @param {string} tableName Table name
     * @param {string} indexName Index name
     * @param {GetIndexOpt} [opt] Options object, see {@link GetIndexOpt}
     * @returns {Promise} Promise of {@link IndexInfo}
     * @see {@link NoSQLClient#getIndexes}
     */
    getIndex(tableName: string, indexName: string, opt?: GetIndexOpt):
        Promise<IndexInfo>;

    /**
     * Lists tables, returning table names. If further information about a
     * specific table is desired the {@link NoSQLClient#getTable} API may be
     * used.  If a given identity has access to a large number of tables
     * the list may be paged by using startIndex and limit options.  The list
     * is returned as string array in {@link ListTablesResult}.  Names
     * are returned in alphabetical order to facilitate paging.
     * @async
     * @param {ListTablesOpt} [opt] Options object, see {@link ListTablesOpt}
     * @returns {Promise} Promise of {@link ListTablesResult}
     * @see {@link ListTablesResult}
     */
    listTables(opt?: ListTablesOpt): Promise<ListTablesResult>;

    /**
     * Gets the row associated with a primary key. On success the value of the
     * row is available as property of {@link GetResult}. If there are no
     * matching rows, the operation is still successful the row property will
     * be set to null.
     * @async
     * @typeParam TRow Type of table row instance. Must include primary key
     * fields. Defaults to {@link AnyRow}.
     * @param {string} tableName Table name
     * @param {RowKey<TRow>} key Primary key of the row, type determined by
     * {@link RowKey}
     * @param {GetOpt} [opt] Options object, see {@link GetOpt}
     * @returns {Promise} Promise of {@link GetResult}
     * @see {@link AnyKey}
     * @see {@link GetResult}
     */
    get<TRow extends AnyRow>(tableName: string, key: RowKey<TRow>,
        opt?: GetOpt): Promise<GetResult<TRow>>;

    /**
     * Puts a row into a table. This method creates a new row or overwrites
     * an existing row entirely. The value used for the put must contain a
     * complete primary key and all required fields.
     * <p>
     * It is not possible to put part of a row.  Any fields that are not
     * provided will be defaulted, overwriting any existing value. Fields that
     * are not nullable or defaulted must be provided or the operation will
     * fail.
     * <p>
     * By default a put operation is unconditional, but put operations can be
     * conditional based on existence, or not, of a previous value as well as
     * conditional on the {@link RowVersion} of the existing value:
     * <ul>
     * <li>Use {@link PutOpt#ifAbsent} to do a put only if there is no
     * existing row that matches the primary key.</li>
     * <li>Use {@link PutOpt#ifPresent} to do a put only if there is an
     * existing row that matches the primary key.</li>
     * <li>Use {@link PutOpt#matchVersion} to do a put only if there is an
     * existing row that matches the primary key <em>and</em> its
     * {@link RowVersion} matches that provided by
     * {@link PutOpt#matchVersion}.
     * </li>
     * </ul>
     * Note that only one of {@link PutOpt#ifAbsent}, {@link PutOpt#ifPresent}
     * or {@link PutOpt#matchVersion} options may be specified for given put
     * operation.
     * <p>
     * It is also possible, on failure, to return information about the
     * existing row. The row, including its {@link RowVersion} can be
     * optionally returned if a put operation fails because of a Version
     * mismatch or if the operation fails because the row already exists. The
     * existing row information will only be returned if
     * {@link PutOpt#returnExisting} is true and one of the following occurs:
     * <ul>
     * <li>{@link PutOpt#ifAbsent} is true and the operation fails because
     * the row already exists.</li>
     * <li>{@link PutOpt#matchVersion} is used and the operation fails because
     * the row exists and its {@link RowVersion} does not match.</li>
     * </ul>
     * The information about the result of the put operation is returned as
     * {@link PutResult}. Note that the failure cases discussed above that
     * resulted from inability to satisfy {@link PutOpt#ifAbsent},
     * {@link PutOpt#ifPresent} or {@link PutOpt#matchVersion} options are
     * still considered successful as API calls, i.e. they result in
     * {@link PutResult} and not {@link NoSQLError}. See
     * {@link PutResult#success}.  However if put fails for other reasons,
     * this API call will result in error instead.
     *
     * @async
     * @typeParam TRow Type of table row instance. Must include primary key
     * fields. Defaults to {@link AnyRow}.
     * @param {string} tableName Table name
     * @param {TRow} row Table row
     * @param {PutOpt} [opt] Options object, see {@link PutOpt}
     * @returns {Promise} Promise of {@link PutResult}
     * @see {@link AnyRow}
     * @see {@link RowVersion}
     * @see {@link TimeToLive}
     * @see {@link PutResult}
     */
    put<TRow extends AnyRow>(tableName: string, row: TRow,
        opt?: PutOpt): Promise<PutResult<TRow>>;

    /**
     * Performs a put if there is no existing row that matches the primary
     * key.  This API is a shorthand for {@link NoSQLClient#put} with
     * {@link PutOpt#ifAbsent} set to true.
     * @async
     * @typeParam TRow Type of table row instance, same as in
     * {@link NoSQLClient#put}.
     * @param {string} tableName Table name
     * @param {TRow} row Row, same as in {@link NoSQLClient#put}
     * @param {PutIfOpt} [opt] Options object, see {@link PutIfOpt}
     * @returns {Promise} Promise of {@link PutResult}
     * @see {@link NoSQLClient#put}
     */
    putIfAbsent<TRow extends AnyRow>(tableName: string, row: TRow,
        opt?: PutIfOpt): Promise<PutResult<TRow>>;

    /**
     * Performs a put if there is existing row that matches the primary
     * key.  This API is a shorthand for {@link NoSQLClient#put} with
     * {@link PutOpt#ifPresent} set to true.
     * @async
     * @typeParam TRow Type of table row instance, same as in
     * {@link NoSQLClient#put}.
     * @param {string} tableName Table name
     * @param {TRow} row Row, same as in {@link NoSQLClient#put}
     * @param {PutIfOpt} [opt] Options object, see {@link PutIfOpt}
     * @returns {Promise} Promise of {@link PutResult}
     * @see {@link NoSQLClient#put}
     */
    putIfPresent<TRow extends AnyRow>(tableName: string, row: TRow,
        opt?: PutIfOpt): Promise<PutResult<TRow>>;
    
    /**
     * Performs a put if there is an existing row that matches the primary key
     * and its {@link RowVersion} matches the value provided.  This API is a
     * shorthand for {@link NoSQLClient#put} with {@link PutOpt#matchVersion}
     * specified.
     * @async
     * @typeParam TRow Type of table row instance, same as in
     * {@link NoSQLClient#put}.
     * @param {string} tableName Table name
     * @param {TRow} row Row, same as in {@link NoSQLClient#put}
     * @param {RowVersion} matchVersion {@link RowVersion} to match
     * @param {PutIfOpt} [opt] Options object, see {@link PutIfOpt}
     * @returns {Promise} Promise of {@link PutResult}
     * @see {@link NoSQLClient#put}
     */
    putIfVersion<TRow extends AnyRow>(tableName: string, row: TRow,
        matchVersion: RowVersion, opt?: PutIfOpt):
        Promise<PutResult<TRow>>;
    
    /**
     * Deletes a row from a table. The row is identified using a primary key
     * value.
     * <p>
     * By default a delete operation is unconditional and will succeed if the
     * specified row exists. Delete operations can be made conditional based
     * on whether the {@link RowVersion} of an existing row matches that supplied
     * {@link DeleteOpt#matchVersion}.
     * <p>
     * It is also possible, on failure, to return information about the
     * existing row.  The row and its version can be optionally returned as
     * part of {@link DeleteResult} if a delete operation fails because of
     * a version mismatch. The existing row information will only be returned
     * if {@link DeleteOpt#returnExisting} is true and
     * {@link DeleteOpt#matchVersion} is set and the operation fails because
     * the row exists and its version does not match.  Use of
     * {@link DeleteOpt#returnExisting} may result in additional consumed read
     * capacity. If the operation is successful there will be no information
     * returned about the previous row.
     * <p>
     * The information about the result of the delete operation is returned as
     * {@link DeleteResult}.  Note that the failures to delete if the row
     * doesn't exist or if {@link DeleteOpt#matchVersion} is set and the
     * version did not match are still considered successful as API calls,
     * i.e. they result in {@link DeleteResult} and not {@link NoSQLError},
     * see {@link DeleteResult#success}.  However if delete fails for other
     * reasons, this API call will result in error instead.
     * @async
     * @typeParam TRow Type of table row instance. Must include primary key
     * fields. Defaults to {@link AnyRow}.
     * @param {string} tableName Table name
     * @param {RowKey<TRow>} key Primary key of the row, type determined by
     * {@link RowKey}
     * @param {DeleteOpt} [opt] Options object, see {@link DeleteOpt}
     * @returns {Promise} Promise of {@link DeleteResult}
     * @see {@link AnyKey}
     * @see {@link RowVersion}
     * @see {@link DeleteResult}
     */
    delete<TRow extends AnyRow>(tableName: string, key: RowKey<TRow>,
        opt?: DeleteOpt): Promise<DeleteResult<TRow>>;
    
    /**
     * Performs a delete if there is an existing row that matches the primary
     * key and its {@link RowVersion} matches the value provided.  This API is
     * a shorthand for {@link NoSQLClient#delete} with
     * {@link DeleteOpt#matchVersion} specified.
     * @async
     * @typeParam TRow Type of table row instance, same as in
     * {@link NoSQLClient#delete}.
     * @param {string} tableName Table name
     * @param {RowKey<TRow>} key Primary key, same as in
     * {@link NoSQLClient#delete}
     * @param {RowVersion} matchVersion {@link RowVersion} to match
     * @param {DeleteIfOpt} [opt] Options object, see {@link DeleteIfOpt}
     * @returns {Promise} Promise of {@link DeleteResult}
     * @see {@link NoSQLClient#delete}
     */
    deleteIfVersion<TRow extends AnyRow>(tableName: string, key: RowKey<TRow>,
        matchVersion: RowVersion, opt?: DeleteIfOpt):
        Promise<DeleteResult<TRow>>;

    /**
     * Deletes multiple rows from a table residing on the same shard in an
     * atomic operation.  A range of rows is specified using a partial primary
     * key plus a field range based on the portion of the key that is not
     * provided. The partial primary key must contain all of the fields that
     * are in the shard key.  For example if a table's primary key is
     * &lt;id, timestamp&gt; and the its shard key is the id, it is possible
     * to delete a range of timestamp values for a specific id by providing
     * a key with an id value but no timestamp value and providing a range
     * of timestamp values in the {@link MultiDeleteOpt#fieldRange}.  If the
     * field range is not provided, the operation will delete all rows
     * matching the partial key.
     * <p>
     * The information about the result of this operation will be returned as
     * {@link MultiDeleteResult}.
     * <p>
     * Because this operation can exceed the maximum amount of data modified
     * in a single operation it is possible that it will delete only part of
     * the range of rows and a continuation key will be set in
     * {@link MultiDeleteResult} that can be used to continue the operation.
     * @async
     * @typeParam TRow Type of table row instance.  Must include primary key
     * fields. Defaults to {@link AnyRow}.
     * @param {string} tableName Table name
     * @param {Key} key Partial primary key
     * @param {MultiDeleteOpt} [opt] Options object, {@link MultiDeleteOpt}
     * @returns {Promise} Promise of {@link MultiDeleteResult}
     * @see {@link AnyKey}
     * @see {@link FieldRange}
     * @see {@link MultiDeleteResult}
     */
    deleteRange<TRow extends AnyRow>(tableName: string, key: RowKey<TRow>,
        opt?: MultiDeleteOpt): Promise<MultiDeleteResult>;
    
    /**
     * Executes a sequence of put and delete operations associated with
     * a table or tables that share the same <em>shard key</em> portion of
     * their primary keys, all the specified operations are executed within
     * the scope of a single transaction, thus making the operation atomic.
     * It is an efficient way to atomically modify multiple related rows.
     * <p>
     * There are some size-based limitations on this operation:
     * <ul>
     * <li>The max number of individual operations (put, delete) in a single
     * call to this API is 50.</li>
     * <li>The total request size is limited to 25MB.</li>
     * </ul>
     * The result of this operation is returned as
     * {@link WriteMultipleResult}.  On successful completion, it will store
     * array of the execution results of all sub operations.  If this
     * operation was aborted because of failure of a sub operation which has
     * {@link WriteOperation#abortOnFail} set to true, or if
     * {@link WriteMultipleOpt#abortOnFail} is true, then the index and
     * execution result of the failed sub operation will be stored in
     * {@link WriteMultipleResult} (thus the API call in this case is still
     * successful and no error results).
     * <p>
     * Note that in addition to {@link WriteMultipleOpt} passed to this API,
     * each sub operation can pass its own put or delete options in
     * {@link WriteOperation} Each option explicitly set in
     * {@link WriteOperation} will take precedence over its value in
     * {@link WriteMultipleOpt}, otherwise {@link WriteMultipleOpt} can be
     * used to specify options that should be the same for all sub operations.
     * <p>
     * It is possible to issue operations for multiple tables as long as
     * these tables have the same shard key.  This means that these tables
     * must be part of the same parent/child table hierarchy that has a single
     * ancestor table specifying the shard key (you may include operations for
     * this ancestor table and/or any of its descendants).  To issue
     * operations for multiple tables, use the overload of this API without
     * the <em>tableName</em> and specify table per operation as
     * {@link WriteOperation#tableName}.
     * @overload
     * @async
     * @typeParam TRow Type of table row instance. Must include primary key
     * fields. Defaults to {@link AnyRow}.
     * @param {string} tableName Table name, if all operations are for a
     * single table.  If issuing operations for multiple tables, use the
     * overload without <em>tableName</em> parameter. Specifying
     * <em>tableName</em> parameter together with
     * {@link WriteOperation#tableName} for any operation will result in error
     * @param {WriteOperation[]} operations Array of
     * {@link WriteOperation} objects each representing single put or delete
     * operation, see {@link WriteOperation}
     * @param {WriteMultipleOpt} [opt] Options object, see
     * {@link WriteMultipleOpt}
     * @returns {Promise} Promise of {@link WriteMultipleResult}
     */
    writeMany<TRow extends AnyRow>(tableName: string,
        operations: WriteOperation<TRow>[], opt?: WriteMultipleOpt):
        Promise<WriteMultipleResult<TRow>>;

    /**
     * @overload
     * @async
     * @typeParam TRow Type of table row instance. Must include primary key
     * fields. Defaults to {@link AnyRow}.
     * @param {WriteOperation[]} operations Array of
     * {@link WriteOperation} objects each representing single put or delete
     * operation, see {@link WriteOperation}
     * @param {WriteMultipleOpt} [opt] Options object, see
     * {@link WriteMultipleOpt}
     * @returns {Promise} Promise of {@link WriteMultipleResult}
     * @see {@link WriteOperation}
     * @see {@link WriteMultipleResult}
     */
    writeMany<TRow extends AnyRow>(operations: WriteOperation<TRow>[],
        opt?: WriteMultipleOpt): Promise<WriteMultipleResult<TRow>>;

    /**
     * @overload
     * @async
     * @param {WriteOperation} operations Array of {@link WriteOperation}
     * objects each representing single put or delete operation, see
     * {@link WriteOperation}
     * @param {WriteMultipleOpt} [opt] Options object, see
     * {@link WriteMultipleOpt}
     * @returns {Promise} Promise of {@link WriteMultipleResult}
     * @see {@link WriteOperation}
     * @see {@link WriteMultipleResult}
     */
    writeMany(operations: WriteOperation[], opt?: WriteMultipleOpt):
        Promise<WriteMultipleResult>;

    /**
     * Executes a sequence of put operations associated with a table that
     * share the same <em>shard key</em> portion of their primary keys, all
     * the specified operations are executed within the scope of single
     * transaction, thus making the operation atomic.
     * This API is a shortcut to {@link NoSQLClient#writeMany} with the
     * following simplifications:
     * <ul>
     * <li>The sequence contains only put operations.</li>
     * <li>All operations are for a single table.</li>
     * <li>Options are specified only in {@link PutManyOpt} for this API
     * and are same for all put sub operations (no per-sub-operation options).
     * </li>
     * </ul>
     * This API may be more convenient to use than
     * {@link NoSQLClient#writeMany} when applicable.
     * @async
     * @typeParam TRow Type of table row instance. Must include primary key
     * fields. Defaults to {@link AnyRow}.
     * @param {string} tableName
     * @param {TRow[]} rows Array of rows to put
     * @param {PutManyOpt} [opt] Options object, see {@link PutManyOpt}
     * @returns {Promise} Promise of {@link WriteMultipleResult}
     * @see {@link writeMany}
     */
    putMany<TRow extends AnyRow>(tableName: string, rows: TRow[],
        opt?: PutManyOpt): Promise<WriteMultipleResult<TRow>>;
    
    /**
     * Executes a sequence of delete operations associated with a table that
     * share the same <em>shard key</em> portion of their primary keys, all
     * the specified operations are executed within the scope of single
     * transaction, thus making the operation atomic.
     * This API is a shortcut to {@link NoSQLClient#writeMany} with the
     * following simplifications:
     * <ul>
     * <li>The sequence contains only delete operations.</li>
     * <li>All operations are for a single table.</li>
     * <li>Options are specified only in {@link DeleteManyOpt} for this API
     * and are same for all delete sub-operations (no per-sub-operation
     * options).</li>
     * </ul>
     * This API may be more more convenient to use than
     * {@link NoSQLClient#writeMany} when applicable.
     * @async
     * @typeParam TRow Type of table row instance. Must include primary key
     * fields. Defaults to {@link AnyRow}.
     * @param {string} tableName
     * @param {TKey[]} keys Array of primary keys to delete
     * @param {DeleteManyOpt} [opt] Options object, see {@link DeleteManyOpt}
     * @returns {Promise} Promise of {@link WriteMultipleResult}
     * @see {@link writeMany}
     */
    deleteMany<TRow extends AnyRow>(tableName: string, keys: RowKey<TRow>[],
        opt?: DeleteManyOpt): Promise<WriteMultipleResult<TRow>>;
    
    /**
     * Prepares a query for execution and reuse. See {@link NoSQLClient#query}
     * for general information and restrictions. It is recommended that
     * prepared queries are used when the same query will run multiple times
     * as execution is much more efficient than starting with a query string
     * every time. The query language and API support query variables to
     * assist with re-use.
     * <p>
     * The result of this operation is {@link PreparedStatement}.  It supports
     * bind variables in queries which can be used to more easily reuse a
     * query by parameterization, see {@link PreparedStatement} for details.
     * @async
     * @param {string} stmt Query SQL statement
     * @param {PrepareOpt} [opt] Options object, see {@link PrepareOpt}.
     * @returns {Promise} Promise of {@link PreparedStatement}
     */
    prepare(stmt: string, opt?: PrepareOpt): Promise<PreparedStatement>;

    /**
     * Queries a table based on the query statement.
     * <p>
     * Queries that include a full shard key will execute much more
     * efficiently than more distributed queries that must go to multiple
     * shards.
     * <p>
     * DDL-style queries such as "CREATE TABLE ..." or "DROP TABLE .." are not
     * supported by this API. Those operations must be performed using
     * {@link NoSQLClient#tableDDL}.
     * <p>
     * For performance reasons prepared queries are preferred for queries that
     * may be reused. Prepared queries bypass compilation of the query. They
     * also allow for parameterized queries using bind variables, see
     * {@link NoSQLClient#prepare}.
     * <p>
     * The result of this operation is returned as {@link QueryResult}.  It
     * contains array of result records and may contain continuation key as
     * {@link QueryResult#continuationKey}.
     * <p>
     * The amount of data read by a single query request is limited by a
     * system default and can be further limited by setting
     * {@link QueryOpt#maxReadKB}. This limits the amount of data
     * <em>read</em> and not the amount of data <em>returned</em>, which means
     * that a query can return zero results but still have more data to read.
     * This situation is detected by checking if the {@link QueryResult} has a
     * continuation key.  In addition, number of results returned by the query
     * may be explicitly limited by setting {@link QueryOpt#limit}. For this
     * reason queries should always operate in a loop, acquiring more results,
     * until the continuation key is null, indicating that the query is done.
     * Inside the loop the continuation key is applied to
     * {@link NoSQLClient#query} by setting {@link QueryOpt#continuationKey}.
     * <p>
     * The easier way to iterate over query results is by using
     * {@link NoSQLClient#queryIterable}, in which case you do not need to
     * deal with continuaton key.
     * 
     * @async
     * @typeParam TRow Type that represent the shape of query result record.
     * This may be different from the shape of table row. Defaults to
     * {@link AnyRow}
     * @param {string|PreparedStatement} stmt Query statement, can be either
     * SQL query string or a prepared query represented as
     * {@link PreparedStatement}, see {@link NoSQLClient#prepare}
     * @param {QueryOpt} [opt] Options object, see {@link QueryOpt}
     * @returns {Promise} Promise of {@link QueryResult}
     * @see {@link NoSQLClient#queryIterable}
     */
    query<TRow extends AnyRow>(stmt: string|PreparedStatement,
        opt?: QueryOpt): Promise<QueryResult<TRow>>;

    /**
     * This API facilitates iteration over query results returned by
     * {@link NoSQLClient#query} by using <em>for-await-of</em> loop.  The
     * iteration over query results is necessary because of the limitations
     * on the amount of data read during each query request as described in
     * {@link NoSQLClient#query}.  The iteration is asynchronous and each
     * step of the iteration returns a Promise of {@link QueryResult}.  Using
     * this API is internally equivalent to calling {@link NoSQLClient#query}
     * in a loop and using continuation key returned in {@link QueryResult} to
     * continue the query.  Thus you do not need to explicitly manage
     * continuation key when using this API.
     * <p>
     * Note that calling this API by itself does not start
     * the query, the query is started when starting the iteration via
     * <em>for-await-of</em> loop.
     * <p>
     * The returned iterable cannot be reused for multiple queries.
     * To execute another query, call {@link NoSQLClient#queryIterable} again
     * to create a new iterable.
     * <p>
     * All other considerations described in {@link NoSQLClient#query} apply
     * when using this API.
     * @example
     * Using {@link queryIterable}.
     * ```ts
     * try {
     *     const stmt = 'SELECT * from orders';
     *     for await(const res of client.queryIterable(stmt)) {
     *         console.log(`Retrieved ${res.rows.length} rows`);
     *         // Do something with res.rows
     *     }
     * } catch(err) {
     *     // handle errors
     * }
     * ```
     * @typeParam TRow Type that represent the shape of query result record.
     * This may be different from the shape of table row. Defaults to
     * {@link AnyRow}
     * @param {string|PreparedStatement} stmt Query statement, same as for
     * {@link NoSQLClient#query}
     * @param {QueryOpt} [opt] Options object, see <@link QueryOpt>
     * @returns {AsyncIterable} Async iterable of {@link QueryResult}
     * @see {@link NoSQLClient#query}
     */
    queryIterable<TRow extends AnyRow>(stmt: string|PreparedStatement,
        opt?: QueryOpt): AsyncIterable<QueryResult<TRow>>;

    /**
     * On-premise only.
     * <p>
     * Performs an administrative operation on the system.  The operations
     * allowed are defined by Data Definition Language (DDL) portion of the
     * query language that do not affect a specific table. For table-specific
     * DLL operations use {@link NoSQLClient#tableDDL}.
     * <p>
     * Examples of statements passed to this method include:
     * <ul>
     * <li>CREATE NAMESPACE mynamespace</li>
     * <li>CREATE USER some_user IDENTIFIED BY password</li>
     * <li>CREATE ROLE some_role</li>
     * <li>GRANT ROLE some_role TO USER some_user</li>
     * </ul>
     * <p>
     * <p>
     * Note that these are potentially long-running operations, so the
     * result returned by this API does not imply operation completion.  The
     * caller should use the {@link NoSQLClient#adminStatus} method to check
     * the status of the operation or {@link NoSQLClient#forCompletion} to
     * asynchronously wait for the operation completion.
     * <p>
     * Alternatively, if {@link AdminDDLOpt#complete} is set to true, this API
     * will complete (i.e. the returned {@link !Promise | Promise} will
     * resolve) only when the operation is completed.  This is equivalent to
     * sequentially executing {@link NoSQLClient#adminDDL} and
     * {@link NoSQLClient#forCompletion}. In this case,
     * {@link AdminDDLOpt#timeout} covers the whole time interval until
     * operation completion. If not specified, separate default timeouts are
     * used for issuing the DDL operation and waiting for its completion, with
     * values of {@link Config#ddlTimeout} and {@link Config#adminPollTimeout}
     * correspondingly (the latter defaults to no timeout if
     * {@link Config#adminPollTimeout} is not set).  You may also use
     * {@link AdminDDLOpt#delay} to specify polling delay (see
     * {@link NoSQLClient#forCompletion}).
     * <p>
     * Note that some of the statements used by admin DDL may contain
     * passwords in which case it is advisable to pass the statement as
     * {@link !Buffer | Buffer} so that the memory can be subsequently cleared
     * by the application.  The {@link !Buffer | Buffer} should contain the
     * statement as UTF-8 encoded string.
     * 
     * @async
     * @param {Buffer|string} stmt Statement for the operation as string or
     * Buffer containing UTF-8 encoded string
     * @param {AdminDDLOpt} [opt] Options object, see {@link AdminDDLOpt}
     * @returns {Promise} Promise of {@link AdminResult}
     * @see {@link AdminResult}
     * @see {@link NoSQLClient#forCompletion}
     */
    adminDDL(stmt: Buffer | string, opt?: AdminDDLOpt): Promise<AdminResult>;

    /**
     * On-premise only.
     * <p>
     * Check the status of the operation performed by
     * {@link NoSQLClient#adminDDL}.  Returns the status of the operation
     * as {@link AdminResult}, that includes operation state and operation
     * output if any.
     * @async
     * @param {AdminResult} adminResult Result returned by
     * {@link NoSQLClient#adminDDL}
     * @param {AdminStatusOpt} [opt] Options object, {@link AdminStatusOpt}
     * @returns {Promise} Promise of {@link AdminResult}
     * @see {@link NoSQLClient#adminDDL}
     * @see {@link AdminResult}
     */
    adminStatus(adminResult: AdminResult, opt?: AdminStatusOpt):
        Promise<AdminResult>;
    
    /**
     * On-premise only.
     * <p>
     * Returns the namespaces in the store as an array of strings.  If no
     * namespaces are found, empty array is returned.
     * <p>
     * This operation entails executing admin DDL and waiting for the
     * operation completion.
     * @async
     * @param {AdminListOpt} [opt] Options object, {@link AdminListOpt}
     * @returns {Promise} Promise of string[] of namespace names
     * @see {@link NoSQLClient#adminDDL}
     */
    listNamespaces(opt?: AdminListOpt): Promise<string[]>;
    
    /**
     * On-premise only.
     * <p>
     * Returns the users in the store as an array of {@link UserInfo}.  If no
     * users are found, empty array is returned.
     * <p>
     * This operation entails executing admin DDL and waiting for the
     * operation completion.
     * @async
     * @param {AdminListOpt} [opt] Options object, {@link AdminListOpt}
     * @returns {Promise} Promise of {@link UserInfo}[] of objects containing
     * information about each user
     * @see {@link UserInfo}
     * @see {@link NoSQLClient#adminDDL}
     */
    listUsers(opt?: AdminListOpt): Promise<UserInfo[]>;

    /**
     * On-premise only.
     * <p>
     * Returns the roles in the store as an array of strings.  If no
     * roles are found, empty array is returned.
     * <p>
     * This operation entails executing admin DDL and waiting for the
     * operation completion.
     * @async
     * @param {AdminListOpt} [opt] Options object, {@link AdminListOpt}
     * @returns {Promise} Promise of string[] of role names
     * @see {@link NoSQLClient#adminDDL}
     */
    listRoles(opt?: AdminListOpt): Promise<string[]>;

    /**
     * Cloud Service only.
     * <p>
     * Adds replica to a table.
     * <p>
     * This operation adds replica to a Global Active table. If performed on
     * a regular table (singleton), it will be converted to Global Active
     * table, provided that the sigleton table schema conforms to certain
     * restrictions. For more information, see
     * {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
     * <p>
     * Note that {@link TableLimits} for the replica table will default to
     * the table limits for the existing table, however you can override
     * the values of {@link TableLimits#readUnits} and
     * {@link TableLimits#writeUnits} for the replica by using
     * {@link AddReplicaOpt#readUnits} and {@link AddReplicaOpt#writeUnits}.
     * The storage capacity of the replica will always be the same as that of
     * the existing table.
     * <p>
     * As with {@link tableDDL}, the result returned from this API does not
     * imply operation completion. Same considerations as described in
     * {@link tableDDL} about long-running operations apply here, including
     * using {@link forCompletion} and options
     * {@link ModifyTableOpt#complete} and {@link ModifyTableOpt#delay}. See
     * {@link NoSQLClient#tableDDL}.
     * <p>
     * Note that even after this operation is completed (as described above),
     * the replica table in the receiver region may still be in the process of
     * being initialized with the data from the sender region, during which
     * time the data operations on the replica table will fail with
     * {@link ErrorCode.TABLE_NOT_READY}.
     * @async
     * @param tableName Table name
     * @param region Region where to add the replica
     * @param opt Options object, see {@link AddReplicaOpt}
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link AddReplicaOpt}
     * @see {@link TableResult}
     */
    addReplica(tableName: string, region: Region|string,
        opt?: AddReplicaOpt) : Promise<TableResult>;

    /**
     * Cloud Service only.
     * <p>
     * Drops replica from a table.
     * <p>
     * This operation drops replica from a Global Active table. For more
     * information, see
     * {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
     * <p>
     * As with {@link tableDDL}, the result returned from this API does not
     * imply operation completion. Same considerations as described in
     * {@link tableDDL} about long-running operations apply here, including
     * using {@link forCompletion} and options
     * {@link ModifyTableOpt#complete} and {@link ModifyTableOpt#delay}. See
     * {@link NoSQLClient#tableDDL}.
     * @async
     * @param tableName Table name
     * @param region Region from where to drop the replica
     * @param opt Options object, see {@link ModifyTableOpt}
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link ModifyTableOpt}
     * @see {@link TableResult}
     */
    dropReplica(tableName: string, region: Region|string,
        opt?: ModifyTableOpt) : Promise<TableResult>;

    /**
     * Cloud Service only.
     * <p>
     * This method waits asynchronously for local table replica to complete
     * its initialization.
     * <p>
     * After table replica is created, it needs to be initialized by copying
     * the data (if any) from the sender region. During this initialization
     * process, even though the table state of the replica table is
     * {@link TableState.ACTIVE}, data operations cannot be performed on the
     * replica table.
     * <p>
     * This method is used to ensure that the replica table is ready for data
     * operations by asynchronously waiting for the initialization process to
     * complete. It works similar to {@link forCompletion} by polling the
     * table state at regular intervals until
     * {@link TableResult#isLocalReplicaInitialized} is <em>true</em>.
     * <p>
     * Note that this operation must be performed in the receiver region
     * where the table replica resides (not in the sender region from where
     * the replica was created), meaning that this {@link NoSQLClient}
     * instance must be configured with the receiver region (see
     * {@link Config#region}).
     * @async
     * @param tableName Table name
     * @param opt Options object, see {@link CompletionOpt}
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
     * @see {@link addReplica}
     * @see {@link TableResult#isLocalReplicaInitialized}
     * @see {@link forCompletion}
     * @see {@link forTableState}
     */
    forLocalReplicaInit(tableName: string, opt?: CompletionOpt):
        Promise<TableResult>;
    
    /**
     * Cloud Service only.
     * <p>
     * Gets replica statistics information.
     * <p>
     * This operation retrieves stats information for the replicas of a Global
     * Active table. This information includes a time series of replica stats,
     * as found in {@link ReplicaStats}. For more information on Global Active
     * tables, see
     * {@link https://docs.oracle.com/en/cloud/paas/nosql-cloud/gasnd | Global Active Tables in NDCS}.
     * <p>
     * It is possible to return a range of stats records or, by default, only
     * the most recent stats records (up to the limit) for each replica if
     * {@link ReplicaStatsOpt#startTime} is not specified. Replica stats
     * records are created on a regular basis and maintained for a period of
     * time. Only records for time periods that have completed are returned
     * so that a user never sees changing data for a specific range.
     * <p>
     * By default, this operation returns stats for all replicas as an object
     * keyed by region id of each replica and values being an array of
     * {@link ReplicaStats} per replica (see
     * {@link ReplicaStatsResult#statsRecords}). You may limit the result to
     * the stats of only one replica by providing its
     * {@link ReplicaStatsOpt#region}.
     * <p>
     * Because the number of replica stats records can be very large, each
     * call to {@link getReplicaStats} returns a limited number of records
     * (the default limit is 1000). You can customize this limit via
     * {@link ReplicaStatsOpt#limit} option. You can retrive large number of
     * replica stats records over multiple calls to {@link getReplicaStats} by
     * setting {@link ReplicaStatsOpt#startTime} on each subsequent call to
     * the value of {@link ReplicaStatsResult#nextStartTime} returned by a
     * previous call.
     * @async
     * @param tableName Table name
     * @param opt Options object, see {@link ReplicaStatsOpt}.
     * @returns {Promise} Promise of {@link ReplicaStatsResult}
     * @see {@link ReplicaStatsOpt}
     * @see {@link ReplicaStatsResult}
     */
    getReplicaStats(tableName: string, opt?: ReplicaStatsOpt) :
        Promise<ReplicaStatsResult>;
    
    on<EvName extends keyof NoSQLClientEvents>(event: EvName,
        listener: NoSQLClientEvents[EvName]): this;

    addListener<EvName extends keyof NoSQLClientEvents>(event: EvName,
        listener: NoSQLClientEvents[EvName]): this;

    once<EvName extends keyof NoSQLClientEvents>(event: EvName,
        listener: NoSQLClientEvents[EvName]): this;
}
