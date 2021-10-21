/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

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

module.exports = {
    PreparedStatement
};
