/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

import assert = require("assert");
import fs = require("fs");

import { NoSQLClient, Config, NoSQLError, ServiceType } from "oracle-nosqldb";
import { Decimal } from "decimal.js";
import type { PurchaseOrder } from "./common";

// Augment the oracle-nosqldb module to allow Decimal instances to be used as
// field values.

declare module "oracle-nosqldb" {
    interface CustomFieldTypes {
        dbNumber: Decimal;
    }
}

export const TABLE_NAME = "ExampleTableOrders";

export async function createOrdersTable(client: NoSQLClient,
    createIndexes: boolean): Promise<void> {
    const tableDDL = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} (\
seller STRING, orderId LONG, customerName STRING, shipAddress JSON, \
shipDate TIMESTAMP(3), items ARRAY(JSON), PRIMARY KEY(SHARD(seller),
orderId)) USING TTL 30 DAYS`;
    
    console.log(`Creating table ${TABLE_NAME}`);
    let res = await client.tableDDL(tableDDL, {
        tableLimits: {
            readUnits: 5,
            writeUnits: 3,
            storageGB: 1
        }
    });

    await client.forCompletion(res);
    console.log(`Created table ${TABLE_NAME}`);

    if (!createIndexes) {
        return console.log();
    }

    console.log("Creating index custNameIdx");
    res = await client.tableDDL(`CREATE INDEX IF NOT EXISTS custNameIdx on \
${TABLE_NAME}(customerName)`, { complete: true });
    console.log("Created index custNameIdx");

    console.log("Creating index shipDateIdx");
    res = await client.tableDDL(`CREATE INDEX IF NOT EXISTS shipDateIdx on \
${TABLE_NAME}(shipDate)`, { complete: true});
    console.log("Created index shipDateIdx");

    console.log("Creating index shipCityIdx");
    res = await client.tableDDL(`CREATE INDEX IF NOT EXISTS shipCityIdx on \
${TABLE_NAME}(shipAddress.city AS STRING)`, { complete: true });
    console.log("Created index shipCityIdx");

    console.log("Creating index itemPriceIdx");
    res = await client.tableDDL(`CREATE INDEX IF NOT EXISTS itemPriceIdx on \
${TABLE_NAME}(items[].price AS NUMBER)`, { complete: true });
    console.log("Created index itemPriceIdx");

    console.log();
}

export async function populateOrdersTable(client: NoSQLClient):
    Promise<void> {
    for(const row of INITIAL_ROWS) {
        const res = await client.put(TABLE_NAME, row);
        console.log("Inserted row: %o", row);
    }
    console.log();
}

export async function dropOrdersTable(client: NoSQLClient): Promise<void> {
    console.log(`Dropping table ${TABLE_NAME}`);
    const res = await client.tableDDL(`DROP TABLE IF EXISTS ${TABLE_NAME}`);
    await client.forCompletion(res);
    console.log(`Dropped table ${TABLE_NAME}`);
}

export async function runExample(
    example: (client: NoSQLClient) => Promise<void>,
    createIndexes: boolean,
    populateTable: boolean) {
    let client: NoSQLClient | undefined;
    try {
        // If JSON config file is not specified, we assume Cloud Service with
        // credentials and region specified in the default OCI config file.
        const cfg: Config = process.argv[2] ?
            JSON.parse(fs.readFileSync(process.argv[2], 'utf8')) : {
                serviceType: ServiceType.CLOUD
            };
        // We modify config to add dbNumber property in case it was not set
        // in the JSON config file.
        cfg.dbNumber = Decimal;

        client = new NoSQLClient(cfg);

        await createOrdersTable(client, createIndexes);
        if (populateTable) {
            await populateOrdersTable(client);
        }
        await example(client);
        await dropOrdersTable(client);
    } catch(err) {
        assert(err instanceof Error, `Invalid error thrown: ${err}`);
        console.error("  Error: %s", err.message);
        if (err instanceof NoSQLError) {
            if (err.cause) {
                console.error("  Caused by: %s", err.cause.message);
            }
            if (err.operation) {
                console.error('  from: ');
                console.error(err.operation);
            }
        }
    } finally {
        if (client) {
            client.close();
        }
    }
}

export const INITIAL_ROWS: PurchaseOrder[] = [
    {
        seller: "Amazon",
        orderId: 10001,
        customerName: "John",
        shipAddress: {
            street: "100 some street",
            city: "Redwood City"
        },
        shipDate: new Date("2023-05-17T09:30:00Z"),
        items: [
            {
                id: 1001,
                name: "Headphones",
                price: new Decimal(21.20)
            },
            {
                id: 2345,
                name: "T-shirt",
                price: new Decimal(14.99)
            }
        ]
    },
    {
        seller: "Amazon",
        orderId: 10002,
        customerName: "Joane",
        shipAddress: {
            street: "101 some street",
            city: "San Francisco"
        },
        shipDate: new Date("2023-05-17T10:30:00Z"),
        items: [
            {
                id: 1002,
                name: "HDMI cable",
                price: new Decimal(7.99)
            },
            {
                id: 2346,
                name: "Hat",
                price: new Decimal(25.99)
            }
        ]
    },
    {
        seller: "Walmart",
        orderId: 10003,
        customerName: "Jack",
        shipAddress: {
            street: "101 some street",
            city: "Dublin"
        },
        shipDate: new Date("2023-05-17T09:32:00Z"),
        items: [
            {
                id: 1002,
                name: "Sweater",
                price: new Decimal(19.00)
            }
        ]
    },
    {
        seller: "Amazon",
        orderId: 10004,
        customerName: "Jane",
        shipAddress: {
            street: "102 some street",
            city: "Dublin"
        },
        shipDate: new Date("2023-05-18T05:00:00Z"),
        items: [
            {
                id: 11002,
                name: "Laptop",
                price: new Decimal(750.00)
            },
            {
                id: 2346,
                name: "Keyboard",
                price: new Decimal(20.00)
            },
            {
                id: 1002,
                name: "HDMI cable",
                price: new Decimal(7.99)
            }
        ]
    },
    {
        seller: "Amazon",
        orderId: 10005,
        customerName: "Joane",
        shipAddress: {
            street: "101 some street",
            city: "San Francisco"
        },
        shipDate: new Date("2023-05-10T05:00:00Z"),
        items: [
            {
                id: 11002,
                name: "Shoes",
                price: new Decimal(49.99)
            },
            {
                id: 2346,
                name: "Snack bars",
                price: new Decimal(10.89)
            }
        ]
    },
    {
        seller: "Amazon",
        orderId: 10006,
        customerName: "Joane",
        shipAddress: {
            street: "101 some street",
            city: "Redwood City"
        },
        shipDate: new Date("2023-05-10T06:00:00Z"),
        items: [
            {
                id: 12002,
                name: "Laptop",
                price: new Decimal(1500)
            }
        ]
    },
    {
        seller: "Walmart",
        orderId: 10007,
        customerName: "Jack",
        shipAddress: {
            street: "101 some street",
            city: "Dublin"
        },
        shipDate: new Date("2023-05-10T07:00:00Z"),
        items: [
            {
                id: 12003,
                name: "Curtains",
                price: new Decimal(85.99)
            },
            {
                id: 12004,
                name: "Office chair",
                price: new Decimal(129.01)
            },
            {
                id: 12005,
                name: "Kitchen table",
                price: new Decimal(399.80)
            },
            {
                id: 12006,
                name: "Table cloth",
                price: new Decimal(30.00)
            }
        ]
    },
    {
        seller: "Amazon",
        orderId: 10008,
        customerName: "Susan",
        shipAddress: {
            street: "101 some street",
            city: "Redwood City"
        },
        shipDate: new Date("2023-05-11T01:00:00Z"),
        items: [
            {
                id: 12004,
                name: "Office chair",
                price: new Decimal(129.01)
            }
        ]
    },
    {
        seller: "Toyota",
        orderId: 10009,
        customerName: "Susan",
        shipAddress: {
            street: "101 some street",
            city: "Redwood City"
        },
        shipDate: new Date("2023-05-12T08:00:00Z"),
        items: [
            {
                id: 200,
                name: "Toyota Camry",
                price: new Decimal(32100.00)
            }
        ]
    },
    {
        seller: "Amazon",
        orderId: 10010,
        customerName: "Joane",
        shipAddress: {
            street: "101 some street",
            city: "San Francisco"
        },
        shipDate: new Date("2023-05-14T10:30:00Z"),
        items: [
            {
                id: 12007,
                name: "iPad",
                price: new Decimal(999.01)
            },
            {
                id: 12010,
                name: "Windows Desktop",
                price: new Decimal(599.00)
            }
        ]
    }
];
