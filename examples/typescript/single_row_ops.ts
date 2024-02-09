/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

import assert = require("assert");
import Decimal from "decimal.js";

import { NoSQLClient, Consistency, GetResult, PutResult, DeleteResult }
    from "oracle-nosqldb";

import { TABLE_NAME, runExample } from "./setup";
import { PurchaseOrder, printConsumedCapacity, printPutOrDeleteOpResult }
    from "./common";

function printGetResult(res: GetResult<PurchaseOrder>): void {
    printConsumedCapacity(res.consumedCapacity);
    if (res.row) {
        console.log("Got row:");
        console.log(res.row);
        if (res.expirationTime) {
            console.log("Expiration time: %o", res.expirationTime);
        }
        if (res.modificationTime) {
            console.log("Last modification time: %o",
            res.modificationTime);
        }
    } else {
        console.log("Row does not exist");
    }
    console.log();
}

function printPutResult(res: PutResult<PurchaseOrder>) {
    printConsumedCapacity(res.consumedCapacity);
    printPutOrDeleteOpResult(res);
}

function printDeleteResult(res: DeleteResult<PurchaseOrder>) {
    printConsumedCapacity(res.consumedCapacity);
    printPutOrDeleteOpResult(res);
}

async function singleRowOps(client: NoSQLClient): Promise<void> {
    // Get the row for order id 10001
    console.log("Getting order 10001");
    let pk10001 = { // primary key for order 10001
        seller: "Amazon",
        orderId: 10001
    };

    let getRes = await client.get<PurchaseOrder>(TABLE_NAME, pk10001);
    printGetResult(getRes);

    // Modify the order: update street address, add one more item
    assert(getRes.row, "Missing row for order 10001");
    let order: PurchaseOrder = getRes.row;
    order.shipAddress.street += " Apt. 200";
    order.items.push({
        id: 2346,
        name: "Snickers",
        price: new Decimal(123)
    });

    // Update the order in the Orders table
    console.log("Updating order 10001");
    let putRes = await client.put<PurchaseOrder>(TABLE_NAME, order);
    printPutResult(putRes);
    assert(putRes.success, "Unconditional put failed");

    // Set time-to-live for the order
    console.log("Updating order 10001 with TTL of 5 hours");
    putRes = await client.put<PurchaseOrder>(TABLE_NAME, order,
        { ttl: { hours: 5 }});
    printPutResult(putRes);
    assert(putRes.success, "Unconditional put failed");
    
    // Retrieve the order again and check expiration time, use absolute
    // consistency.
    console.log("Getting order 10001 using absolute consistency");
    getRes = await client.get<PurchaseOrder>(TABLE_NAME, pk10001, {
        consistency: Consistency.ABSOLUTE
    });
    printGetResult(getRes);

    // Update the ship date for the order
    assert(getRes.row, "Missing row for order 10001");
    order = getRes.row;
    order.shipDate.setDate(order.shipDate.getDate() + 1);

    // Try to update the order using putIfAbsent, it should fail.  Use option
    // to return existing row in case of failure.
    console.log("Updating order 10001 via putIfAbsent, should fail");
    putRes = await client.putIfAbsent(TABLE_NAME, order, {
        returnExisting: true
    });
    printPutResult(putRes);
    assert(!putRes.success, "putIfAbsent for order 10001 succeeded, but \
should have failed");

    // Update the order using putIfPresent, should succeed
    console.log("Updating order 10001 via putIfPresent, should succeed");
    putRes = await client.putIfPresent(TABLE_NAME, order);
    printPutResult(putRes);
    assert(putRes.success, "putIfPresent for order 10001 failed");

    // Create a new order
    order = {
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

    // Insert the new order via putIfAbsent
    console.log("Inserting order 10011 via putIfAbsent, should succeed");
    putRes = await client.putIfAbsent(TABLE_NAME, order);
    printPutResult(putRes);
    assert(putRes.success, "putIfAbsent for order 10011 failed");

    // Save the row version
    assert(putRes.success, "Failed to insert new order 10011");
    assert(putRes.version, "Missing version for order 10001");
    const rowVer = putRes.version;

    // Add new items to the order
    order.items.push({
        id: 13004,
        name: "Shelf assembly",
        price: new Decimal(300)
    });

    // Update the order using putIfVersion, should succeed
    console.log("Updating order 10011 via putIfVersion, should succeed");
    putRes = await client.putIfVersion(TABLE_NAME, order, rowVer);
    printPutResult(putRes);
    assert(putRes.success, "putIfVersion for order 10011 failed");

    // Save the new row version
    assert(putRes.success, "Failed to create new order 10011");
    assert(putRes.version, "Missing version for order 10001");
    const newRowVer = putRes.version;

    // Try to update the order using putIfVersion with old version,
    // this should fail, since the old version is no longer valid.
    console.log("Updating order 10011 via putIfVersion with old row version, \
should fail");
    putRes = await client.putIfVersion(TABLE_NAME, order, rowVer);
    printPutResult(putRes);
    assert(!putRes.success, "putIfVersion for order 10011 succeded, but \
should have failed");

    // Update the order using putIfVersion with new version, should succeed
    console.log("Updating order 10011 via putIfVersion, should succeed");
    putRes = await client.putIfVersion(TABLE_NAME, order, newRowVer);
    printPutResult(putRes);
    assert(putRes.success, "putIfVersion for order 10011 failed");

    // Delete order 10011
    const pk10011 = {
        seller: "Lowes",
        orderId: 10011
    };
    console.log("Deleting order 10011");
    let delRes = await client.delete<PurchaseOrder>(TABLE_NAME, pk10011);
    printDeleteResult(delRes);
    assert(delRes.success, "Unconditional delete failed");

    console.log("Getting order 10011, should be null");
    getRes = await client.get(TABLE_NAME, pk10011);
    printGetResult(getRes);
    assert(!getRes.row, "Found order 10011 after deletion");

    // Re-insert order 10011
    console.log("Re-inserting order 10011");
    putRes = await client.put(TABLE_NAME, order);
    printPutResult(putRes);
    assert(putRes.success, "Unconditional put failed");

    // Try to delete order 10011 via deleteIfVersion using old version, this
    // should fail. Use option to return existing row.
    console.log("Deleting order 10011 via deleteIfVersion with old version, \
should fail");
    delRes = await client.deleteIfVersion(TABLE_NAME, pk10011, rowVer, {
        returnExisting: true
    });
    printDeleteResult(delRes);
    assert(!delRes.success, "deleteIfVersion succeeded for row 10011, but \
should have failed");

    // Delete order 10011 via deleteIfVersion using row version from last put,
    // should succeed.
    assert(putRes.version, "Missing row version for order 10011");
    delRes = await client.deleteIfVersion(TABLE_NAME, pk10011,
        putRes.version);
    printDeleteResult(delRes);
    assert(delRes.success, "deleteIfVersion failed for order 10011");

    console.log("Getting order 10011, should be null");
    getRes = await client.get(TABLE_NAME, pk10011);
    printGetResult(getRes);
    assert(!getRes.row, "Found order 10011 after deletion");
}

runExample(singleRowOps, false, true);
