/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

import assert = require("assert");
import Decimal from "decimal.js";

import { NoSQLClient, MultiDeleteResult, RowKey, MultiDeleteOpt,
    WriteOperation, WriteMultipleResult } from "oracle-nosqldb";

import { TABLE_NAME, populateOrdersTable, runExample } from "./setup";
import { PurchaseOrder, printConsumedCapacity, printPutOrDeleteOpResult }
    from "./common";

function printMultiDeleteResult(res: MultiDeleteResult) {
    printConsumedCapacity(res.consumedCapacity);
    console.log("Deleted count: %d", res.deletedCount);
    console.log("Operation completed: %s", !res.continuationKey);
    console.log();
}

function printWriteMultipleResult(res: WriteMultipleResult<PurchaseOrder>) {
    printConsumedCapacity(res.consumedCapacity);
    if (res.results) {
        assert(!res.failedOpIndex && !res.failedOpResult,
            "Incompatible properties in WriteMultipleResult");
        console.log("Operation succeded, operation results:\n")
        for(const opRes of res.results) {
            printPutOrDeleteOpResult(opRes);
        }
    } else {
        assert(res.failedOpIndex != undefined && res.failedOpResult,
            "Missing failedOpIndex or failedOpResult for failed writeMany \
operation");
        console.log("Operation failed at operation index %d",
            res.failedOpIndex);
        console.log("Failed operation result:");
        printPutOrDeleteOpResult(res.failedOpResult);
    }
    console.log();
}

// To ensure the completion of this operation, we execute it in a loop,
// as long as the operation returns non-null continuation key.
async function doDeleteRange(client: NoSQLClient,
    partialPrimaryKey: RowKey<PurchaseOrder>, opt?: MultiDeleteOpt):
    Promise<void> {
    // Make a copy of the option object if passed.
    opt = opt ? Object.assign({}, opt, { continationKey: undefined }) : {};

    do {
        const res = await client.deleteRange<PurchaseOrder>(TABLE_NAME,
            partialPrimaryKey, opt);
        printMultiDeleteResult(res);
        opt.continuationKey = res.continuationKey;
    } while (opt.continuationKey);
}

async function deleteRangeOps(client: NoSQLClient): Promise<void> {
    // Delete all orders from Walmart, use deleteRange with partial primary
    // key.
    console.log("Deleting all Walmart orders, ids 10003 and 10007");
    await doDeleteRange(client, { seller: "Walmart" });

    // Delete all orders from Toyota, use deleteRange with partial primary
    // key.
    console.log("Deleting all Toyota orders, 1 order id 10009");
    await doDeleteRange(client, { seller: "Toyota" });

    // Delete all orders from Amazon with ids 10001 - 10004 inclusive, use
    // deleteRange with partial primary key and a field range
    console.log("Deleting all Amazon orders, ids 10001 - 10004 inclusive");
    await doDeleteRange(client, { seller: "Amazon" }, {
        fieldRange: {
            fieldName: "orderId",
            startWith: 10001,
            endWith: 10004
        }
    });

    // Delete all orders from Amazon with ids 10005 - 10008 inclusive, use
    // deleteRange with partial primary key and a field range with exclusive
    // upper bound.
    console.log("Deleting all Amazon orders, from id 10005 and \
before id 10009");
    await doDeleteRange(client, { seller: "Amazon" }, {
        fieldRange: {
            fieldName: "orderId",
            startWith: 10005,
            endBefore: 10009
        }
    });

    // Delete all orders from Amazon with ids above 10009 use deleteRange with
    /// partial primary key and a field range with exclusive lower bound.
    console.log("Deleting all Amazon orders with ids above 10009, 1 order \
id 10010");
    await doDeleteRange(client, { seller: "Amazon" }, {
        fieldRange: {
            fieldName: "orderId",
            startAfter: 10009
        }
    });

    // Now there should be no rows left. Do a simple query to verify.
    console.log("Query to verify that all rows are deleted");
    const qIter = client.queryIterable("SELECT * FROM " + TABLE_NAME);
    let rowsFound = false;
    for await(const qRes of qIter) {
        if (qRes.rows.length) {
            rowsFound = true;
        }
    }
    assert(!rowsFound, "Rows found after deletion of all rows");
    console.log("No rows found");
}

async function getOrder(client: NoSQLClient, seller: string, orderId: number):
    Promise<PurchaseOrder|null> {
    const getRes = await client.get<PurchaseOrder>(TABLE_NAME,
        { seller, orderId });
    return getRes.row ? getRes.row : null;
}

async function writeManyOps(client: NoSQLClient): Promise<void> {
    // For seller Amazon: update some existing orders, insert new order and
    // delete some orders.
    console.log("Getting orders 10001, 10002 and 10004");
    let order10001 = await getOrder(client, "Amazon", 10001);
    let order10002 = await getOrder(client, "Amazon", 10002);
    let order10004 = await getOrder(client, "Amazon", 10004);
    assert(order10001 && order10002 && order10004, "Missing one of the \
orders 10001, 10002 or 10004");
    
    // update the ship dates
    order10001.shipDate = new Date('2023-05-23');
    order10002.shipDate = new Date('2023-05-23');
    order10004.shipDate = new Date('2023-05-23');

    //create new order 10011
    let order10011: PurchaseOrder|null = {
        seller: "Amazon",
        orderId: 10011,
        customerName: "Jack",
        shipAddress: {
            street: "101 some street",
            city: "Dublin"
        },
        shipDate: new Date("2023-05-23"),
        items: [
            {
                id: 13004,
                name: "Textbook",
                price: new Decimal(79.99)
            }
        ]
    };

    // Use ifAbsent option for the new order. We will also delete orders
    // 10008 and 10010.
    const ops: WriteOperation<PurchaseOrder>[] = [
        {
            put: order10001
        },
        {
            put: order10002
        },
        {
            put: order10004
        },
        {
            put: order10011,
            ifAbsent: true
        },
        {
            delete: {
                "seller": "Amazon",
                "orderId": 10008
            }
        },
        {
            delete: {
                "seller": "Amazon",
                "orderId": 10010
            }
        }
    ];

    console.log("Executing writeMany to update orders 10001, 10002, 10004, \
10011 and delete orders 10008 and 10010");
    // Use abortOnFail option.
    let wmRes = await client.writeMany(TABLE_NAME, ops, {
        abortOnFail: true
    });
    printWriteMultipleResult(wmRes);
    assert(wmRes.results, "writeMany failed");

    // Verify the operation.
    console.log("Verifying the operation")
    order10001 = await getOrder(client, "Amazon", 10001);
    order10002 = await getOrder(client, "Amazon", 10002);
    order10004 = await getOrder(client, "Amazon", 10004);
    order10011 = await getOrder(client, "Amazon", 10011);
    const order10008 = await getOrder(client, "Amazon", 10008);
    const order10010 = await getOrder(client, "Amazon", 10010);

    assert(order10001 && order10002 && order10004 && order10011,
        "Missing one of the orders 10001, 10002, 10004 or 10011");
    console.log("Order 10001: %o", order10001);
    console.log("Order 10002: %o", order10002);
    console.log("Order 10004: %o", order10004);
    console.log("Order 10011: %o", order10011);

    assert(!order10008 && !order10010,
        "Order 10008 or 10010 was not deleted");
    console.log("Orders 10008 and 10010 no longer exist");

    // Update orders 10001, 10002, 10004 again, this time using putMany.
    const newItem = {
        id: 14000,
        name: "Light Bulbs",
        price: new Decimal(10.99)
    };
    order10001.items.push(newItem);
    order10002.items.push(newItem);
    order10004.items.push(newItem);

    console.log("Executing putMany to update orders 10001, 10002 and 10004");
    wmRes = await client.putMany<PurchaseOrder>(TABLE_NAME,
        [ order10001, order10002, order10004 ]);
    printWriteMultipleResult(wmRes);
    assert(wmRes.results, "putMany failed");

    console.log("Verifying the operation")
    order10001 = await getOrder(client, "Amazon", 10001);
    order10002 = await getOrder(client, "Amazon", 10002);
    order10004 = await getOrder(client, "Amazon", 10004);
    assert(order10001 && order10002 && order10004, "Missing one of the \
orders 10001, 10002 or 10004");
    console.log("Order 10001: %o", order10001);
    console.log("Order 10002: %o", order10002);
    console.log("Order 10004: %o", order10004);

    // Try putMany with ifAbsent and abortOnFail on existing row, it should
    // fail.
    console.log("Executing putMany with ifAbsent on existing row, it should \
fail");
    wmRes = await client.putMany(TABLE_NAME, [ order10011 ], {
        ifAbsent: true,
        abortOnFail: true
    });
    printWriteMultipleResult(wmRes);
    assert(wmRes.failedOpResult, "putMany succeeded when it should have \
failed");

    // Delete orders 10004 and 10006 via deleteMany
    console.log("Deleting orders 10004 and 10006 via deleteMany");
    wmRes = await client.deleteMany(TABLE_NAME, [
        { seller: "Amazon", orderId: 10004 },
        { seller: "Amazon", orderId: 10006 }
    ]);
    printWriteMultipleResult(wmRes);
    assert(wmRes.results, "deleteMany failed");

    // Verify that the rows were deleted
    console.log("Verifying the operation");
    order10004 = await getOrder(client, "Amazon", 10004);
    const order10006 = await getOrder(client, "Amazon", 10006);
    assert(!order10004 && !order10006,
        "Failed to delete order 10004 or 100006");
    console.log("Orders 10004 and 10006 no longer exist");
}

runExample(async (client) => {
    await deleteRangeOps(client);
    // repopulate the table
    await populateOrdersTable(client);
    await writeManyOps(client);
}, false, true);
