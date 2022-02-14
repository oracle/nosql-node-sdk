/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const TableState = require('../../index').TableState;
const badMillis = require('./common').badMillis;
const badStrings = require('./common').badStrings;
const badPosInt32 = require('./common').badPosInt32;
const badOptions = require('./common').badOptions;
const Utils = require('./utils');
const CapacityMode = require('../../index').CapacityMode;
const DEF_TABLE_LIMITS = require('./common').DEF_TABLE_LIMITS;
const TABLE_DDL_TESTS = require('./test_schemas').TABLE_DDL_TESTS;

//For cloud service only, test supplying options with compartment
//only if compartment is specified in the config, so that we are
//always using the same compartment. In all other cases
//compartment will be undefined. We use the same in other tests.

const compartment = Utils.config.compartment;

const badDDLOptsNoTableLimits = [
    ...badOptions,
    ...badMillis.map(timeout => { return {
        timeout,
        tableLimits: DEF_TABLE_LIMITS
    };})
];

const badTableLimits = [
    1000,
    'a',
    {},
    ...Object.keys(DEF_TABLE_LIMITS).map(k => { //missing one limits property
        const limits = Object.assign({}, DEF_TABLE_LIMITS);
        delete limits[k];
        return limits;
    }),
    //one limit property is invalid
    ...[].concat(Object.keys(DEF_TABLE_LIMITS).map(k => badPosInt32.map(
        v => Object.assign({}, DEF_TABLE_LIMITS, { [k]: v }))))
];

const badDDLOpts = [
    ...badDDLOptsNoTableLimits,
    ...badTableLimits.map(tableLimits => { return {
        tableLimits
    };})
];

const badStmts = [ undefined, null, '', ...badStrings ];

function testCreateTable(client, tbl) {
    //Negative tests
    for(let badStmt of badStmts) {
        it(`Create table ${tbl.name} with invalid statement string: \
${util.inspect(badStmt)}`, async function() {
            return expect(client.tableDDL(badStmt)).to.be.rejectedWith(
                NoSQLArgumentError);
        });
    }

    expect(tbl.indexes).to.not.exist;
    const stmt = Utils.makeCreateTable(tbl);
    for(let badOpt of badDDLOpts) {
        it(`Create table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.tableDDL(stmt, badOpt)).to.be
                .rejectedWith(NoSQLArgumentError);
        });
    }

    //Positive test
    it(`Create table ${tbl.name}`, async function() {
        let res = await client.tableDDL(stmt, {
            compartment,
            timeout: 10000,
            tableLimits: DEF_TABLE_LIMITS
        });
        Utils.verifyTableResult(res, tbl);
        await client.forCompletion(res);
        Utils.verifyActiveTable(res, tbl);
        res = await client.getTable(tbl.name, { timeout: 10000 });
        Utils.verifyActiveTable(res, tbl);
    });
}

function testOnDemandTable(client, tbl) {

    // test on demand tables: in V2 this should throw an illegal argument
    const stmt = Utils.makeCreateTable(tbl);
    it(`Create table ${tbl.name} with on demand`, async function() {
        var serialVersion = client.getSerialVersion();
        if (serialVersion < 3) {
            return expect(client.tableDDL(stmt, {
                compartment,
                timeout: 10000,
                tableLimits: {
                    mode: CapacityMode.ON_DEMAND,
                    storageGB: 100,
                    readUnits: 0,
                    writeUnits: 0
                }})).to.be.rejectedWith(NoSQLArgumentError);
        } else {
            let res = await client.tableDDL(stmt, {
                compartment,
                timeout: 10000,
                tableLimits: {
                    mode: CapacityMode.ON_DEMAND,
                    storageGB: 100,
                    readUnits: 0,
                    writeUnits: 0
                }
            });
            Utils.verifyTableResult(res, tbl, { _ignoreTableLimits: true });
            await client.forCompletion(res);
            Utils.verifyActiveTable(res, tbl, {
                tableLimits: {
                    mode: CapacityMode.ON_DEMAND,
                    storageGB: 100,
                    readUnits: 2147483646,
                    writeUnits: 2147483646
                }});
            res = await client.getTable(tbl.name, { timeout: 10000 });
            Utils.verifyActiveTable(res, tbl, {
                tableLimits: {
                    mode: CapacityMode.ON_DEMAND,
                    storageGB: 100,
                    readUnits: 2147483646,
                    writeUnits: 2147483646
                }});
            res = await client.tableDDL(Utils.makeDropTable(tbl));
            Utils.verifyTableResult(res, tbl, { _ignoreTableLimits: true });
            await client.forCompletion(res);
            expect(res.tableName).to.equal(tbl.name);
            expect(res.tableState).to.equal(TableState.DROPPED);
        }
    });
}

function testCreateIndex(client, tbl, idx) {
    it(`Create index ${idx.name} on table ${tbl.name}`, async function() {
        if (tbl.indexes) {
            expect(tbl.indexes).to.not.deep.include(idx);
        }
        let res = await client.getTable(tbl.name, { timeout: 6000 });
        Utils.verifyActiveTable(res, tbl);
        res = await client.tableDDL(Utils.makeCreateIndex(tbl, idx),
            { timeout: 10000, compartment });
        Utils.verifyTableResult(res, tbl);
        if (tbl.indexes) {
            tbl.indexes.push(idx);
        } else {
            tbl.indexes = [ idx ];
        }
        await client.forCompletion(res, { delay: 500 });
        Utils.verifyActiveTable(res, tbl);
    });
}

function testDropIndex(client, tbl, idx) {
    it(`Drop index ${idx.name} on table ${tbl.name}`, async function() {
        expect(tbl.indexes).to.be.an('array');
        const idxIdx = tbl.indexes.findIndex(i => i.name === idx.name);
        expect(idxIdx).to.be.at.least(0);
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        res = await client.tableDDL(Utils.makeDropIndex(tbl, idx),
            { timeout: 8000, compartment });
        Utils.verifyTableResult(res, tbl);
        tbl.indexes.splice(idxIdx, 1);
        await client.forCompletion(res, { delay: 500 });
        Utils.verifyActiveTable(res, tbl);
    });
}

function testAddField(client, tbl, fld) {
    it(`Add field ${fld.name} to table ${tbl.name}`, async function() {
        expect(tbl.fields).to.not.include(fld);
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        res = await client.tableDDL(Utils.makeAddField(tbl, fld));
        Utils.verifyTableResult(res, tbl);
        tbl.fields.push(fld);
        await client.forCompletion(res, { delay: 1500 });
        Utils.verifyActiveTable(res, tbl);
    });
}

function testDropField(client, tbl, fld) {
    it(`Drop field ${fld.name} from table ${tbl.name}`, async function() {
        const fldIdx = tbl.fields.findIndex(f => f.name === fld.name);
        expect(fldIdx).to.be.at.least(0);
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        res = await client.tableDDL(Utils.makeDropField(tbl, fld));
        Utils.verifyTableResult(res, tbl);
        tbl.fields.splice(fldIdx, 1);
        await client.forCompletion(res);
        Utils.verifyActiveTable(res, tbl);
    });
}

function testAlterTTL(client, tbl, ttl) {
    it(`Alter TTL on table ${tbl.name} to ${ttl}`, async function() {
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        res = await client.tableDDL(Utils.makeAlterTTL(tbl, ttl),
            { timeout: 10000 });
        Utils.verifyTableResult(res, tbl);
        tbl.ttl = ttl;
        await client.forCompletion(res);
        Utils.verifyActiveTable(res, tbl);
    });
}

const badTblNames = require('./common').badTblNames;

function testAlterLimits(client, tbl, limits) {
    //Negative tests
    for(let badTblName of badTblNames) {
        it(`setTableLimits with invalid table name: \
${util.inspect(badTblName)}`, async function() {
            return expect(client.setTableLimits(badTblName, limits)).to.be
                .rejectedWith(NoSQLArgumentError);
        });
    }

    for(let badLimits of badTableLimits) {
        it(`setTableLimits on ${tbl.name} with invalid table limits: \
${util.inspect(badLimits)}`, async function() {
            return expect(client.setTableLimits(tbl.name, badLimits)).to.be
                .rejectedWith(NoSQLArgumentError);
        });
    }

    for(let badOpt of badDDLOptsNoTableLimits) {
        it(`setTableLimits on ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.setTableLimits(tbl.name, limits, badOpt))
                .to.be.rejectedWith(NoSQLArgumentError);
        });
    }

    //Positive test
    it(`setTableLimits on ${tbl.name}`, async function() {
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        res = await client.setTableLimits(tbl.name, limits,
            { compartment, timeout: 10000 });
        Utils.verifyTableResult(res, tbl);
        tbl.limits = limits;
        await client.forCompletion(res);
        Utils.verifyActiveTable(res, tbl);
    });
}

function testDropTable(client, tbl) {
    it(`Drop table ${tbl.name}`, async function() {
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        res = await client.tableDDL(Utils.makeDropTable(tbl));
        Utils.verifyTableResult(res, tbl, { _ignoreTableLimits: true });
        await client.forCompletion(res);
        expect(res.tableName).to.equal(tbl.name);
        expect(res.tableState).to.equal(TableState.DROPPED);
    });
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, function() {
        before(async function() {
            await Utils.dropTable(client, test.table);
        });
        after(async function() {
            await Utils.dropTable(client, test.table);
        });

        testCreateTable(client, test.table);
        if (test.add_indexes) {
            test.add_indexes.forEach(idx => testCreateIndex(client,
                test.table, idx));
        }
        if (test.drop_indexes) {
            test.drop_indexes.forEach(idx => testDropIndex(client,
                test.table, idx));
        }
        if (test.add_fields) {
            test.add_fields.forEach(fld => testAddField(client, test.table,
                fld));
        }
        if (test.drop_fields) {
            test.drop_fields.forEach(fld => testDropField(client,
                test.table, fld));
        }
        if (test.alter_ttls) {
            test.alter_ttls.forEach(ttl => testAlterTTL(client, test.table,
                ttl));
        }
        if (!Utils.isOnPrem && test.alter_limits) {
            test.alter_limits.forEach(limits => testAlterLimits(
                client, test.table, limits));
        }
        testDropTable(client, test.table);
        if (!Utils.isOnPrem) {
            testOnDemandTable(client, test.table);
        }
        it('', () => {});
    });
}

Utils.runSequential('DDL tests', doTest, TABLE_DDL_TESTS);
