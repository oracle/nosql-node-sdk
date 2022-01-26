/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const Op = require('./op');
const table = require('./table');
const admin = require('./admin');
const dml = require('./dml');
const query = require('./query');

module.exports = {
    Op,
    GetOp: dml.GetOp,
    PutOp: dml.PutOp,
    DeleteOp: dml.DeleteOp,
    MultiDeleteOp: dml.MultiDeleteOp,
    WriteMultipleOp: dml.WriteMultipleOp,
    TableDDLOp: table.TableDDLOp,
    TableLimitsOp: table.TableLimitsOp,
    GetTableOp: table.GetTableOp,
    TableUsageOp: table.TableUsageOp,
    GetIndexesOp: table.GetIndexesOp,
    ListTablesOp: table.ListTablesOp,
    PrepareOp: query.PrepareOp,
    QueryOp: query.QueryOp,
    PollTableOp: table.PollTableOp,
    AdminDDLOp: admin.AdminDDLOp,
    AdminStatusOp: admin.AdminStatusOp,
    AdminPollOp: admin.AdminPollOp,
    ccAsObj: Op.ccAsObj
};
