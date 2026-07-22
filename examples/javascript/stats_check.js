/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const path = require('path');
const NoSQLDB = require('../..');
const NoSQLClient = NoSQLDB.NoSQLClient;
const StatsControl = NoSQLDB.StatsControl;

function loadConfig(configFile, statsHandler) {
    const cfg = Object.assign({}, require(path.resolve(configFile)));
    cfg.statsProfile = cfg.statsProfile || StatsControl.Profile.MORE;
    cfg.statsEnableLog = false;
    cfg.statsHandler = statsHandler;
    return cfg;
}

async function run() {
    const configFile = process.argv[2] || 'examples/config/kvlite.json';
    let stats;
    let client;

    try {
        client = new NoSQLClient(loadConfig(configFile, snapshot => {
            stats = snapshot;
        }));
        await client.listTables();
    } catch(err) {
        console.error(err);
    } finally {
        if (client != null) {
            await client.close();
        }
        if (stats != null) {
            console.log(JSON.stringify(stats, null, 2));
        }
    }
}

run().catch(err => {
    console.error(err);
    process.exit(1);
});
