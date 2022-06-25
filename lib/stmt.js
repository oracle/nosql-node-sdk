/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const isPosInt = require('./utils').isPosInt;
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
 * {@link NoSQLClient#query} and {@link NoSQLClient#queryIterable} methods for
 * execution and be reused for multiple queries, potentially with different
 * values of bind variables.
 * <p>
 * You may share an instance of {@link PreparedStatements} by queries running
 * async-concurrently, e.g. queries invoked concurrently by different async
 * functions.  This is referred to as async-safety:
 * <br>
 * An instance of {@link PreparedStatement} is async-safe if bind variables
 * are not used.  If bind variables are used, it is not async-safe.  In this
 * case, you can construct additional instances of {@link PreparedStatement}
 * using {@link PreparedStatement#copyStatement} method in order to share it
 * among async-concurrent queries.
 * @extends {PrepareResult}
 * @hideconstructor
 */
class PreparedStatement {

    /**
     * Sets and gets the bindings object explicitly.  Bindings object is an
     * object which properties contain the bind variables for this prepared
     * statement.  For each variable, binding object has property which name
     * is the variable name and the value is the variable value.  Note that
     * "$" in the variable name is included in its property name.  For
     * positional variables, the names are determined by the query engine.
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
     * Binds a variable to use for the query.  The variable can be identified
     * either by its name or its position.
     * <p>
     * To bind by name, pass a name of the variable as it was declared in
     * <em>DECLARE</em> statement of the query.
     * <p>
     * You can also bind a variable by its position within the query string.
     * The positions start at 1. The variable that appears first in the query
     * text has position 1, the variable that appears second has position 2
     * and so on.  Binding by position is useful for queries where bind
     * variables identified by "?" are used instead of named variables (but it
     * can be used for both types of variables).
     * <p>
     * Existing variables with the same name or position are silently
     * overwritten. The names, positions and types are validated when the
     * query is executed.
     * 
     * @example // Using PreparedStatement, binding variables by name.
     * let client = new NoSQLClient(//.....
     * let prepStmt = await client.prepare(
     *     'DECLARE $id INTEGER; $sal DOUBLE;  SELECT id, firstName, lastName ' +
     *     'FROM Emp WHERE id <= $id AND salary <= $sal');
     * ps.set('$id', 1100);
     *   .set('$sal', 100500);
     * for await(const res of client.queryIterable(stmt)) {
     * //.....
     * }
     * ps.set('$id', 2000);
     * for await(const res of client.queryIterable(stmt)) {
     * //.....
     * }
     * //.....
     * @example // Binding variables by position.
     * let prepStmt = await client.prepare(
     *     'SELECT id, firstName, lastName FROM Emp WHERE ' + 
     *     'id <= ? AND salary <= ?');
     * ps.set(1, 1100)
     *   .set(2, 100500);
     * //.....
     * @param {string|number} nameOrPosition Name or position of the variable
     * @param {FieldValue} val Value of the variable of the appropriate type
     * @returns {PreparedStatement} This instance for chaining
     * @throws {NoSQLArgumentError} If binding by position and the position is
     * invalid.
     */
    set(nameOrPosition, val) {
        if (!this._bindings) {
            this._bindings = {};
        }

        let key = nameOrPosition;
        if (typeof key === 'number') {
            if (!isPosInt(key)) {
                throw new NoSQLArgumentError(
                    `Invalid bind variable position: ${key}`);
            }
            if (this._varNames == null) {
                key = '#' + key;
            } else {
                if (key > this._varNames.length) {
                    throw new NoSQLArgumentError(`Invalid bind variable \
position: ${key}, exceeds total ${this._varNames.length}`);
                }
                key = this._varNames[key];
            }
        }

        this._bindings[key] = val;
        return this;
    }

    /**
     * Clears all variables in bindings for this prepared statement.
     * @returns {PreparedStatement} This instance for chaining
     */
    clearAll() {
        delete this._bindings;
        return this;
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

    /**
     * Returns a copy of this prepared statement without its variables.
     * <p>
     * This method returns a new instance of {@link PreparedStatement} that
     * shares this object's prepared query, which is immutable, but does not
     * share its variables.  Use this method when you need to execute the same
     * prepared query async-concurrently (call this method to create a new copy
     * for each additional concurrent query).
     * @returns {PreparedStatement} A copy of this prepared statement without
     * its variables
     */
    copyStatement() {
        const res = Object.assign({ __proto__: PreparedStatement.prototype },
            this);
        delete res._bindings;
        return res;
    }
}

module.exports = {
    PreparedStatement
};
