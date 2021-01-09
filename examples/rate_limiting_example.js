/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

/**
 * A simple program to demonstrate how to enable and use rate limiting.
 *
 * This example should only be run against CloudSim, as the on-premise
 * Oracle NoSQL database currently does not report read/write throughput
 * used by rate limiting logic.
 *
 * This example could be used with the cloud service, but it generates a
 * significant amount of data, which may use up your resources.
 * 
 * This example does the following:
 * 1) Create the table.
 * 2) Do bunch of put operations continuously for set period of time.  Collect
 * usage statistics and display it together with expected limits.
 * 3) Do the same for get operations.
 * 4) Drop the table.
 */

'use strict';

const fs = require('fs');

const nosqldb = require('oracle-nosqldb');

const NoSQLClient = nosqldb.NoSQLClient;

// Target table used by this example
const TABLE_NAME = 'AudienceData';

// Usage: rate_limiting_example.js [<config file>]

async function rateLimitingExample() {
    let client;
    try {
        // JSON config file path is an optional parameter.  If not specified,
        // it is assumed we are using Oracle Cloud Service where credentials
        // are supplied in default OCI configuration file (~/.oci/config)
        // using default profile (DEFAULT).
        const configFile = process.argv[2];

        // In order to enable rate limiting, rateLimiter property should be
        // set in the initial config.  In this example, we assume that the
        // config file may not necessarily have this property so we parse
        // and read the config file and set rateLimiter property if it was not
        // set.
        const config = JSON.parse(fs.readFileSync(configFile));
        if (config.rateLimiter == null) {
            Object.assign(config, {
                rateLimiter: true
            });
        }

        client = new NoSQLClient(config);
        console.log('Created NoSQLClient instance');

        await run(client);
        console.log('Success!');
    } catch (err) {
        console.error('  Error: ' + err.message);
        if (err.operation) {
            console.error('  from: ');
            console.error(err.operation);
        }
    } finally {
        if (client) {
            client.close();
        }
    }
}



async function run(client) {
    // Create the table
    const createDDL = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} \
(id LONG, data STRING, PRIMARY KEY(id))`;
    console.log('Create table ' + TABLE_NAME);
    let res = await client.tableDDL(createDDL, {
        tableLimits: {
            readUnits: 50,
            writeUnits: 50,
            storageGB: 50
        }
    });

    // Wait for the operation completion
    await client.forCompletion(res);
    console.log('  Table %s is created', res.tableName);


    // Create records of random sizes
    const minSize = 100;
    const maxSize = 10000;

    // Do a bunch of write ops, verify our usage matches limits
    await doRateLimitedOps(client,
        15, // seconds
        true, // writes
        50, // WUs limit
        2000, // maxRows
        minSize,
        maxSize);

    // Do a bunch of read ops, verify our usage matches limits
    await doRateLimitedOps(client,
        15, // seconds
        false, // reads
        50, // RUs limit
        2000, // maxRows
        minSize,
        maxSize);

    // Drop the table
    console.log('\nDrop table');
    const dropDDL = `DROP TABLE IF EXISTS ${TABLE_NAME}`;
    res = await client.tableDDL(dropDDL);

    // Wait for the table to be removed
    await client.forCompletion(res);
    console.log('  Operation completed');
}

/**
 * Runs puts and gets continuously for N seconds.
 *
 * Verify that the resultant RUs/WUs used match the
 * given rate limits.
 */
async function doRateLimitedOps(client, numSeconds, doWrites, limit, maxRows,
    minSize, maxSize) {
    // Generate a string of maxSize with all "x"s in it
    const userData = doWrites ? 'x'.repeat(maxSize) : null;

    const startTime = Date.now();
    const endTime = startTime + (numSeconds * 1000);

    console.log(`Running continuous ${doWrites ? 'writes' : 'reads'}' for \
${numSeconds} seconds`);

    // Keep track of how many units we used
    let unitsUsed = 0;

    // With rate limiting enabled, we can find the amount of time our
    // operation was delayed due to rate limiting by getting the value
    // from the result using getRateLimitDelayedMs().
    let delayMs = 0;
    
    // Total count of read or write operations
    let opCount = 0;
    
    do {
        let id = Math.floor(Math.random() * maxRows);
        if (doWrites) {
            const recSize = minSize +
                Math.floor(Math.random() * (maxSize - minSize));
            const pRes = await client.put(TABLE_NAME, {
                id,
                data: userData.substring(0, recSize)
            });
            unitsUsed += pRes.consumedCapacity.writeUnits;
            delayMs += pRes.consumedCapacity.writeRateLimitDelay;
        } else {
            const gRes = await client.get(TABLE_NAME, { id });
            unitsUsed += gRes.consumedCapacity.readUnits;
            delayMs += gRes.consumedCapacity.readRateLimitDelay;
        }
        opCount++;
    } while (Date.now() < endTime);

    numSeconds = (Date.now() - startTime) / 1000;

    unitsUsed = unitsUsed / numSeconds;

    console.log(`${doWrites ? 'Writes' : 'Reads'}: average usage = \
${unitsUsed.toFixed(3)} ${doWrites ? 'WUs' : 'RUs'} \
(expected around ${limit})`);

    console.log(`Total operations performed: ${opCount}`);
    console.log(`Total rate limiter delay time = ${delayMs.toFixed(3)} ms`);
}

rateLimitingExample();
