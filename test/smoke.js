/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const util = require('util');
const nosqldb = require('../index');
const ErrorCode = nosqldb.ErrorCode;
const TableState = nosqldb.TableState;
const TestConfig = require('./utils').TestConfig;

//If argv[2] not provided, defaults to cloudsim
const config = process.argv[2];

async function async_smoke() {
    let client;
    try {
        client = await TestConfig.createNoSQLClient(config);
        process.stdout.write('NoSQLClient: ');
        console.log(client);
        let res;
        try {
            res = await client.tableDDL(
                'CREATE TABLE items(id INTEGER, name STRING, price number, ' +
                'PRIMARY KEY(id))', { tableLimits: {
                    readUnits: 1,
                    writeUnits: 5,
                    storageGB: 1
                }});
            process.stdout.write('tableDDL: ');
            console.log('tableDDL: ' + util.inspect(res));
            await client.forCompletion(res);
            console.log('forCompletion: ' + util.inspect(res));
        } catch(err) { //table exists
            if (err.errorCode == ErrorCode.TABLE_EXISTS) {
                console.log('Table already exists');
                res = await client.forTableState('items', TableState.ACTIVE);
                console.log('forTableState: ' + util.inspect(res));
            } else {
                throw err;
            }
        }
        res = await client.put('items', { id: 1, name: 'item1', price: '1.1'});
        console.log('put: ' + util.inspect(res));
        res = await client.put('items', { id: 2, name: 'item2', price: '1.2'});
        console.log('put: ' + util.inspect(res));
        res = await client.put('items', { id: 3, name: 'item3'});
        console.log('put: ' + util.inspect(res));
        res = await client.get('items', { id: 1});
        console.log('get: ' + util.inspect(res));
        res = await client.get('items', { id: 2});
        console.log('get: ' + util.inspect(res));
        res = await client.get('items', { id: 3});
        console.log('get: ' + util.inspect(res));
        res = await client.delete('items', { id: 2});
        console.log('delete: ' + util.inspect(res));
        res = await client.get('items', { id: 2 });
        console.log('get: ' + util.inspect(res));
        console.log(`row exists: ${res.row != null}`);
        res = await client.tableDDL('DROP TABLE items');
        console.log('tableDDL: ' + util.inspect(res));
        res = await client.forCompletion(res);
        console.log('forCompletion: ' + util.inspect(res));
    } catch(err) {
        console.log(err.stack);
        for(let cause = err.cause; cause; cause = cause.cause) {
            console.log('Caused by -->');
            console.log(cause.stack);
        }
    } finally {
        if (client) {
            client.close();
        }
    }
}

async_smoke();
