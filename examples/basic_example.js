/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

/*
 * A simple example that
 *   - creates a table
 *   - inserts a row using the put() operation
 *   - reads a row using the get() operation
 *   - drops the table
 *
 * To run against the cloud simulator:
 *     node basic_example.js cloudsim.json
 *
 * To run against the cloud service:
 *     node basic_example.js config.json
 */
'use strict';

const nosqldb = require('oracle-nosqldb');

const NoSQLClient = nosqldb.NoSQLClient;

// Target table used by this example
const TABLE_NAME = 'BasicExample';

// Usage: basic_example.js [<config file>]

async function basicExample() {
    let client;
    try {
        // JSON config file path is an optional parameter.  If not specified,
        // it is assumed we are using Oracle Cloud Service where credentials
        // are supplied in default OCI configuration file (~/.oci/config)
        // using default profile (DEFAULT).
        let configFile = process.argv[2];
        client = new NoSQLClient(configFile);
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

/*
 * Create a table, read and write a record
 */
async function run(client) {
    const createDDL = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} \
(cookie_id LONG, audience_data JSON, PRIMARY KEY(cookie_id))`;
    console.log('Create table ' + TABLE_NAME);
    let res = await client.tableDDL(createDDL, {
        tableLimits: {
            readUnits: 1,
            writeUnits: 5,
            storageGB: 1
        }
    });
    console.log('  Creating table %s', res.tableName);
    console.log('  Table state: %s', res.tableState.name);

    // Wait for the operation completion
    await client.forCompletion(res);
    console.log('  Table %s is created', res.tableName);
    console.log('  Table state: %s', res.tableState.name);

    // Write a record
    console.log('\nWrite a record');
    res = await client.put(TABLE_NAME, {
        cookie_id: 456,
        audience_data: {
            ipaddr: '10.0.00.yyy',
            audience_segment: {
                sports_lover: '2019-01-05',
                foodie: '2018-12-31'
            }
        }
    });
    if (res.consumedCapacity) {
        console.log('  Write used: %O', res.consumedCapacity);
    }

    // Read a record
    console.log('\nRead a record');
    res = await client.get(TABLE_NAME, { cookie_id: 456 });
    console.log('  Got record: %O', res.row);
    if (res.consumedCapacity) {
        console.log('  Read used: %O', res.consumedCapacity);
    }

    // Drop the table
    console.log('\nDrop table');
    const dropDDL = `DROP TABLE ${TABLE_NAME}`;
    res = await client.tableDDL(dropDDL);
    console.log('  Dropping table %s', res.tableName);

    // Wait for the table to be removed
    await client.forCompletion(res);
    console.log('  Operation completed');
    console.log('  Table state is %s', res.tableState.name);
}

basicExample();
