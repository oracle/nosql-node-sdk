/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const con = require('./lib/constants');
const dur = require('./lib/durability');
const err = require('./lib/error');

exports.NoSQLClient =require('./lib/nosql_client');
exports.PreparedStatement = require('./lib/stmt').PreparedStatement;
exports.ServiceType = con.ServiceType;
exports.Region = require('./lib/region');
exports.Consistency = con.Consistency;
exports.CapacityMode = con.CapacityMode;
exports.ReplicaAckPolicy = dur.ReplicaAckPolicy;
exports.Durabilities =  dur.Durabilities;
exports.SyncPolicy = dur.SyncPolicy;
exports.ScanDirection = con.ScanDirection;
exports.TableState = con.TableState;
exports.AdminState = con.AdminState;
exports.StatsLevel = con.StatsLevel;
exports.ErrorCode = require('./lib/error_code');
exports.NoSQLError = err.NoSQLError;
exports.NoSQLArgumentError = err.NoSQLArgumentError;
exports.NoSQLProtocolError = err.NoSQLProtocolError;
exports.NoSQLUnsupportedProtocolError = err.NoSQLUnsupportedProtocolError;
exports.NoSQLNetworkError = err.NoSQLNetworkError;
exports.NoSQLServiceError = err.NoSQLServiceError;
exports.NoSQLTimeoutError = err.NoSQLTimeoutError;
exports.NoSQLAuthorizationError = err.NoSQLAuthorizationError;
exports.NoSQLQueryError = err.NoSQLQueryError;
exports.TTLUtil = require('./lib/ttl_util');
exports.IAMAuthorizationProvider = require('./lib/auth/iam/auth_provider');
exports.KVStoreAuthorizationProvider =
    require('./lib/auth/kvstore/auth_provider');
