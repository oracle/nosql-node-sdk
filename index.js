/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const con = require('./lib/constants');
const err = require('./lib/error');

module.exports = {
    NoSQLClient: require('./lib/nosql_client'),
    PreparedStatement: require('./lib/stmt').PreparedStatement,
    ServiceType: con.ServiceType,
    Region: require('./lib/region'),
    Consistency: con.Consistency,
    ScanDirection: con.ScanDirection,
    TableState: con.TableState,
    AdminState: con.AdminState,
    ErrorCode: err.ErrorCode,
    NoSQLError: err.NoSQLError,
    NoSQLArgumentError: err.NoSQLArgumentError,
    NoSQLProtocolError: err.NoSQLProtocolError,
    NoSQLNetworkError: err.NoSQLNetworkError,
    NoSQLServiceError: err.NoSQLServiceError,
    NoSQLTimeoutError: err.NoSQLTimeoutError,
    NoSQLAuthorizationError: err.NoSQLAuthorizationError,
    NoSQLQueryError: err.NoSQLQueryError,
    TTLUtil: require('./lib/ttl_util')
};
