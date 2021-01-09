/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const NoSQLArgumentError = require('./error').NoSQLArgumentError;

/**
 * Defines classes related to SQL statement and query execution such as
 * {@link PreparedStatement}.
 */

/**
 * @classdesc  A class encapsulating a prepared query statement. It includes
 * state that can be sent to a server and executed without re-parsing the
 * query. It includes bind variables which may be set for each successive use
 * of the query.  PreparedStatement object is returned as a result of
 * {@link NoSQLClient#prepare} method.  It can be passed to
 * {@link NoSQLClient#query} method for execution and be reused for multiple
 * queries, potentially with different values of bind variables.
 * @extends {PrepareResult}
 * 
 * @hideconstructor
 * 
 * @example //Using PreparedStatement in async function
 * let client = new NoSQLClient(//.....
 * let prepStmt = await this._client.prepare(
 *     'DECLARE $id INTEGER; $sal DOUBLE;  SELECT id, firstName, lastName ' +
 *     'FROM Emp WHERE id <= $id AND salary <= $sal');
 * ps.set('$id', 1100);
 * ps.set('$sal', 100500);
 * let queryRes = await client.query(prepStmt);
 * //.....
 * ps.set('$id', 2000);
 * queryRes = await client.query(prepStmt);
 * //.....
 */
class PreparedStatement {

    /**
     * Sets and gets the bindings object explicitly.  Bindings object is an
     * object which properties contain the bind variables for this prepared
     * statement.  For each variable, binding object has property which name
     * is the variable name and the value is the variable value.  Note that
     * "$" in the variable name is included in its property name.
     * @type {object}
     * @example //Setting bindings
     * prepStmt.bindings = {
     *     $id: 100,
     *     $name: 'John'
     * };
     * //This is equivalent to:
     * prepStmt.set('$id', 100);
     * prepStmt.set('$name', 'John');
     */
    set bindings(value) {
        this._bindings = value;
    }

    get bindings() {
        return this._bindings;
    }

    /**
     * Sets the named variable in the bindings to use for the query.  Existing
     * variables with the same name are silently overwritten. The names and
     * types are validated when the query is executed.
     * @param {string} name Name of the variable 
     * @param {FieldValue} val Value of the variable of the appropriate type
     * for this variable
     */
    set(name, val) {
        if (!this._bindings) {
            this._bindings = {};
        }
        this._bindings[name] = val;
    }

    /**
     * Clears all variables in bindings for this prepared statement.
     */
    clearAll() {
        delete this._bindings;
    }

    /**
     * SQL text of this prepared statement.
     * @type {string}
     * @readonly
     */
    get sql() {
        return this._sql;
    }

    /**
     * Query execution plan printout if was requested by
     * {@link NoSQLClient#prepare} (see <em>opt.getQueryPlan</em>), undefined
     * otherwise.
     * @type {string}
     * @readonly
     */
    get queryPlan() {
        return this._queryPlanStr;
    }
}

/**
 * @ignore
 * @classdesc This class allows convenient iteration over results of a query
 * which has big result set such that the results have to be returned over
 * multiple query requests.  This is equivalent to calling
 * {@link NoSQLClient#query} method multiple times and using continuation key,
 * see {@link NoSQLClient#query}.  BatchCursor is returned by
 * {@link NoSQLClient#cursor} method.  The query starts executing when
 * {@link BatchCursor#next} method is called for the first time.  The result
 * returned by {@link BatchCursor#next} is of type {@link QueryResult},
 * same as the result of {@link NoSQLClient#query} method and generally
 * contains multiple records returned by one query request.
 * <p>
 * Note that BatchCursor object can only be used to fetch results of one query
 * and cannot be reused for multiple queries.  To execute another query, call
 * {@link NoSQLClient#cursor} again to create new BatchCursor.
 * 
 * @hideconstructor
 * 
 * @example //Using BatchCursor in async function
 * let client = new NoSQLClient(//.....
 * let prepStmt = await this._client.prepare(//.....
 * //.....
 * let cursor = client.cursor(prepStmt);
 * while(cursor.hasNext()) {
 *     let res = await cursor.next();
 *     console.log(`Retrieved ${res.rows.length} rows`);
 *     //Do something with res.rows
 * }
 * prepStmt.set(//.....
 * //.....
 * cursor = client.cursor(); //start another query
 * //.....
 */
class BatchCursor {
    constructor(client, stmt, opt) {
        this._client = client;
        this._stmt = stmt;
        if (typeof opt === 'object') {
            this._opt = Object.assign({}, opt);
            delete this._opt.continuationKey;    
        } else {
            //to make sure we later throw if opt is not an object
            this._opt = opt;
        }
        this._first = true;
    }

    /**
     * Returns whether query has more results.  This method is synchronous.
     * Note that it is possible for this method to return true and
     * nevertheless the query has no more results.  In this case, the
     * subsequent call to {@link BatchCursor#next} will result in
     * [QueryResult.rows]{@link QueryResult}#rows being empty array.
     * This could happen in couple of cases:
     * 1) If result set of this query is empty.
     * 2) If number of result rows remaining was exactly the same as were
     * allowed to be fetched due to limit or capacity restrictions, see
     * <em>continuationKey</em> parameter of {@link NoSQLClient#query} for
     * explanation.
     * @returns {boolean} Whether query has more results
     */
    hasNext() {
        return this._first || this._opt.continuationKey != null;
    }

    /**
     * Fetches the next batch of results as {@link QueryResult}.
     * If this method is called after {@link BatchCursor#hasNext} returned
     * false, it will result in error.
     * @async
     * @returns {Promise} Promise of {@link QueryResult}
     */
    async next() {
        if (!this.hasNext()) {
            throw new NoSQLArgumentError('This cursor has no more records');
        }
        const res = await this._client._query(this._stmt, this._opt);
        this._first = false;
        this._opt.continuationKey = res.continuationKey;
        return res;
    }
}

module.exports = {
    PreparedStatement,
    BatchCursor
};
