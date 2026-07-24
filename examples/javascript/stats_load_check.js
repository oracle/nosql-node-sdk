/*-
 * Copyright (c) 2018, 2026 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const path = require('path');
const NoSQLDB = require('../..');
const NoSQLClient = NoSQLDB.NoSQLClient;
const StatsControl = NoSQLDB.StatsControl;

const DEFAULT_CONFIG = 'examples/config/kvlite.json';
const DEFAULT_TOTAL = 1000000;
const DEFAULT_CONCURRENCY = 100;
const DEFAULT_PROGRESS_MS = 5000;
const OPERATIONS = [
    'listTables',
    'get',
    'put',
    'delete',
    'multiDelete',
    'writeMultiple',
    'prepare',
    'getTable',
    'query',
    'basicFlow',
    'fullFlow'
];
const WRITE_ACTIONS = [ 'put', 'delete' ];
const FLOW_OPERATIONS = [ 'basicFlow', 'fullFlow' ];

function usage() {
    console.log(`Usage:
  node examples/javascript/stats_load_check.js [options]

Options:
  --config <file>         Config file. Default: ${DEFAULT_CONFIG}
                         Use examples/config/cloudsim.json for CloudSim.
                         Use examples/config/kvlite.json for KV proxy/KVLite.
  --total <number>        Total requests. Default: ${DEFAULT_TOTAL}
  --concurrency <number>  Number of concurrent workers. Default: ${DEFAULT_CONCURRENCY}
  --profile <profile>     Stats profile: REGULAR, MORE, or ALL. Default: MORE
  --operation <name>      ${OPERATIONS.join(', ')}. Default: listTables
  --progress-ms <number>  Progress print interval. Default: ${DEFAULT_PROGRESS_MS}
  --table <name>          Table name for data/table operations
  --key <field=value>     Primary key component. Repeat for composite keys
  --row <field=value>     Row field for put/writeMultiple. Repeat for rows
  --write-action <name>   writeMultiple action: put or delete. Default: put
  --query <sql>           SQL text for query/prepare

basicFlow creates the table if needed and runs Table, GetTable, Put, Get,
Query, and Delete once per flow. If --total is omitted, basicFlow runs once.
fullFlow creates and drops a temporary <table>_FullFlow_<i> table and runs
Table, GetTable, Put, Get, insert query, select query, Delete, and drop Table.
If --total is omitted, fullFlow runs once.

Values may use {i}, replaced with the zero-based request index.

Examples:
  node examples/javascript/stats_load_check.js --total 1000000 --concurrency 100
  node examples/javascript/stats_load_check.js --operation get --table Users --key id=1
  node examples/javascript/stats_load_check.js --operation get --table Orders --key orderId=1 --key lineId=2
  node examples/javascript/stats_load_check.js --operation put --table Users --row id={i} --row name=user-{i}
  node examples/javascript/stats_load_check.js --operation delete --table Users --key id={i}
  node examples/javascript/stats_load_check.js --operation multiDelete --table Users --key tenantId=1
  node examples/javascript/stats_load_check.js --operation writeMultiple --table Users --write-action put --row id={i} --row name=user-{i}
  node examples/javascript/stats_load_check.js --operation prepare --query "SELECT * FROM users"
  node examples/javascript/stats_load_check.js --operation getTable --table Users
  node examples/javascript/stats_load_check.js --profile ALL --operation query --query "SELECT * FROM users"
  node examples/javascript/stats_load_check.js --profile ALL --operation basicFlow --table Users
  node examples/javascript/stats_load_check.js --profile ALL --operation fullFlow --table Users

StatsControl comparison:
  Start CloudSim or the KV proxy on localhost:8080 before running these.
  The default config is ${DEFAULT_CONFIG}, which is for KV proxy/KVLite.
  If you are running CloudSim, pass --config examples/config/cloudsim.json.
  The example configs enable Client stats| logging, pretty print, and
  interval snapshots for quick comparison with Java StatsControl output.

  For local KVLite with examples/config/kvlite.json, start KVLite in
  non-secure mode and then start the HTTP proxy:
    java -jar lib/kvstore.jar kvlite -store kvstore -root kvroot-5100-nosec -host localhost -port 5100 -secure-config disable
    java -jar lib/httpproxy.jar -helperHosts localhost:5100 -storeName kvstore -httpPort 8080

  node examples/javascript/stats_load_check.js --config examples/config/cloudsim.json --operation fullFlow --table Users --profile ALL --total 1 --concurrency 1
  node examples/javascript/stats_load_check.js --config examples/config/kvlite.json --operation fullFlow --table Users --profile ALL --total 1 --concurrency 1
`);
}

function parseArgs(argv) {
    const opt = {
        config: DEFAULT_CONFIG,
        total: DEFAULT_TOTAL,
        concurrency: DEFAULT_CONCURRENCY,
        profile: StatsControl.Profile.MORE,
        operation: 'listTables',
        keys: [],
        rows: [],
        writeAction: 'put',
        progressMs: DEFAULT_PROGRESS_MS
    };

    for (let i = 0; i < argv.length; i++) {
        const arg = argv[i];
        switch (arg) {
        case '--help':
        case '-h':
            opt.help = true;
            break;
        case '--config':
            opt.config = argv[++i];
            break;
        case '--total':
            opt.total = Number(argv[++i]);
            opt.totalSet = true;
            break;
        case '--concurrency':
            opt.concurrency = Number(argv[++i]);
            break;
        case '--profile':
            opt.profile = argv[++i];
            break;
        case '--operation':
            opt.operation = argv[++i];
            break;
        case '--progress-ms':
            opt.progressMs = Number(argv[++i]);
            break;
        case '--table':
            opt.table = argv[++i];
            break;
        case '--key':
            opt.keys.push(argv[++i]);
            break;
        case '--row':
            opt.rows.push(argv[++i]);
            break;
        case '--write-action':
            opt.writeAction = argv[++i];
            break;
        case '--query':
            opt.query = argv[++i];
            break;
        default:
            throw new Error(`Unknown option: ${arg}`);
        }
    }

    return opt;
}

function checkPositiveInteger(name, value) {
    if (!Number.isSafeInteger(value) || value <= 0) {
        throw new Error(`${name} must be a positive integer`);
    }
}

function normalizeOptions(opt) {
    if (opt.help) {
        return opt;
    }

    checkPositiveInteger('total', opt.total);
    checkPositiveInteger('concurrency', opt.concurrency);
    checkPositiveInteger('progressMs', opt.progressMs);

    opt.profile = opt.profile.toUpperCase();
    if (!['REGULAR', 'MORE', 'ALL'].includes(opt.profile)) {
        throw new Error('profile must be REGULAR, MORE, or ALL');
    }

    if (!OPERATIONS.includes(opt.operation)) {
        throw new Error(`operation must be one of: ${OPERATIONS.join(', ')}`);
    }

    if (['get', 'delete', 'multiDelete'].includes(opt.operation) &&
        (!opt.table || opt.keys.length === 0)) {
        throw new Error(
            `${opt.operation} requires --table and at least one ` +
            '--key field=value');
    }

    if (opt.operation === 'put' &&
        (!opt.table || opt.rows.length === 0)) {
        throw new Error('put requires --table and at least one --row ' +
            'field=value');
    }

    if (opt.operation === 'writeMultiple') {
        if (!opt.table) {
            throw new Error('writeMultiple requires --table');
        }
        if (!WRITE_ACTIONS.includes(opt.writeAction)) {
            throw new Error('writeMultiple --write-action must be put ' +
                'or delete');
        }
        if (opt.writeAction === 'put' && opt.rows.length === 0) {
            throw new Error('writeMultiple put requires at least one ' +
                '--row field=value');
        }
        if (opt.writeAction === 'delete' && opt.keys.length === 0) {
            throw new Error('writeMultiple delete requires at least one ' +
                '--key field=value');
        }
    }

    if (opt.operation === 'getTable' && !opt.table) {
        throw new Error('getTable requires --table');
    }

    if (FLOW_OPERATIONS.includes(opt.operation) && !opt.table) {
        throw new Error(`${opt.operation} requires --table`);
    }

    if (['query', 'prepare'].includes(opt.operation) && !opt.query) {
        throw new Error(`${opt.operation} requires --query`);
    }

    if (FLOW_OPERATIONS.includes(opt.operation) && !opt.totalSet) {
        opt.total = 1;
    }
    opt.concurrency = Math.min(opt.concurrency, opt.total);
    return opt;
}

function loadConfig(configFile, profile) {
    const absPath = path.resolve(configFile);
    const cfg = Object.assign({}, require(absPath));
    cfg.statsProfile = profile;
    return cfg;
}

function parsePairValue(value, index) {
    value = value.replace(/\{i\}/g, String(index));
    if (/^-?\d+$/.test(value)) {
        const num = Number(value);
        return Number.isSafeInteger(num) ? num : value;
    }
    if (value === 'true') {
        return true;
    }
    if (value === 'false') {
        return false;
    }
    return value;
}

function buildObject(pairs, optionName, index) {
    const obj = {};
    for (const pair of pairs) {
        const sep = typeof pair === 'string' ? pair.indexOf('=') : -1;
        if (sep <= 0) {
            throw new Error(`Invalid ${optionName} value: ${pair}`);
        }
        const field = pair.substring(0, sep);
        const value = pair.substring(sep + 1);
        if (Object.prototype.hasOwnProperty.call(obj, field)) {
            throw new Error(`Duplicate ${optionName} field: ${field}`);
        }
        obj[field] = parsePairValue(value, index);
    }
    return obj;
}

function buildKeyObject(keys, index) {
    return buildObject(keys, '--key', index);
}

function buildRowObject(rows, index) {
    return buildObject(rows, '--row', index);
}

function buildDefaultRow(index) {
    return {
        id: index,
        name: `user-${index}`
    };
}

function buildDefaultKey(row) {
    if (!Object.prototype.hasOwnProperty.call(row, 'id')) {
        throw new Error('basicFlow requires --key when --row does not ' +
            'include id');
    }
    return { id: row.id };
}

function toSQLLiteral(value) {
    if (typeof value === 'number' || typeof value === 'boolean') {
        return String(value);
    }
    return `'${String(value).replace(/'/g, "''")}'`;
}

function buildFlowQuery(opt, key, index) {
    if (opt.query) {
        return opt.query.replace(/\{i\}/g, String(index));
    }

    const keyFields = Object.keys(key);
    if (keyFields.length === 1) {
        const keyField = keyFields[0];
        return `SELECT * FROM ${opt.table} WHERE ${keyField} = ` +
            toSQLLiteral(key[keyField]);
    }
    return `SELECT * FROM ${opt.table}`;
}

async function runBasicFlow(client, opt, index) {
    const row = opt.rows.length > 0 ?
        buildRowObject(opt.rows, index) : buildDefaultRow(index);
    const key = opt.keys.length > 0 ?
        buildKeyObject(opt.keys, index) : buildDefaultKey(row);
    const query = buildFlowQuery(opt, key, index);

    await client.tableDDL(
        `CREATE TABLE IF NOT EXISTS ${opt.table} ` +
        '(id INTEGER, name STRING, PRIMARY KEY(id))',
        {
            tableLimits: {
                readUnits: 1000,
                writeUnits: 1000,
                storageGB: 1
            },
            complete: true
        });
    await client.getTable(opt.table);
    await client.put(opt.table, row);
    await client.get(opt.table, key);
    await client.query(query);
    await client.delete(opt.table, key);
}

function buildFullFlowTableName(table, index) {
    return `${table}_FullFlow_${index}`;
}

function toNoSQLStringLiteral(value) {
    return `"${String(value).replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
}

async function createFullFlowTable(client, table) {
    await client.tableDDL(
        `CREATE TABLE IF NOT EXISTS ${table} ` +
        '(id INTEGER, seq INTEGER, name STRING, ' +
        'PRIMARY KEY(SHARD(id), seq))',
        {
            tableLimits: {
                readUnits: 1000,
                writeUnits: 1000,
                storageGB: 1
            },
            complete: true
        });
}

async function dropFullFlowTable(client, table) {
    await client.tableDDL(`DROP TABLE IF EXISTS ${table}`, {
        complete: true
    });
}

async function runFullFlow(client, opt, index) {
    const table = buildFullFlowTableName(opt.table, index);
    const id = index;
    const row1 = { id, seq: 1, name: `user-${id}-1` };
    const row2 = { id, seq: 2, name: `user-${id}-2` };
    const row3 = { id, seq: 3, name: `user-${id}-3` };
    const key1 = { id, seq: 1 };
    const key2 = { id, seq: 2 };
    const key3 = { id, seq: 3 };

    try {
        await createFullFlowTable(client, table);
        await client.getTable(table);

        await client.put(table, row1);
        await client.put(table, row2);
        await client.get(table, key1);
        await client.get(table, key2);

        await client.query(`INSERT INTO ${table}(id, seq, name) ` +
            `VALUES(${row3.id}, ${row3.seq}, ` +
            `${toNoSQLStringLiteral(row3.name)})`);
        await client.query(`SELECT * FROM ${table} WHERE id = ${key3.id} ` +
            `AND seq = ${key3.seq}`);

        await client.delete(table, key1);
    } finally {
        await dropFullFlowTable(client, table);
    }
}

async function runOperation(client, opt, index) {
    switch (opt.operation) {
    case 'listTables':
        return client.listTables();
    case 'get':
        return client.get(opt.table, buildKeyObject(opt.keys, index));
    case 'put':
        return client.put(opt.table, buildRowObject(opt.rows, index));
    case 'delete':
        return client.delete(opt.table, buildKeyObject(opt.keys, index));
    case 'multiDelete':
        return client.deleteRange(opt.table, buildKeyObject(opt.keys, index));
    case 'writeMultiple':
        if (opt.writeAction === 'delete') {
            return client.writeMany(opt.table, [
                { delete: buildKeyObject(opt.keys, index) }
            ]);
        }
        return client.writeMany(opt.table, [
            { put: buildRowObject(opt.rows, index) }
        ]);
    case 'prepare':
        return client.prepare(opt.query);
    case 'getTable':
        return client.getTable(opt.table);
    case 'query':
        return client.query(opt.query);
    case 'basicFlow':
        return runBasicFlow(client, opt, index);
    case 'fullFlow':
        return runFullFlow(client, opt, index);
    default:
        throw new Error(`Unsupported operation: ${opt.operation}`);
    }
}

function printProgress(done, errors, total, startTime) {
    const elapsedMs = Math.max(Date.now() - startTime, 1);
    const rate = done * 1000 / elapsedMs;
    console.log(`progress done=${done}/${total} errors=${errors} ` +
        `rate=${rate.toFixed(2)} req/s`);
}

async function runWorkers(client, opt) {
    let next = 0;
    let done = 0;
    let errors = 0;
    const startTime = Date.now();
    const progressTimer = setInterval(() => {
        printProgress(done, errors, opt.total, startTime);
    }, opt.progressMs);

    async function worker() {
        for (;;) {
            const index = next++;
            if (index >= opt.total) {
                return;
            }
            try {
                await runOperation(client, opt, index);
            } catch(err) {
                errors++;
            } finally {
                done++;
            }
        }
    }

    try {
        const workers = [];
        for (let i = 0; i < opt.concurrency; i++) {
            workers.push(worker());
        }
        await Promise.all(workers);
    } finally {
        clearInterval(progressTimer);
        printProgress(done, errors, opt.total, startTime);
    }
}

async function main() {
    const opt = normalizeOptions(parseArgs(process.argv.slice(2)));
    if (opt.help) {
        usage();
        return;
    }

    const cfg = loadConfig(opt.config, opt.profile);
    let lastStats;
    if (cfg.statsEnableLog === false && cfg.statsHandler == null) {
        cfg.statsHandler = stats => {
            lastStats = stats;
        };
    }
    let client;
    try {
        client = new NoSQLClient(cfg);
        console.log('Starting stats load check with %O', {
            total: opt.total,
            concurrency: opt.concurrency,
            profile: opt.profile,
            operation: opt.operation
        });
        await runWorkers(client, opt);
    } finally {
        if (client != null) {
            await client.close();
        }
        if (cfg.statsEnableLog === false && lastStats != null) {
            console.log(JSON.stringify(lastStats, null, 2));
        }
    }
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
