/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

import assert = require("assert");
import Decimal from "decimal.js";

import { NoSQLClient, PreparedStatement, QueryOpt, Consistency, AnyRow }
    from "oracle-nosqldb";

import { TABLE_NAME, populateOrdersTable, runExample } from "./setup";
import { PurchaseOrder, printConsumedCapacity, printPutOrDeleteOpResult }
    from "./common";

async function doQuery<TRow extends AnyRow>(client: NoSQLClient,
    stmt: string | PreparedStatement, opt?: QueryOpt) {
    
    // SQL statement
    const sql = stmt instanceof PreparedStatement ? stmt.sql : stmt;
    console.log("Executing SQL Query: %s", sql);
    
    if (stmt instanceof PreparedStatement && stmt.bindings &&
        Object.keys(stmt.bindings).length) {
        console.log("With the following bindings: %o", stmt.bindings);
    }

    console.log();

    let foundResults = false;
    for await(const res of client.queryIterable<TRow>(stmt, opt)) {
        // It is possible that some iterations may return 0 rows
        if (!res.rows.length) {
            continue;
        }
        if (!foundResults) {
            foundResults = true;
            console.log("Query results:");
        }
        for(const row of res.rows) {
            console.log(row);
        }
    }

    if (!foundResults) {
        console.log("No results found");
    }

    console.log();
}

async function multiRowQueryOps(client: NoSQLClient) {
    console.log("Getting selected order details in the order of ship date");
    await doQuery<Pick<PurchaseOrder,
        "orderId"|"customerName"|"shipAddress"|"shipDate">>(client,
            `SELECT orderId, customerName, shipAddress, shipDate FROM \
${TABLE_NAME} ORDER BY shipDate`);

    console.log("Getting latest ship date for each customer");
    await doQuery<{ name: string, lastShipDate: Date }>(client,
        `SELECT customerName AS name, max(shipDate) AS lastShipDate FROM \
${TABLE_NAME} GROUP BY customerName ORDER BY max(shipDate)`);

    // Get orders that have item with price at least given amount. Use
    // prepared statement and bind variable to set the amount.
    console.log("Getting orders that have items with price above given \
threshold");
    let sql = `SELECT * FROM ${TABLE_NAME} t WHERE EXISTS \
t.items[$element.price >= ?]`;
    console.log("Preparing SQL statement: %s", sql);
    let prepStmt = await client.prepare(sql);

    console.log("Setting threshold of 30000, should get one order");
    prepStmt.set(1, new Decimal(30000));
    await doQuery<PurchaseOrder>(client, prepStmt);

    console.log("Setting threshold of 500, should get one 4 orders");
    prepStmt.set(1, 500);
    // Use limit option.  This will limit the number of results retrieved in
    // each iteration in doQuery and will require more iterations, but will
    // deliver the same results.
    await doQuery<PurchaseOrder>(client, prepStmt, {
        limit: 2
    });

    console.log("Getting total price of orders for given customer that ship \
before given date");
    sql = `DECLARE $name STRING; $date TIMESTAMP(3); SELECT t.orderId AS \
orderId, seq_sum(t.items[].price) AS total FROM ${TABLE_NAME} t WHERE \
t.customerName = $name AND t.shipDate < $date`;
    console.log("Preparing SQL statement: %s", sql);
    // Pass option to get back the query result schema
    prepStmt = await client.prepare(sql, { getResultSchema: true });
    console.log("Statement prepared, result schema: %s",
        prepStmt.resultSchema);
    
    // Bind variables by name
    prepStmt.set("$name", "Joane").set("$date",
        new Date("2023-05-17T23:00:00Z"));
    // Should return 2 records.
    await doQuery<{ orderId: number, total: Decimal }>(client, prepStmt);
    prepStmt.clearAll();

    console.log("Getting customer with the highest overall purchase amount");
    await doQuery<{ name: string, total: Decimal }>(client,
        `SELECT t.customerName AS name, sum(seq_sum(t.items[].price)) AS \
total FROM ${TABLE_NAME} t GROUP BY t.customerName ORDER BY \
sum(seq_sum(t.items[].price)) DESC LIMIT 1`, {
        consistency: Consistency.ABSOLUTE
    });

    console.log("Deleting orders that have items priced greater than given \
amount");
    sql = `DELETE FROM ${TABLE_NAME} t WHERE EXISTS \
t.items[$element.price > ?] RETURNING orderId AS id, customerName as name,
seq_sum(t.items[].price) AS total`;
    console.log("Preparing SQL statement: %s", sql);
    prepStmt = await client.prepare(sql);

    prepStmt.set(1, new Decimal(1000));
    console.log("Expecting to delete orders 10006 and 10009");
    await doQuery<{ id: number, name: string, total: Decimal }>(client,
        prepStmt);
}

// For single row SELECT, INSERT/UPSERT, UPDATE and DELETE statements where
// the query fully specifies the primary key, it is sufficient to execute
// the query in one request (via query) and no need for iteration
// (via queryIterable or query with continuation key). 

async function singleRowQueryOps(client: NoSQLClient): Promise<void> {
    const order = {
        seller: "Lowes",
        orderId: 10011,
        customerName: "Jack",
        shipAddress: {
            street: "101 some street",
            city: "Dublin"
        },
        shipDate: new Date("2023-05-10T07:00:00Z"),
        items: [
            {
                id: 13003,
                name: "Microwave",
                price: new Decimal(120.02)
            }
        ]
    };

    console.log("Creating order 10011 via SQL INSERT statement");
    let prepStmt = await client.prepare(`INSERT INTO ${TABLE_NAME} \
VALUES(?, ?, ?, ?, ?, ?)`);
    prepStmt.set(1, order.seller);
    prepStmt.set(2, order.orderId);
    prepStmt.set(3, order.customerName);
    prepStmt.set(4, order.shipAddress);
    prepStmt.set(5, order.shipDate);
    prepStmt.set(6, order.items);
    
    console.log("Executing SQL statement: %s", prepStmt.sql);
    console.log("With bindings: %o", prepStmt.bindings);
    
    // Here we did not use the type parameter to query, so the result is
    // untyped.
    let qRes = await client.query(prepStmt);
    assert(!qRes.continuationKey,
        "Got continuation key for single-row insert");
    assert(qRes.rows.length === 1, `Unexpected number of results from INSERT \
query: ${qRes.rows.length}`);
    printConsumedCapacity(qRes.consumedCapacity);
    console.log("INSERT completed, result: %o", qRes.rows[0]);
    console.log();

    console.log("Getting order 10011 via SQL SELECT statement");
    let sql = `SELECT * FROM ${TABLE_NAME} WHERE seller = '${order.seller}' \
AND orderId = ${order.orderId}`;
    console.log("Executing SQL statement: %s", sql);
    qRes = await client.query<PurchaseOrder>(sql);
    assert(!qRes.continuationKey,
        "Got continuation key for single-row select");
    assert(qRes.rows.length === 1, `Unexpected number of results from \
single-row SELECT query: ${qRes.rows.length}`);
    printConsumedCapacity(qRes.consumedCapacity);
    console.log("Query returned: %o", qRes.rows[0]);
    console.log();

    console.log("Updating order 10011, changing city via UPDATE statement");
    prepStmt = await client.prepare(`UPDATE ${TABLE_NAME} t SET \
t.shipAddress.city = ? WHERE t.seller = ? AND t.orderId = ? RETURNING \
t.orderId AS orderId, t.shipAddress.city AS city`);
    console.log("Prepared SQL statement: %s", prepStmt.sql);
    
    prepStmt.set(1, "Pleasanton");
    prepStmt.set(2, order.seller);
    prepStmt.set(3, order.orderId);

    console.log("Executing UPDATE query with bindings: %o",
        prepStmt.bindings);
    qRes = await client.query<{ orderId: number, city: string }>(prepStmt);
    assert(!qRes.continuationKey,
        "Got continuation key for single-row update");
    assert(qRes.rows.length === 1, `Unexpected number of results from \
single-row UPDATE query: ${qRes.rows.length}`);
    printConsumedCapacity(qRes.consumedCapacity);
    console.log("Query returned: %o", qRes.rows[0]);
    console.log();
    
    // Update the city again, other bind variables stay the same
    prepStmt.set(1, "Redwood Shores");

    console.log("Executing UPDATE query again with bindings: %o",
        prepStmt.bindings);
    qRes = await client.query<{ orderId: number, city: string }>(prepStmt);
    assert(!qRes.continuationKey,
        "Got continuation key for single-row update");
    assert(qRes.rows.length === 1, `Unexpected number of results from \
single-row UPDATE query: ${qRes.rows.length}`);
    printConsumedCapacity(qRes.consumedCapacity);
    console.log("Query returned: %o", qRes.rows[0]);
    console.log();

    console.log("Deleting order 10011 via DELETE statement");
    sql = `DELETE FROM ${TABLE_NAME} WHERE seller = '${order.seller}' AND \
orderId = ${order.orderId}`;
    console.log("Executing SQL statement: %s", sql);
    // Using untyped result
    qRes = await client.query(sql);
    assert(!qRes.continuationKey,
        "Got continuation key for single-row delete");
    assert(qRes.rows.length === 1, `Unexpected number of results from \
single-row DELETE query: ${qRes.rows.length}`);
    printConsumedCapacity(qRes.consumedCapacity);
    console.log("Query returned: %o", qRes.rows[0]);
    console.log();
}

runExample(async (client) => {
    await multiRowQueryOps(client);
    await singleRowQueryOps(client);
}, true, true);
