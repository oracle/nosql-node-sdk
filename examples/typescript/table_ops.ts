/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

import assert = require("assert");

import { NoSQLClient, CapacityMode, ServiceType, NoSQLError, ErrorCode }
    from "oracle-nosqldb";

import { TABLE_NAME, runExample } from "./setup";

async function doGetTable(client: NoSQLClient): Promise<void> {
    // Get Orders table
    console.log("Getting table information for table %s", TABLE_NAME);
    let tableRes = await client.getTable(TABLE_NAME);
    
    console.log("Got the following information:");
    
    if (client.serviceType !== ServiceType.KVSTORE) {
        console.log("Compartment id: %s", tableRes.compartmentId);
        if (client.serviceType === ServiceType.CLOUD) {
            console.log("Table OCID: %s", tableRes.tableOCID);
        }
    } else {
        console.log("Namespace: %s", tableRes.namespace);
    }

    console.log("Table name: %s", tableRes.tableName);
    console.log("Table state: %s", tableRes.tableState);
    
    if (tableRes.tableDDL) {
        console.log("Table DDL: %s", tableRes.tableDDL);
    }

    if (client.serviceType !== ServiceType.KVSTORE) {
        assert(tableRes.tableLimits, "Missing table limits");
        console.log("Table limits:");
        console.log("  Capacity mode: %s", tableRes.tableLimits.mode);
        if (tableRes.tableLimits.mode === CapacityMode.PROVISIONED) {
            console.log("  Read units: %d", tableRes.tableLimits.readUnits);
            console.log("  Write units: %d", tableRes.tableLimits.writeUnits);
        }
        console.log("  Storage: %d GB", tableRes.tableLimits.storageGB);
    }

    if (client.serviceType === ServiceType.CLOUD) {
        if (tableRes.etag) {
            console.log("Table ETag: %s", tableRes.etag as string);
        }
        if (tableRes.definedTags) {
            console.log("Defined tags: %o", tableRes.definedTags);
        }
        if (tableRes.freeFormTags) {
            console.log("Free-form tags: %o", tableRes.freeFormTags);
        }
    }

    console.log();
}

async function doSetTableLimits(client: NoSQLClient): Promise<void> {
    // Change table limits
    console.log("Changing table limits");
    const tableRes = await client.setTableLimits(TABLE_NAME, {
        readUnits: 4,
        writeUnits: 2,
        storageGB: 1
    });
    console.log("Changed table limits, table state id %s",
        tableRes.tableState);
    await client.forCompletion(tableRes, { delay: 500 });
    console.log("Operation completed, table state is %s",
        tableRes.tableState);

    console.log();
}

async function doGetIndexes(client: NoSQLClient) {
    // Get indexes of the Orders table
    console.log("Getting indexes of %s", TABLE_NAME);
    const indexRes = await client.getIndexes(TABLE_NAME, );
    console.log("Table %s has following indexes:", TABLE_NAME);

    for(const index of indexRes) {
        // Note that elements in fieldTypes array are only defined for JSON
        // fields that are explicitly typed.
        const fieldSpecs = index.fields.map((fieldName, idx) =>
            !index.fieldTypes || !index.fieldTypes[idx] ?
                fieldName : `${fieldName} AS ${index.fieldTypes[idx]}`);
        console.log("%s(%s)", index.indexName, fieldSpecs.join(", "));
    }

    // Drop index itemPriceIdx
    const indexName = "itemPriceIdx";
    console.log("\nDROPPING INDEX %s", indexName);
    const tableRes = await client.tableDDL(
        `DROP INDEX ${indexName} ON ${TABLE_NAME}`);
    console.log("Table state: %s", tableRes.tableState);
    await client.forCompletion(tableRes);
    console.log("Index dropped, table state: %s", tableRes.tableState);

    // Try to retrieve the dropped index itemPriceIdx, we should get
    // INDEX_NOT_FOUND error.
    try {
        const index = await client.getIndex(TABLE_NAME, "itemPriceIdx");
        // We should not reach this point.
        assert(false, `Got index result for non-existent index ${indexName}`);
    } catch(err) {
        if (!(err instanceof NoSQLError) ||
            err.errorCode !== ErrorCode.INDEX_NOT_FOUND) {
            throw err;
        }
        console.log("Index %s no longer exists", indexName);
    }

    console.log();
}

async function doTableUsage(client: NoSQLClient): Promise<void> {
    // get table usage
    console.log("Getting table usage records");
    const usageRes = await client.getTableUsage(TABLE_NAME, {
        startTime: Date.now() - 300000, // starting 5 minutes ago
        limit: 3 // maximum of 3 records
    });

    if (!usageRes.usageRecords.length) {
        console.log("No usage records found.");
    } else {
        console.log("Got table usage records:\n");
        for(const usageRecord of usageRes.usageRecords) {
            console.log("Start time: %o", usageRecord.startTime);
            console.log("Seconds in period: %d",
                usageRecord.secondsInPeriod);
            console.log("Read units: %d", usageRecord.readUnits);
            console.log("Write units: %d", usageRecord.writeUnits);
            console.log("Storage: %d GB", usageRecord.storageGB);
            console.log("Read throttle count: %d",
                usageRecord.readThrottleCount);
            console.log("Write throttle count: %d",
                usageRecord.writeThrottleCount);
            console.log("Storage throttle count: %d",
                usageRecord.storageThrottleCount);
            console.log("Max shard usage: %d%%",
                usageRecord.maxShardUsagePercent);
            console.log();            
        }
    }    
}

async function tableOps(client: NoSQLClient): Promise<void> {
    // List tables
    console.log("Listing tables");
    const listRes = await client.listTables();
    console.log("Found the following tables: %s", listRes.tables.join(", "));
    console.log();

    await doGetTable(client);

    // setTableLimits is not supported on-premises
    if (client.serviceType !== ServiceType.KVSTORE) {
        await doSetTableLimits(client);
    }

    await doGetIndexes(client);

    // getTableUsage is not supported on-premises
    if (client.serviceType !== ServiceType.KVSTORE) {
        await doTableUsage(client);
    }
}

runExample(tableOps, true, false);
