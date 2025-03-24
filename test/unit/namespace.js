/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;

const NoSQLClient = require('../../index').NoSQLClient;
const NoSQLError = require('../../index').NoSQLError;
const ErrorCode = require('../../index').ErrorCode;
const TableState = require('../../index').TableState;
const Utils = require('./utils');
const SIMPLE_TABLE = require('./test_schemas').SIMPLE_TABLE;
const simpleTableWithName = require('./test_schemas').simpleTableWithName;
const SIMPLE_TABLE_ROW = require('./test_schemas').SIMPLE_TABLE_ROW;

const NAMESPACE_NAME = 'test_opt_ns';
const INVALID_NS_NAME = 'invalid';
const TABLE_NAME = SIMPLE_TABLE.name;
const FULL_TABLE_NAME = `${NAMESPACE_NAME}:${TABLE_NAME}`;

const NS_TEST = {
    nsName: NAMESPACE_NAME,
    baseTableName: TABLE_NAME,
    fullTableName: FULL_TABLE_NAME,
    table: simpleTableWithName(FULL_TABLE_NAME),
    row: SIMPLE_TABLE_ROW,
    pk: Utils.projectRow(SIMPLE_TABLE_ROW, SIMPLE_TABLE.primaryKey)
};

function testOpTestCases(baseClient, nsClient, invalidNSClient, test, opName,
    doOp, checkRes) {
    it(`${opName} without namespace`, async function() {
        return expect(doOp(baseClient, test.baseTableName))
            .to.eventually.be.rejected.and.satisfy(
                err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });
    it(`${opName} with invalid namespace in config`, async function() {
        return expect(doOp(invalidNSClient, test.baseTableName))
            .to.eventually.be.rejected.and.satisfy(
                err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });
    it(`${opName} with invalid namespace in options`, async function() {
        return expect(doOp(baseClient, test.baseTableName, {
            namespace: INVALID_NS_NAME
        })).to.eventually.be.rejected.and.satisfy(
            err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });
    it(`${opName} with invalid namespace in options overrides valid \
namespace in config`, async function() {
        return expect(doOp(nsClient, test.baseTableName, {
            namespace: INVALID_NS_NAME
        })).to.eventually.be.rejected.and.satisfy(
            err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });
    it(`${opName} with full table name specified`, async function() {
        const res = await doOp(baseClient, test.fullTableName);
        checkRes(res);
    });
    it(`${opName} with full table name overrides invalid namespace in \
config`, async function() {
        const res = await doOp(invalidNSClient, test.fullTableName);
        checkRes(res);
    });
    it(`${opName} with valid namespace in config`, async function() {
        const res = await doOp(nsClient, test.baseTableName);
        checkRes(res);
    });
    it(`${opName} with valid namespace in options`, async function() {
        const res = await doOp(baseClient, test.baseTableName, {
            namespace: test.nsName
        });
        checkRes(res);
    });
    it(`${opName} with valid namespace in options overrides invalid \
namespace in config`, async function() {
        const res = await doOp(invalidNSClient, test.baseTableName, {
            namespace: test.nsName
        });
        checkRes(res);
    });
}

function testOp(baseClient, nsClient, invalidNSClient, test, opName, doBefore,
    doBeforeEach, doOp, checkRes) {
    describe(`Namespace ${opName} test`, function() {
        if (doBefore) {
            before(async function() {
                await doBefore();
            }); 
        }
        if (doBeforeEach) {
            beforeEach(async function() {
                await doBeforeEach();
            });
        }
        testOpTestCases(baseClient, nsClient, invalidNSClient, test, opName,
            doOp, checkRes);
        it('', () => {});
    });
}

function testGet(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'get',
        () => Utils.putRow(baseClient, test.table, test.row),
        undefined,
        (client, tableName, opt) => client.get(tableName, test.pk, opt),
        res => expect(res.row).to.exist);
}

function testPut(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'put',
        undefined,
        undefined,
        (client, tableName, opt) => client.put(tableName, test.row, opt),
        res => expect(res.success).to.equal(true));
}

function testDelete(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'delete',
        undefined,
        () => Utils.putRow(baseClient, test.table, test.row),
        (client, tableName, opt) => client.delete(tableName, test.pk, opt),
        res => expect(res.success).to.equal(true));
}

//We can also add similar tests for putIfAbsent, putIfPresent,
//deleteIfVersion, etc.

function testDeleteRange(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'delete',
        undefined,
        () => Utils.putRow(baseClient, test.table, test.row),
        (client, tableName, opt) => client.deleteRange(tableName, test.pk,
            opt),
        res => expect(res.deletedCount).to.be.greaterThan(0));
}

function testWriteMany(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'writeMany',
        undefined,
        undefined,
        (client, tableName, opt) => client.writeMany(tableName,
            [ { put: test.row } ], opt),
        res => expect(res.results).to.be.an('array'));
}

function testWriteManyMultiTable(baseClient, nsClient, invalidNSClient,
    test) {
    testOp(baseClient, nsClient, invalidNSClient, test,
        'multi-table writeMany',
        undefined,
        undefined,
        (client, tableName, opt) => client.writeMany([ {
            tableName,
            put: test.row
        } ], opt),
        res => expect(res.results).to.be.an('array'));
}

function testPutMany(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'putMany',
        undefined,
        undefined,
        (client, tableName, opt) => client.putMany(tableName, [ test.row ],
            opt),
        res => expect(res.results).to.be.an('array'));
}

function testDeleteMany(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'deleteMany',
        undefined,
        () => Utils.putRow(baseClient, test.table, test.row),
        (client, tableName, opt) => client.deleteMany(tableName, [ test.pk ],
            opt),
        res => expect(res.results).to.be.an('array'));
}

function testPreparedQuery(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'prepare',
        () => Utils.putRow(baseClient, test.table, test.row),
        undefined,
        async (client, tableName, opt) => {
            const ps = await client.prepare(`SELECT * FROM ${tableName}`,
                opt);
            expect(ps).to.exist;
            return client.query(ps, opt);
        },
        res => expect(res.rows).to.be.an('array'));
}

function testQuery(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'query',
        () => Utils.putRow(baseClient, test.table, test.row),
        undefined,
        (client, tableName, opt) => client.query(
            `SELECT * FROM ${tableName}`, opt),
        res => expect(res.rows).to.be.an('array'));
}

function testTableDDL(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'tableDDL',
        undefined,
        undefined,
        (client, tableName, opt) => client.tableDDL(
            `ALTER TABLE ${tableName} USING TTL 5 days`,
            Object.assign({ complete: true }, opt)),
        res => expect(res.namespace).to.equal(test.nsName));
}

function testGetTable(baseClient, nsClient, invalidNSClient, test) {
    testOp(baseClient, nsClient, invalidNSClient, test, 'getTable',
        undefined,
        undefined,
        (client, tableName, opt) => client.getTable(tableName, opt),
        res => expect(res.tableName).to.equal(test.fullTableName));
}

function testCreateTable(baseClient, nsClient, invalidNSClient, test) {
    const tableName = 'TestTable';
    it('Namespace create table test', async function() {
        let res = await nsClient.tableDDL(
            `CREATE TABLE ${tableName}(col1 LONG, PRIMARY KEY(col1))`);
        await nsClient.forCompletion(res);
        expect(res.namespace).to.equal(test.nsName);
        expect(res.tableName).to.equal(`${test.nsName}:${tableName}`);
        res = await baseClient.tableDDL(`DROP TABLE ${tableName}`, {
            namespace: test.nsName,
            complete: true
        });
        expect(res.tableState).to.equal(TableState.DROPPED);
    });
}

function testListTables(baseClient, nsClient, invalidNSClient, test) {
    describe('Namespace listTables test', function() {
        before(async function() {
            await Utils.createTable(baseClient, SIMPLE_TABLE);
        });
        after(async function() {
            await Utils.dropTable(baseClient, SIMPLE_TABLE);
        });
        it('listTables with invalid namespace in config', async function() {
            const res = await invalidNSClient.listTables();
            expect(res.tables).to.be.an('array').that.is.empty;
        });
        it('listTables with invalid namespace in options', async function() {
            const res = await baseClient.listTables({
                namespace: INVALID_NS_NAME
            });
            expect(res.tables).to.be.an('array').that.is.empty;
        });
        it('listTables normal', async function() {
            const res = await baseClient.listTables();
            expect(res.tables).to.be.an('array');
            expect(res.tables).to.include.members(
                [ SIMPLE_TABLE.name, test.fullTableName ]);
        });
        it('listTables with namespace in config', async function() {
            const res = await nsClient.listTables();
            expect(res.tables).to.deep.equal([ test.fullTableName ]);
        });
        it('listTables with namespace in options', async function() {
            const res = await baseClient.listTables({
                namespace: test.nsName
            });
            expect(res.tables).to.deep.equal([ test.fullTableName ]);
        });
        it('listTables with namespace in options overrides invalid namespace \
in config', async function() {
            const res = await invalidNSClient.listTables({
                namespace: test.nsName
            });
            expect(res.tables).to.deep.equal([ test.fullTableName ]);
        });
    });
}

function doTest(client, test) {    
    describe('Running namespace test', function() {
        const nsClient = new NoSQLClient(Object.assign({}, Utils.config,
            { namespace: test.nsName }));
        const invalidNSClient = new NoSQLClient(Object.assign({},
            Utils.config, { namespace: INVALID_NS_NAME }));
    
        before(async function() {
            await client.adminDDL(
                `DROP NAMESPACE IF EXISTS ${test.nsName} CASCADE`, {
                    complete: true
                });
            await client.adminDDL(`CREATE NAMESPACE ${test.nsName}`, {
                complete: true
            });
            await Utils.createTable(client, test.table);
        });

        after(async function() {
            if (invalidNSClient) {
                invalidNSClient.close();
            }
            if (nsClient) {
                nsClient.close();
            }
            await client.adminDDL(
                `DROP NAMESPACE IF EXISTS ${test.nsName} CASCADE`, {
                    complete: true
                });
        });
        testGet(client, nsClient, invalidNSClient, test);
        testPut(client, nsClient, invalidNSClient, test);
        testDelete(client, nsClient, invalidNSClient, test);
        testDeleteRange(client, nsClient, invalidNSClient, test);
        testWriteMany(client, nsClient, invalidNSClient, test);
        testWriteManyMultiTable(client, nsClient, invalidNSClient, test);
        testPutMany(client, nsClient, invalidNSClient, test);
        testDeleteMany(client, nsClient, invalidNSClient, test);
        testPreparedQuery(client, nsClient, invalidNSClient, test);
        testQuery(client, nsClient, invalidNSClient, test);
        testTableDDL(client, nsClient, invalidNSClient, test);
        testGetTable(client, nsClient, invalidNSClient, test);
        testCreateTable(client, nsClient, invalidNSClient, test);
        testListTables(client, nsClient, invalidNSClient, test);
        it('', () => {});
    });
}

if (Utils.isOnPrem) {
    Utils.runSequential('Namespace tests', doTest, [ NS_TEST ]);
}
