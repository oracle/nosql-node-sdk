/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const ops = require('./ops');
const NoSQLClientImpl = require('./nosql_client_impl');
const promisified = require('./utils').promisified;
const BatchCursor = require('./stmt').BatchCursor;

/**
 * Defines NoSQLClient, which is the point of access to the
 * Oracle NoSQL Database Cloud service.
 */

/**
 * @classdesc NoSQLClient is provides access to Oracle NoSQL Database tables.
 * Methods of this class are used to create and manage tables and
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
 * initial config (see {@link Config}#compartment), the root
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
 *
 * @fires NoSQLClient#error
 * @fires NoSQLClient#retryable
 * @fires NoSQLClient#consumedCapacity
 * @fires NoSQLClient#tableState
 *
 * @tutorial connect-cloud
 * @tutorial connect-on-prem
 * @tutorial tables
 *
 * @example // Using NoSQLClient with async-await
 *
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
 */
class NoSQLClient extends NoSQLClientImpl {

    /**
     * Constructs an instance of NoSQLClient. This function is synchronous.
     * @param {string|Config|null} [config] Configuration for NoSQL client.
     * May be either a string indicating the file path to a configuration
     * file, or a {@link Config} object. If a file path is supplied,
     * the path can be absolute or relative to the current directory
     * of the application. The file should contain the {@link Config} object
     * and can be either JSON or JavaScript (in the latter case it's
     * <em>module.exports</em> should be set to the {@link Config} object).
     * Note that you may pass <em>null</em> or omit this parameter (use
     * no-argument constructor) if using the cloud service with the default OCI
     * configuration file that contains credentials and region identifier, as
     * described above
     * @throws {NoSQLArgumentError} if the configuration is
     * missing required properties or contains invalid property values
     * @see {@link Config}
     */
    constructor(config) {
        super(config);
    }

    /**
     * Returns the version of the driver.
     * @returns {string} The version of the driver
     */
    static get version() {
        return require('./constants').PACKAGE_VERSION;
    }

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
    close() {
        return super.close();
    }

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
     * Alternatively, if <em>opt.complete</em> is set to true, this API will
     * complete (i.e. the returned <em>Promise</em> will resolve) only
     * when the operation is completed and the table reaches state
     * {@link TableState.ACTIVE} or {@link TableState.DROPPED} (if the
     * operation was "DROP TABLE").  This is equivalent to sequentially
     * executing {@link NoSQLClient#tableDDL} and
     * {@link NoSQLClient#forCompletion}.  In this case, <em>opt.timeout</em>
     * covers the whole time interval until operation completion.
     * Accordingly, if not specified, <em>opt.timeout</em> will default to
     * the sum of {@link Config}#ddlTimeout and
     * {@link Config}#tablePollTimeout.  You may also use <em>opt.delay</em>
     * to specify polling delay (see {@link NoSQLClient#forCompletion}).
     * @async
     * @param {string} stmt SQL statement
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#ddlTimeout (or to
     * {@link Config}#ddlTimeout + {@link Config}#tablePollTimeout if
     * <em>opt.complete</em> is true)
     * @param {TableLimits} [opt.tableLimits] Specifies new table limits for
     * a table. See {@link TableLimits}.  Note that this property is required
     * when creating a table
     * @param {boolean} [opt.complete] If set to true, the returned
     * <em>Promise</em> will only resolve when the operation is completed and
     * the table state becomes {@link TableState.ACTIVE} or
     * {@link TableState.DROPPED} (if the operation was "DROP TABLE")
     * @param {number} [opt.delay] If <em>opt.complete</em> is true, specifies
     * delay between successive polls while waiting for operation completion.
     * Defaults to {@link Config}#tablePollDelay.  Has no effect if
     * <em>opt.complete</em> is not enabled
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link TableResult}
     * @see {@link NoSQLClient#forCompletion}
     */
    tableDDL(stmt, opt) {
        const req = {
            api: this.tableDDL,
            stmt,
            opt
        };
        return opt != null && opt.complete ?
            this._withCompletion(ops.TableDDLOp, req) :
            this._execute(ops.TableDDLOp, req);
    }

    /**
     * Note: this method is only supported when using the driver with the
     * Cloud Service or Cloud Simulator.  When using the driver with
     * On-Premise NoSQL Database (see {@link ServiceType.KVSTORE}), this
     * method is a no-op.
     * <p>
     * Sets new limits of throughput and storage for existing table.
     * <p>
     * Same considerations as described in {@link NoSQLClient#tableDDL} about
     * long-running operations, using {@link NoSQLClient#forCompletion} and
     * options <em>opt.complete</em> and <em>opt.delay</em> apply to this API.
     * See {@link NoSQLClient#tableDDL}.
     * @async
     * @param {string} tableName Table name
     * @param {TableLimits} tableLimits New table limits for the table
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#ddlTimeout (or to
     * {@link Config}#ddlTimeout + {@link Config}#tablePollTimeout if
     * <em>opt.complete</em> is true)
     * @param {boolean} [opt.complete] If set to true, the returned
     * <em>Promise</em> will only resolve when the operation is completed and
     * the table state becomes {@link TableState.ACTIVE}
     * @param {number} [opt.delay] If <em>opt.complete</em> is true, specifies
     * delay between successive polls while waiting for operation completion.
     * Defaults to {@link Config}#tablePollDelay.  Has no effect if
     * <em>opt.complete</em> is not enabled
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link TableResult}
     * @see {@link NoSQLClient#tableDDL}
     */
    setTableLimits(tableName, tableLimits, opt) {
        if (opt == null) {
            opt = { tableLimits };
        } else if (tableLimits) {
            opt = this._assignOpt(opt, { tableLimits });
        }
        const req = {
            api: this.setTableLimits,
            tableName,
            opt
        };
        return opt != null && opt.complete ?
            this._withCompletion(ops.TableLimitsOp, req) :
            this._execute(ops.TableLimitsOp, req);
    }

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
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @returns {Promise} Promise of {@link TableResult}
     * @see {@link NoSQLClient#tableDDL}
     */
    getTable(table, opt) {
        return this._execute(ops.GetTableOp, {
            api: this.getTable,
            table,
            opt
        });
    }

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
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds, i.e. how long to keep polling for desired table state.
     * Defaults to {@link Config}#tablePollTimeout
     * @param {number} [opt.delay] Delay in milliseconds between
     * successive polls, determines how often the polls are performed.
     * Defaults to {@link Config}#tablePollDelay
     * @returns {Promise} Promise of {@link TableResult} representing
     * result of the last poll
     * @see {@link NoSQLClient#getTable}
     * @see {@link NoSQLClient#tableDDL}
     * @see {@link NoSQLClient#forCompletion}
     */
    forTableState(tableName, tableState, opt) {
        return this._forTableState(tableName, tableState, opt);
    }

    /**
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
     * @async
     * @param {string} tableName Table name
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {Date|string|number} [opt.startTime]  Start time for the time
     * period.  Can be JavaScript Date, string representing date and time or
     * number of milliseconds since epoch (January 1, 1970, 00:00:00 UTC).
     * For string representation see <em>Date.parse()</em>.  If time
     * range is not specified, the most recent complete usage record is
     * returned
     * @param {Date|string|number}  [opt.endTime]  End time for the time
     * period, represented same as opt.startTime
     * @param {number} [opt.limit]  Limit to the number of usage records
     * desired. If not specified or value is 0, there is no limit, but not all
     * usage records may be returned due to size limitations
     * @returns {Promise} Promise of {@link TableUsageResult}
     * @see {@link TableUsageResult}
     */
    getTableUsage(tableName, opt) {
        return this._execute(ops.TableUsageOp, {
            api: this.getTableUsage,
            tableName,
            opt
        });
    }

    /**
     * Retrieves information about indexes of the table as array of
     * {@link IndexInfo} objects.
     * @async
     * @param {string} tableName Table name
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {string} [opt.indexName]  Return information only about specific
     * index, same as {@link NoSQLClient#getIndex}.  If not specified,
     * information on all indexes is returned
     * @returns {Promise} Promise of {@link IndexInfo}[]
     * @see {@link IndexInfo}
     */
    getIndexes(tableName, opt) {
        return this._execute(ops.GetIndexesOp, {
            api: this.getIndexes,
            tableName,
            opt
        });
    }

    /**
     * Retrieves information about specific index of the table as
     * {@link IndexInfo} object.
     * @async
     * @param {string} tableName Table name
     * @param {string} indexName Index name
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @returns {Promise} Promise of {@link IndexInfo}
     * @see {@link NoSQLClient#getIndexes}
     */
    getIndex(tableName, indexName, opt) {
        return promisified(this, this._getIndex, tableName,
            indexName, opt);
    }

    /**
     * Lists tables, returning table names. If further information about a
     * specific table is desired the {@link NoSQLClient#getTable} API may be
     * used.  If a given identity has access to a large number of tables
     * the list may be paged by using startIndex and limit options.  The list
     * is returned as string array in {@link ListTablesResult}.  Names
     * are returned in alphabetical order to facilitate paging.
     * @async
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information. Only tables belonging to the given compartment (but not
     * its child compartments) will be listed
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {number} [opt.startIndex]  The index to use to start returning
     * table names. This is related to the {@link ListTablesResult}#lastIndex
     * from a previous request and can be used to page table names. If not
     * set, the list starts at index 0
     * @param {number} [opt.limit] The maximum number of table names to return
     * in the operation. If not set or set to 0, there is no limit
     * @param {string} [opt.namespace] On-premise only.  If set, list tables
     * from given namespace only, otherwise list all tables for the user.
     * @returns {Promise} Promise of {@link ListTablesResult}
     * @see {@link ListTablesResult}
     */
    listTables(opt) {
        return this._execute(ops.ListTablesOp, {
            api: this.listTables,
            opt
        });
    }

    /**
     * Gets the row associated with a primary key. On success the value of the
     * row is available as property of {@link GetResult}. If there are no
     * matching rows, the operation is still successful the row property will
     * be set to null.
     * @async
     * @param {string} tableName Table name
     * @param {Key} key Primary {@link Key} of the row
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {Consistency} [opt.consistency] {@link Consistency} used for
     * the operation.  Defaults to {@link Config}#Consistency
     * @returns {Promise} Promise of {@link GetResult}
     * @see {@link Key}
     * @see {@link GetResult}
     */
    get(tableName, key, opt) {
        return this._execute(ops.GetOp, {
            api: this.get,
            tableName,
            key,
            opt
        });
    }

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
     * conditional on the {@link Version} of the existing value:
     * <ul>
     * <li>Use <em>opt.isAbsent</em> to do a put only if there is no existing
     * row that matches the primary key.</li>
     * <li>Use <em>opt.ifPresent</em> to do a put only if there is an
     * existing row that matches the primary key.</li>
     * <li>Use <em>opt.matchVersion</em> to do a put only if there is an
     * existing row that matches the primary key <em>and</em> its
     * {@link Version} matches that provided by <em>opt.matchVersion</em>.
     * </li>
     * </ul>
     * Note that only one of <em>opt.isAbsent</em>, <em>opt.ifPresent</em> or
     * <em>opt.matchVersion</em> options may be specified for given put
     * operation.
     * <p>
     * It is also possible, on failure, to return information about the
     * existing row. The row, including it's {@link Version} can be optionally
     * returned if a put operation fails because of a Version mismatch or if
     * the operation fails because the row already exists. The existing row
     * information will only be returned if <em>opt.returnExisting</em> is
     * true and one of the following occurs:
     * <ul>
     * <li><em>opt.isAbsent</em> is true and the operation fails because
     * the row already exists.</li>
     * <li><em>opt.matchVersion</em> is used and the operation fails because
     * the row exists and its {@link Version} does not match.</li>
     * </ul>
     * The information about the result of the put operation is returned as
     * {@link PutResult}.  Note that the failure cases discussed above that
     * resulted from inability to satisfy <em>opt.isAbsent</em>,
     * <em>opt.ifPresent</em> or <em>opt.matchVersion</em> options are still
     * considered successful as API calls, i.e. they result in
     * {@link PutResult} and not {@link NoSQLError}.  See
     * {@link PutResult}#success.  However if put fails for other reasons,
     * this API call will result in error instead.
     *
     * @async
     * @param {string} tableName Table name
     * @param {Row} row Table {@link Row}
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {boolean} [opt.ifAbsent] If set to true, do put
     * only if there is no existing row that matches the primary key
     * @param {boolean} [opt.ifPresent] If set to true, do put only if
     * there is existing row that matches the primary key
     * @param {Version} [opt.matchVersion] If set, do a put only if there is
     * an existing row that matches the primary key and its {@link Version}
     * matches the value provided
     * @param {boolean} [opt.returnExisting] If set to true, existing
     * row and it's version will be returned as part of {@link PutResult}
     * if put operation fails as per discussion above
     * @param {TimeToLive|number} [opt.ttl] Sets {@link TimeToLive} value,
     * causing the time to live on the row to be set to the specified value
     * on put. This value overrides any default time to live setting on
     * the table
     * @param {boolean} [opt.updateTTLToDefault] If set to true, and
     * there is an existing row, causes the operation to update the time to
     * live (TTL) value of the row based on the table's default TTL if set.
     * If the table has no default TTL this state has no effect.  By default
     * updating an existing row has no effect on its TTL.  This option cannot
     * be specified if <em>opt.ttl</em> is specified
     * @param {boolean} [opt.exactMatch] If true the value must be an exact
     * match for the table schema or the operation will fail. An exact match
     * means that there are no required fields missing and that there are no
     * extra, unknown fields. The default behavior is to not require an exact
     * match
     * @param {number} [opt.identityCacheSize] Sets the number of generated
     * identity values that are requested from the server during a put. This
     * takes precedence over the DDL identity CACHE option set during creation
     * of the identity column.  Must be positive integer.  If not set, the DDL
     * identity CACHE value is used
     * @returns {Promise} Promise of {@link PutResult}
     * @see {@link Row}
     * @see {@link Version}
     * @see {@link TimeToLive}
     * @see {@link PutResult}
     */
    put(tableName, row, opt) {
        return this._execute(ops.PutOp, {
            api: this.put,
            tableName,
            row,
            opt
        });
    }

    /**
     * Performs a put if there is no exsiting row that matches the primary
     * key.  This API is a shorthand for {@link NoSQLClient#put} with
     * <em>opt.ifAbsent</em> set to true.
     * @async
     * @param {string} tableName Table name
     * @param {Row} row Row, same as in {@link NoSQLClient#put}
     * @param {object} opt Options object, see below
     * @param {string} [opt.compartment] Same as in {@link NoSQLClient#put}
     * @param {number} [opt.timeout] Same as in {@link NoSQLClient#put}
     * @param {boolean} [opt.returnExisting] Same as in
     * {@link NoSQLClient#put}
     * @param {TimeToLive|number} [opt.ttl] Same as in {@link NoSQLClient#put}
     * @param {boolean} [opt.exactMatch] Same as in {@link NoSQLClient#put}
     * @param {number} [opt.identityCacheSize] Same as in
     * {@link NoSQLClient#put}
     * @returns {Promise} Promise of {@link PutResult}
     * @see {@link NoSQLClient#put}
     */
    putIfAbsent(tableName, row, opt) {
        return this._execute(ops.PutOp, {
            api: this.putIfAbsent,
            tableName,
            row,
            opt: this._assignOpt(opt, { ifAbsent: true })
        });
    }

    /**
     * Performs a put if there is exsiting row that matches the primary
     * key.  This API is a shorthand for {@link NoSQLClient#put} with
     * <em>opt.ifPresent</em> set to true.
     * @async
     * @param {string} tableName Table name
     * @param {Row} row Row, same as in {@link NoSQLClient#put}
     * @param {object} opt Options object, see below
     * @param {string} [opt.compartment] Same as in {@link NoSQLClient#put}
     * @param {number} [opt.timeout] Same as in {@link NoSQLClient#put}
     * @param {TimeToLive|number} [opt.ttl] Same as in {@link NoSQLClient#put}
     * @param {boolean} [opt.updateTTLToDefault] Same as in
     * {@link NoSQLClient#put}
     * @param {boolean} [opt.exactMatch] Same as in {@link NoSQLClient#put}
     * @param {number} [opt.identityCacheSize] Same as in
     * {@link NoSQLClient#put}
     * @returns {Promise} Promise of {@link PutResult}
     * @see {@link NoSQLClient#put}
     */
    putIfPresent(tableName, row, opt) {
        return this._execute(ops.PutOp, {
            api: this.putIfPresent,
            tableName,
            row,
            opt: this._assignOpt(opt, { ifPresent: true })
        });
    }

    /**
     * Performs a put if there is an existing row that matches the primary key
     * and its {@link Version} matches the value provided.  This API is a
     * shorthand for {@link NoSQLClient#put} with <em>opt.matchVersion</em>
     * specified.
     * @async
     * @param {string} tableName Table name
     * @param {Row} row Row, same as in {@link NoSQLClient#put}
     * @param {Version} matchVersion {@link Version} to match
     * @param {object} opt Options object, see below
     * @param {string} [opt.compartment] Same as in {@link NoSQLClient#put}
     * @param {number} [opt.timeout] Same as in {@link NoSQLClient#put}
     * @param {boolean} [opt.returnExisting] Same as in
     * {@link NoSQLClient#put}
     * @param {TimeToLive|number} [opt.ttl] Same as in {@link NoSQLClient#put}
     * @param {boolean} [opt.updateTTLToDefault] Same as in
     * {@link NoSQLClient#put}
     * @param {boolean} [opt.exactMatch] Same as in {@link NoSQLClient#put}
     * @param {number} [opt.identityCacheSize] Same as in
     * {@link NoSQLClient#put}
     * @returns {Promise} Promise of {@link PutResult}
     * @see {@link NoSQLClient#put}
     */
    putIfVersion(tableName, row, matchVersion, opt) {
        return this._execute(ops.PutOp, {
            api: this.putIfVersion,
            tableName,
            row,
            opt: this._assignOpt(opt, { matchVersion })
        });
    }

    /**
     * Deletes a row from a table. The row is identified using a primary key
     * value.
     * <p>
     * By default a delete operation is unconditional and will succeed if the
     * specified row exists. Delete operations can be made conditional based
     * on whether the {@link Version} of an existing row matches that supplied
     * <em>opt.matchVersion</em>
     * <p>
     * It is also possible, on failure, to return information about the
     * existing row.  The row and its version can be optionally returned as
     * part of {@link DeleteResult} if a delete operation fails because of
     * a version mismatch. The existing row information will only be returned
     * if <em>opt.returnExisting</em> is true and <em>opt.matchVersion</em> is
     * set and the operation fails because the row exists and its version does
     * not match.  Use of <em>opt.returnExisting</em> may result in additional
     * consumed read capacity. If the operation is successful there will be no
     * information returned about the previous row.
     * <p>
     * The information about the result of the delete operation is returned as
     * {@link DeleteResult}.  Note that the failures to delete if the row
     * doesn't exist or if <em>opt.matchVersion</em> is set and the version
     * did not match are still considered successful as API calls, i.e. they
     * result in {@link DeleteResult} and not {@link NoSQLError}, see
     * {@link DeleteResult}#success.  However if delete fails for other reasons,
     * this API call will result in error instead.
     * @async
     * @param {string} tableName Table name
     * @param {Key} key Primary {@link Key} of the row
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {boolean} [opt.returnExisting] If set to true, existing
     * row and it's version will be returned as part of {@link DeleteResult}
     * if delete operation fails because of version mismatch as discussed
     * above
     * @param {Version} [opt.matchVersion] If set, delete only if
     * there is an existing row that matches the primary key and its
     * {@link Version} matches the value provided
     * @returns {Promise} Promise of {@link DeleteResult}
     * @see {@link Key}
     * @see {@link Version}
     * @see {@link DeleteResult}
     */
    delete(tableName, key, opt) {
        return this._execute(ops.DeleteOp, {
            api: this.delete,
            tableName,
            key,
            opt
        });
    }

    /**
     * Performs a delete if there is an existing row that matches the primary
     * key and its {@link Version} matches the value provided.  This API is a
     * shorthand for {@link NoSQLClient#delete} with <em>opt.matchVersion</em>
     * specified.
     * @async
     * @param {string} tableName Table name
     * @param {Key} key Primary key, same as in {@link NoSQLClient#delete}
     * @param {Version} matchVersion {@link Version} to match
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Same as in
     * {@link NoSQLClient#delete}
     * @param {number} [opt.timeout] Same as in {@link NoSQLClient#delete}
     * @param {boolean} [opt.returnExisting] Same as in
     * {@link NoSQLClient#delete}
     * @returns {Promise} Promise of {@link DeleteResult}
     * @see {@link NoSQLClient#delete}
     */
    deleteIfVersion(tableName, key, matchVersion, opt) {
        return this._execute(ops.DeleteOp, {
            api: this.deleteIfVersion,
            tableName,
            key,
            opt: this._assignOpt(opt, { matchVersion })
        });
    }

    /**
     * Deletes multiple rows from a table residing on the same shard in an
     * atomic operation.  A range of rows is specified using a partial primary
     * key plus a field range based on the portion of the key that is not
     * provided. The partial primary key must contain all of the fields that
     * are in the shard key.  For example if a table's primary key is
     * &lt;id, timestamp&gt; and the its shard key is the id, it is possible
     * to delete a range of timestamp values for a specific id by providing
     * a key with an id value but no timestamp value and providing a range
     * of timestamp values in the <em>opt.fieldRange</em>.  If the field range
     * is not provided, the operation will delete all rows matching the
     * partial key.
     * <p>
     * The information about the result of this operation will be returned as
     * [MultiDeleteResult]{@link MultiDeleteResult}.
     * <p>
     * Because this operation can exceed the maximum amount of data modified
     * in a single operation it is possible that it will delete only part of
     * the range of rows and a continuation key will be set in
     * [MultiDeleteResult]{@link MultiDeleteResult} that can be
     * used to continue the operation.
     * @async
     * @param {string} tableName Table name
     * @param {Key} key Partial Primary {@link Key}
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {FieldRange} [opt.fieldRange] Field range based on columns not
     * provided in partial key.  For more details, see {@link FieldRange}
     * @param {number} [opt.maxWriteKB] The limit on the total KB write during
     * this operation.  This value can only reduce the system defined limit.
     * An attempt to increase the limit beyond the system defined limit will
     * result in error
     * @param {ContinuationKey} [opt.continuationKey] Continuation key
     * returned in {@link MultiDeleteResult} from the previous call to this
     * API and can be used to continue this operation.  Operations with a
     * continuation key still require the primary key
     * @returns {Promise} Promise of {@link MultiDeleteResult}
     * @see {@link Key}
     * @see {@link FieldRange}
     * @see {@link MultiDeleteResult}
     */
    deleteRange(tableName, key, opt) {
        return opt != null && opt.all ?
            promisified(this, this._deleteRangeAll,
                tableName, key, opt) :
            this._execute(ops.MultiDeleteOp, {
                api: this.deleteRange,
                tableName,
                key,
                opt
            });
    }

    /**
     * Executes a sequence of put and delete operations associated with
     * a table that share the same <em>shard key</em> portion of their primary
     * keys, all the specified operations are executed within the scope of a
     * single transaction, thus making the operation atomic.  It is an
     * efficient way to atomically modify multiple related rows.
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
     * <em>opt.abortOnFail</em> set to true, then the index and execution
     * result of the failed sub operation will be stored in
     * {@link WriteMultipleResult} (thus the API call in this case is still
     * successful no error results).
     * <p>
     * Note that in addition to <em>opt</em> argument of this API, each
     * sub operation may have its own <em>opt</em> property as
     * {@link WriteOperation}#opt specifying options pertaining to particular
     * put or delete sub operation, see {@link NoSQLClient#put} and
     * {@link NoSQLClient#delete} (the only exception is <em>timeout</em>
     * which can only be specified for the whole operation in <em>opt</em>
     * argument).  Each option value explicitly set in
     * {@link WriteOperation#opt} will take precedence over its value in
     * <em>opt</em> argument, otherwise the <em>opt</em> argument can be used
     * to specify options that should be same for all sub operations.
     * @async
     * @param {string} tableName Table name
     * @param {WriteOperation[]} operations Array of
     * {@link WriteOperation} objects each representing single put or delete
     * operation, see {@link WriteOperation}
     * @param {object} [opt] Options object, specifies options that should be
     * same for all put and delete sub operations (options relevant
     * only to put but not to delete will be ignored for delete operations).
     * Options for specific sub operation, other than <em>timeout</em>
     * may be specified in {@link WriteOperation}#opt and will override values
     * specified here. For list of options, see {@link WriteOperation}#opt
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @returns {Promise} Promise of {@link WriteMultipleResult}
     */
    writeMany(tableName, operations, opt) {
        return this._execute(ops.WriteMultipleOp, {
            api: this.writeMany,
            tableName,
            ops: operations,
            opt
        });
    }

    /**
     * Executes a sequence of put operations associated with a table that
     * share the same <em>shard key</em> portion of their primary keys, all
     * the specified operations are executed within the scope of single
     * transaction, thus making the operation atomic.
     * This API is a shortcut to {@link NoSQLClient#writeMany} with two
     * simplifications:
     * <ul>
     * <li>The sequence contains only put operations.</li>
     * <li>Options are specified only in the <em>opt</em> argument of this API
     * and are same for all put sub operations (no per-sub-operation options).
     * </li>
     * </ul>
     * This API may be more convenient to use than
     * {@link NoSQLClient#writeMany} when applicable.
     * @async
     * @param {string} tableName
     * @param {Row[]} rows Array of rows to put, see
     * {@link Row}
     * @param {object} [opt] Options object.  All options are the same as in
     * {@link NoSQLClient#put}, besides an additional <em>abortOnFail</em>
     * option, see below
     * @param {boolean} [opt.abortOnFail] If set to true, aborts the whole
     * transaction if any of the puts fails.  This is only applicable to
     * failures due to inability to satisfy <em>opt.ifAbsent</em>,
     * <em>opt.ifPresent</em> or <em>opt.matchVersion</em> options, see
     * discussion in {@link NoSQLClient#put}.  Other failures will result
     * in error
     * @returns {Promise} Promise of {@link WriteMultipleResult}
     */
    putMany(tableName, rows, opt) {
        return this._execute(ops.WriteMultipleOp, {
            api: this.putMany,
            tableName,
            rows,
            opt
        });
    }

    /**
     * Executes a sequence of delete operations associated with a table that
     * share the same <em>shard key</em> portion of their primary keys, all
     * the specified operations are executed within the scope of single
     * transaction, thus making the operation atomic.
     * This API is a shortcut to {@link NoSQLClient#writeMany} with two
     * simplifications:
     * <ul>
     * <li>The sequence contains only delete operations.</li>
     * <li>Options are specified only in the <em>opt</em> argument of this API
     * and are same for all delete sub-operations (no per-sub-operation
     * options).</li>
     * </ul>
     * This API may be more more convenient to use than
     * {@link NoSQLClient#writeMany} when applicable.
     * @async
     * @param {string} tableName
     * @param {Key[]} keys Array of primary keys to delete,
     * see {@link Key}
     * @param {object} [opt] Options object.  All options are the same as in
     * {@link NoSQLClient#delete}, besides an additional <em>abortOnFail</em>
     * option, see below
     * @param {boolean} [opt.abortOnFail] If set to true, aborts the whole
     * transaction if any of the deletes fails.  This is only applicable to
     * failures due non-existence of the row or inability to match
     * <em>opt.matchVersion</em>, see discussion in
     * {@link NoSQLClient#delete}.  Other failures will result in error
     * @returns {Promise} Promise of {@link WriteMultipleResult}
     */
    deleteMany(tableName, keys, opt) {
        return this._execute(ops.WriteMultipleOp, {
            api: this.deleteMany,
            tableName,
            keys,
            opt
        });
    }

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
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {boolean} [opt.getQueryPlan] If true, requests a printout
     * of query execution plan to be included in the returned
     * {@link PreparedStatement} as {@link PreparedStatement#queryPlan}
     * @returns {Promise} Promise of {@link PreparedStatement}
     */
    prepare(stmt, opt) {
        return promisified(this, this._prepare, stmt, opt);
    }

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
     * {@link QueryResult}#continuationKey.
     * <p>
     * The amount of data read by a single query request is limited by a
     * system default and can be further limited by setting
     * <em>opt.maxReadKB</em>. This limits the amount of data <em>read</em>
     * and not the amount of data <em>returned</em>, which means that a query
     * can return zero results but still have more data to read. This
     * situation is detected by checking if the {@link QueryResult} has a
     * continuation key.  In addition, number of results returned by the query
     * may be explicitly limited by setting <em>opt.limit</em>. For this
     * reason queries should always operate in a loop, acquiring more results,
     * until the continuation key is null, indicating that the query is done.
     * Inside the loop the continuation key is applied to
     * {@link NoSQLClient#query} by setting <em>opt.continuationKey</em>.
     *
     * @async
     * @param {string|PreparedStatement} stmt Query statement, can be either
     * SQL query string or a prepared query represented as
     * {@link PreparedStatement}, see {@link NoSQLClient#prepare}
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#timeout
     * @param {Consistency} [opt.consistency] {@link Consistency} used for the
     * operation.  Defaults to {@link Config}#consistency
     * @param {number} [opt.limit] Sets the limit on number of rows returned
     * by the operation. This allows an operation to return less than the
     * default amount of data
     * @param {number} [opt.maxReadKB] Sets the limit on the total data read
     * during this operation, in KB.  This value can only reduce the system
     * defined limit. An attempt to increase the limit beyond the system
     * defined limit will result in error. This limit is independent of read
     * units consumed by the operation
     * @param {number} [opt.maxWriteKB] Sets the limit on the total data
     * written during this operation, in KB.  Relevant for update and delete
     * queries.  This value can only reduce the system defined limit. An
     * attempt to increase the limit beyond the system defined limit will
     * result in error. This limit is independent of the write units consumed
     * by the operation
     * @param {number} [opt.maxMemoryMB] Maximum amount of memory in megabytes
     * that may be used locally in this query execution for operations such as
     * duplicate elimination (which may be required if using an index on an
     * array or a map) and sorting. Such operations may require significant
     * amount of memory as they need to cache full result set or a large
     * subset of it in locally. If memory consumption exceeds this value,
     * error will result.  Default is 1GB.  Defaults to
     * {@link Config}#maxMemoryMB
     * @param {ContinuationKey} [opt.continuationKey] Continuation key
     * returned in {@link QueryResult} from previous call to this API used to
     * continue the query.  If there are no more results,
     * continuation key will be null.  Note that it is possible that
     * continuation key is not null, but the query has no more
     * results remaining.  In this case the next call to
     * {@link NoSQLClient#query} will result in {@link QueryResult}#rows being
     * empty array and next continuation key being null.  This is possible if
     * the previous call to {@link NoSQLClient#query} fetched all remaing rows
     * in the result set but was stopped due to the set limitations, including
     * <em>opt.maxReadKB</em> or <em>opt.limit</em>.  In this case the server
     * will not look ahead to check if any more results remain
     * @returns {Promise} Promise of {@link QueryResult}
     */
    query(stmt, opt) {
        return promisified(this, this._query, stmt, opt);
    }

    /**
     * This API is equivalent to {@link NoSQLClient#query} and is more
     * convenient to use when the result set is big and must be returned over
     * multiple requests.  This can be done calling {@link NoSQLClient#query}
     * multiple times and using continuation key but it may be more convenient
     * and natural to use {@link BatchCursor} returned by this API.
     * <br>
     * Note that this API is synchronous and the actual query does not start
     * until {@link BatchCursor#next} is called for the first time, see
     * {@link BatchCursor}.  For details on the query operation,
     * see {@link NoSQLClient#query}.
     * @ignore
     * @param {string|PreparedStatement} stmt Query statement, same as for
     * {@link NoSQLClient#query}
     * @param {object} [opt] Options object.  All options are same as for
     * {@link NoSQLClient#query}, except that no <em>continuationKey</em> is
     * needed (if it is set in <em>opt</em>, <em>continuationKey</em> will be
     * ignored)
     * @returns {BatchCursor} BatchCursor object.  BatchCursor retrieves many
     * records at a time by making query requests.  See {@link BatchCursor}
     */
    cursor(stmt, opt) {
        return new BatchCursor(this, stmt, opt);
    }

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
     * Alternatively, if <em>opt.complete</em> is set to true, this API will
     * complete (i.e. the returned <em>Promise</em> will resolve) only
     * when the operation is completed.  This is equivalent to sequentially
     * executing {@link NoSQLClient#adminDDL} and
     * {@link NoSQLClient#forCompletion}.  In this case, <em>opt.timeout</em>
     * covers the whole time interval until operation completion.
     * Accordingly, if not specified, <em>opt.timeout</em> will default to
     * the sum of {@link Config}#ddlTimeout and
     * {@link Config}#adminPollTimeout.  You may also use <em>opt.delay</em>
     * to specify polling delay (see {@link NoSQLClient#forCompletion}).
     * <p>
     * Note that some of the statements used by admin DDL may contain
     * passwords in which case it is advisable to pass the statement as
     * <em>Buffer</em> so that the memory can be subsequently cleared by the
     * application.  The <em>Buffer</em> should contain the statement as
     * UTF-8 encoded string.
     * @async
     * @param {Buffer|string} stmt Statement for the operation as string or
     * Buffer containing UTF-8 encoded string
     * @param {object} [opt] Options object, see below
     * @param {number} [opt.timeout] Timeout for the operation in
     * milliseconds.  Defaults to {@link Config}#ddlTimeout (or to
     * {@link Config}#ddlTimeout + {@link Config}#adminPollTimeout if
     * <em>opt.complete</em> is true)
     * @param {boolean} [opt.complete] If set to true, the returned
     * <em>Promise</em> will only resolve when the operation is completed
     * @param {number} [opt.delay] If <em>opt.complete</em> is true, specifies
     * delay between successive polls while waiting for operation completion.
     * Defaults to {@link Config}#adminPollDelay.  Has no effect if
     * <em>opt.complete</em> is not enabled
     * @returns {Promise} Promise of {@link AdminResult}
     * @see {@link AdminResult}
     * @see {@link NoSQLClient#forCompletion}
     */
    adminDDL(stmt, opt) {
        const req = {
            api: this.adminDDL,
            stmt,
            opt
        };
        return opt != null && opt.complete ?
            this._withCompletion(ops.AdminDDLOp, req) :
            this._execute(ops.AdminDDLOp, req);
    }

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
     * @param {object} [opt] Options object, see below
     * @param {object} [opt.timeout]  Timeout for the operation in
     * milliseconds, defaults to {@link Config}#timeout
     * @returns {Promise} Promise of {@link AdminResult}
     * @see {@link NoSQLClient#adminDDL}
     * @see {@link AdminResult}
     */
    adminStatus(adminResult, opt) {
        return this._adminStatus({
            api: this.adminStatus,
            adminResult,
            opt
        });
    }

    /**
     * Asynchronously waits for DDL operation completion.
     * <p>
     * DDL operations are operations initiated by {@link NoSQLClient#tableDDL}
     * and {@link NoSQLClient#adminDDL} (the latter on-premise only).  These
     * are potentially long-running operations and the results returned by
     * {@link NoSQLClient#tableDDL} or {@link NoSQLClient#adminDDL} do not
     * imply operation completion.  {@link NoSQLClient#forCompletion} takes
     * the result of either operation as an argument and completes (i.e. the
     * returned <em>Promise</em> resolves) when the corresponding operation
     * is completed by the service.  This is accomplished by polling the
     * operation state at specified intervals using
     * {@link NoSQLClient#getTable} for table DDL operations and
     * {@link NoSQLClient#adminStatus} for admin DDL operations.
     * <p>
     * For table DDL operations initiated by {@link NoSQLClient#tableDDL} this
     * method asynchronously waits for state {@link TableState.ACTIVE} for all
     * operations except "DROP TABLE", in the latter case asynchronously
     * waiting for {@link TableState.DROPPED}.
     * <p>
     * The result of this method is {@link TableResult} or {@link AdminResult}
     * representing the state of the operation at the last poll.  If the
     * operation fails, this method will result in error (i.e. the returned
     * <em>Promise</em> will reject with error) contaning information about
     * the operation failure.
     * <p>
     * Note that on operation completion, the passed {@link TableResult} or
     * {@link AdminResult} is modified in place (to reflect operation
     * completion) in addition to being returned.
     * <p>
     * As a more convenient way to perform DDL operations to completion, you
     * may pass <em>opt.complete</em> to {@link NoSQLClient#tableDDL} or
     * {@link NoSQLClient#adminDDL}.  In this case, after DDL operation is
     * initiated, these methods will internally use
     * {@link NoSQLClient#forCompletion} to await operation completion.
     * @example // Using forCompletion
     * try {
     *     let res = await client.tableDDL('DROP TABLE.....');
     *     await client.forCompletion(res);
     *     res = await client.adminDDL('CREATE NAMESPACE.....');
     *     await client.forCompletion(res);
     * } catch(err) {
     *     // May be caused by client.forCompletion() if long running DDL
     *     // operation was unsuccessful.
     * }
     * @async
     * @param {TableResult|AdminResult} res Result of
     * {@link NoSQLClient#tableDDL} or {@link NoSQLClient#adminDDL}.  This
     * result is modified by this method on operation completion.
     * @param {object} [opt] Options object, see below
     * @param {string} [opt.compartment] Cloud service only. Compartment id
     * or name to use for this operation. Defaults to
     * {@link Config}#compartment. See {@link Config}#compartment for more
     * information
     * @param {number} [opt.timeout] Timeout in milliseconds, i.e. how
     * long to keep polling for operation completion.  Defaults to
     * {@link Config}#tablePollTimeout for table DDL operations or to
     * {@link Config}#adminPollTimeout for admin DDL operations
     * @param {number} [opt.delay] Delay in milliseconds between
     * successive polls, determines how often the polls are performed.
     * Defaults to {@link Config}#tablePollDelay for table DDL operations or
     * to {@link Config}#adminPollDelay for admin DDL operations
     * @returns {Promise} Promise of {@link TableResult} or
     * {@link AdminResult}, which is the object passed as first argument and
     * modified to reflect operation completion
     * @see {@link NoSQLClient#tableDDL}
     * @see {@link NoSQLClient#getTable}
     * @see {@link TableResult}
     * @see {@link NoSQLClient#adminDDL}
     * @see {@link NoSQLClient#adminStatus}
     * @see {@link AdminResult}
     */
    forCompletion(res, opt) {
        return this._forCompletion(res, opt);
    }

    /**
     * On-premise only.
     * <p>
     * Returns the namespaces in the store as an array of strings.  If no
     * namespaces are found, empty array is returned.
     * <p>
     * This operation entails executing admin DDL and waiting for operation
     * completion.  Thus you may pass options used by
     * {@link NoSQLClient#adminDDL} method.
     * @async
     * @param {object} opt Options object.  May include all options used by
     * {@link NoSQLClient#adminDDL} except <em>opt.complete</em> which is
     * already implied
     * @returns {Promise} Promise of string[] of namespace names
     * @see {@link NoSQLClient#adminDDL}
     */
    listNamespaces(opt) {
        return this._listNamespaces(opt);
    }

    /**
     * On-premise only.
     * <p>
     * Returns the users in the store as an array of {@link UserInfo}.  If no
     * users are found, empty array is returned.
     * <p>
     * This operation entails executing admin DDL and waiting for operation
     * completion.  Thus you may pass options used by
     * {@link NoSQLClient#adminDDL} method.
     * @async
     * @param {object} opt Options object.  May include all options used by
     * {@link NoSQLClient#adminDDL} except <em>opt.complete</em> which is
     * already implied
     * @returns {Promise} Promise of {@link UserInfo}[] of objects containing
     * information about each user
     * @see {@link UserInfo}
     * @see {@link NoSQLClient#adminDDL}
     */
    listUsers(opt) {
        return this._listUsers(opt);
    }

    /**
     * On-premise only.
     * <p>
     * Returns the roles in the store as an array of strings.  If no
     * roles are found, empty array is returned.
     * <p>
     * This operation entails executing admin DDL and waiting for operation
     * completion.  Thus you may pass options used by
     * {@link NoSQLClient#adminDDL} method.
     * @async
     * @param {object} opt Options object.  May include all options used by
     * {@link NoSQLClient#adminDDL} except <em>opt.complete</em> which is
     * already implied
     * @returns {Promise} Promise of string[] of role names
     * @see {@link NoSQLClient#adminDDL}
     */
    listRoles(opt) {
        return this._listRoles(opt);
    }

}

/**
 * NoSQLClient error event.
 *
 * Emitted when any {@link NoSQLClient} method results in error.  This event
 * is not emitted when automatic retries are performed, only when the error is
 * final.
 * <p>
 * Also mote that this event will not be emitted if it has no listeners, so it
 * is not necessary to subscribe to it.
 *
 * @event NoSQLClient#error
 * @param {NoSQLError} err Error of type NoSQLError or one of its subclasses
 * @param {Operation} op Object describing operation that
 * caused the error, see {@link Operation}
 */

/**
 * NoSQLClient retryable event.
 *
 * Emitted when error from {@link NoSQLClient} operation will result in
 * automatic retry of operation.  It will be emitted on each subsequent retry.
 * @see {@link RetryConfig} for explanation of retries
 *
 * @event NoSQLClient#retryable
 * @param {NoSQLError} err Error of type NoSQLError or one of its subclasses
 * that caused the retry
 * @param {Operation} op Object describing operation that caused the error,
 * see {@link Operation}
 * @param {number} numRetries Number of retries performed so far for this
 * operation, not counting the original API invokation or the retry about to
 * be performed
 */

/**
 * NoSQLClient consumedCapacity event.
 *
 * Emitted by {@link NoSQLClient} method calls that return
 * {@link ConsumedCapacity} as part of their result.  These methods include
 * all data manipulation and query methods.  This event may be used to
 * calculate relevant statistsics.
 *
 * @event NoSQLClient#consumedCapacity
 * @param {ConsumedCapacity} consumedCapacity Capacity consumed by the method
 * call, {@link ConsumedCapacity}
 * @param {Operation} op Object describing operation that returned this consumed
 * capacity, see {@link Operation}
 */

/**
 * NoSQLClient tableState event.
 *
 * Emitted by {@link NoSQLClient} method calls that return table state as part
 * of their result, such as {@link NoSQLClient#getTable},
 * {@link NoSQLClient#tableDDL} and {@link NoSQLClient#setTableLimits} and
 * also while table is polled waiting for DDL operation completion using
 * {@link NoSQLClient#forCompletion}.  Can be used to perform actions on a
 * table reaching certain state.  Note that this event may be emitted mutliple
 * times even while the table state did not change.
 *
 * @event NoSQLClient#tableState
 * @param {string} tableName Table name
 * @param {TableState} tableState Current table state, see {@link TableState}
 */

module.exports = NoSQLClient;
