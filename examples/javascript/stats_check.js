/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const path = require('path');
const NoSQLClient = require('../..').NoSQLClient;

function loadConfig(configFile) {
    const cfg = Object.assign({}, require(path.resolve(configFile)));
    cfg.statsProfile = cfg.statsProfile || 'MORE';
    return cfg;
}

async function run() {
    const configFile = process.argv[2] || 'examples/config/kvlite.json';
    let client;

    try {
        client = new NoSQLClient(loadConfig(configFile));
        await client.listTables();
    } catch(err) {
        console.error(err);
    } finally {
        if (client != null) {
            const stats = client.getStats();
            console.log(JSON.stringify(stats, null, 2));
            await client.close();
        }
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
