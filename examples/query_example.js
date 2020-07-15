/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

/*
 * A simple example that uses Oracle NoSQL Database Cloud service.
 *   - create a table 
 *   - create an index
 *   - insert several rows
 *   - prepare and use queries
 *   - drop the table
 *
 * To run against the cloud simulator:
 *   node query_example.js cloudsim.json
 *
 * To run against the cloud service
 *   node query_example.js config.json
 */

'use strict';

const nosqldb = require('oracle-nosqldb');

const NoSQLClient = nosqldb.NoSQLClient;

// target table used by this example
const TABLE_NAME = 'users';

/*
* Usage: query_example.js [<config file>]
*/
async function queryExample() {
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
        console.error('  from: ');
        console.error(err.operation);
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
    let ddl = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} \
(id INTEGER, name STRING, userInfo JSON, PRIMARY KEY(id))`;

    console.log('Create table ' + TABLE_NAME);
    let res = await client.tableDDL(ddl, {
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

    ddl = `CREATE INDEX IF NOT EXISTS city_idx ON ${TABLE_NAME} \
(userInfo.city AS STRING)`;

    console.log('\nCreate index city_idx on %s', TABLE_NAME);
    res = await client.tableDDL(ddl);
    console.log('  Creating index city_idx');
    console.log('  Table state: %s', res.tableState.name);

    // Wait for the operation completion
    await client.forCompletion(res);
    console.log('  Index city_idx is active');

    // Write some records
    res = await client.put(TABLE_NAME, {
        id: 10,
        name: 'Taylor',
        userInfo: {
            age: 79,
            city: 'Seattle'
        }
    });
    res = await client.put(TABLE_NAME, {
        id: 33,
        name: 'Xiao',
        userInfo: {
            age: 5,
            city: 'Shanghai'
        }
    });
    res = await client.put(TABLE_NAME, {
        id: 49,
        name: 'Supriya',
        userInfo: {
            age: 16,
            city: 'Bangalore'
        }
    });
    res = await client.put(TABLE_NAME, {
        id:55,
        name: 'Rosa',
        userInfo: {
            age: 39,
            city: 'Seattle'
        }
    });

    // Find user with id 49 with a simple query
    let statement = `SELECT * FROM ${TABLE_NAME} WHERE id = 49`;
    console.log('\nUse a simple query: %s', statement);
    await runQuery(client, statement);

    // Find all the Seattle dwellers with a prepared statement
    statement = `DECLARE $city STRING; SELECT * FROM ${TABLE_NAME} u WHERE \
u.userInfo.city = $city`;
    console.log(`\nUse a prepared statement: '${statement}'`);
    const preparedStmt = await client.prepare(statement);
    const city = 'Seattle';
    console.log('  Set variable $city to "%s" in prepared statement', city);
    preparedStmt.set('$city', city);
    // We limit number of rows to 1 in each query invocation to illustrate
    // the use of the continuation key
    await runQuery(client, preparedStmt, 1);

    // Drop the table
    console.log('\nDrop table');
    ddl = `DROP TABLE ${TABLE_NAME}`;
    res = await client.tableDDL(ddl);
    console.log('  Dropping table %s', res.tableName);

    // Wait for the table to be removed
    await client.forCompletion(res);
    console.log('  Table state is %s', res.tableState.name);
}

/*
 * Execute a query and print the results.  Optional limit parameter is used to
 * limit the results of each query API invocation to that many rows.
 */
async function runQuery(client, stmt, limit) {
    const opt = { limit };
    let res;
    console.log('Query results:');
    do {
        // Issue the query
        res = await client.query(stmt, opt);

        // Each call to NoSQLClient.query returns a portion of the
        // result set. Iterate over the result set, using the
        // QueryResult.continuationKey in the query's option parameter,
        // until the result set is exhausted and continuation key is
        // null.
        for(let row of res.rows) {
            console.log('  %O', row);
        }

        opt.continuationKey = res.continuationKey;
    } while(res.continuationKey != null);
}

queryExample();
