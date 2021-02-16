/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;
const Limits = require('../../lib/constants').Limits;
const isPosInt32OrZero = require('../../lib/utils').isPosInt32OrZero;
const Utils = require('./utils');
const WRITE_MANY_TESTS = require('./data_tests').WRITE_MANY_TESTS;

const badTblNames = require('./common').badTblNames;
const badOptsPutNoTimeout = require('./common').badOptsPutNoTimeout;
const badOptsDeleteNoTimeout = require('./common').badOptsDeleteNoTimeout;
const badDriverRows = require('./common').badDriverRows;
const getBadServerRows = require('./common').getBadServerRows;
const badDriverKeys = require('./common').badDriverKeys;
const getBadServerKeys = require('./common').getBadServerKeys;
const _id = require('./common')._id;

const sampleRow = { id: 1, name: 'John'};
const sampleKey = { id: 2 };

//For negative tests of writeMany
const sampleOp = [
    {
        put: sampleRow
    },
    {
        delete: sampleKey
    }
];

//delete options are a subset of put options
const badOpts = badOptsPutNoTimeout;

//exclude some invalid options not relevant to sub-operations
const badOpOptsPut = badOptsPutNoTimeout.filter(opt =>
    typeof opt === 'object' && !('compartment' in opt));
const badOpOptsDelete = badOptsDeleteNoTimeout.filter(opt =>
    typeof opt === 'object' && !('compartment' in opt));

const badDriverOps = [
    undefined,
    null,
    0,
    'a', //must be object
    {}, //must contain either put or delete,
    { //may not contain both put and delete
        put: sampleRow,
        delete: sampleKey
    },
    //no options, bad row
    ...badDriverRows.map(row => ({ put: row })),
    //good row, bad options
    ...badOpOptsPut.map(opt => Object.assign({ put: sampleRow }, opt)),
    //no options, bad key
    ...badDriverKeys.map(key => ({ delete: key })),
    //good key, bad options
    ...badOpOptsDelete.map(opt => Object.assign({ delete: sampleKey },
        opt))
];

function getBadServerOps(tbl, row) {
    return [
        //no options, bad row
        ...getBadServerRows(tbl, row).map(row => ({ put: row })),
        //no options, bad key
        ...getBadServerKeys(tbl, Utils.makePrimaryKey(tbl, row)).map(key =>
            ({ delete: key })),
        //extra fields with exactMatch set for put
        { exactMatch: true, put: Object.assign({}, row, { nosuchcol: 1 })}
    ];
}

const badDriverOpListsBase = [
    undefined,
    null,
    1,
    'aaaaa',
    sampleOp[0], //must be array
    [], //must not be empty
    //cannot exceed limit on number of operations
];

const badDriverOpLists = [
    ...badDriverOpListsBase,
    //cannot exceed limit on number of operations
    new Array(Limits.BATCH_OP_NUMBER + 1).fill({ put: sampleRow }),
    new Array(Limits.BATCH_OP_NUMBER + 1).fill({ delete: sampleKey }),
    ...badDriverOps.map(op => [op]),
    //good ops followed by bad one
    ...badDriverOps.map(op => sampleOp.concat(op))
];

//For putMany
const badDriverRowLists = [
    ...badDriverOpListsBase,
    new Array(Limits.BATCH_OP_NUMBER + 1).fill(sampleRow),
    ...badDriverRows.map(row => [ row ]),
    //bad row followed by good one
    ...badDriverRows.map(row => [ row, sampleRow ]),
];

//For deleteMany
const badDriverKeyLists = [
    ...badDriverOpListsBase,
    new Array(Limits.BATCH_OP_NUMBER + 1).fill(sampleKey),
    ...badDriverKeys.map(key => [ key ]),
    //bad key betwee 2 good ones
    ...badDriverKeys.map(key => [ sampleKey, key, sampleKey ]),
];

//row2 is a row from different shard from row.  writeMany can only take list
//of operations from the same shard
function getBadServerOpLists(tbl, row, row2) {
    const key = Utils.makePrimaryKey(tbl, row);
    const key2 = Utils.makePrimaryKey(tbl, row2);
    return [
        ...getBadServerOps(tbl, row).map(op => [op]),
        //bad op among good ops
        ...getBadServerOps(tbl, row).map(op => [ { put: row }, op,
            { delete: key } ]),
        [ { put: row }, { put: row } ], //same row not allowed
        [ { delete: key2 }, { delete: key2 } ], //same key not allowed
        [ { put: row }, { put: row2 } ],
        [ { put: row }, { delete: key2 } ],
        [ { put: row }, { delete: key } ],
        [ { delete: key }, { put: row } ],
        [ { delete: key }, { delete: key2 } ]
    ];
}

//For putMany
function getBadServerRowLists(tbl, row, row2) {
    const badRows = getBadServerRows(tbl, row);
    return [
        ...badRows.map(badRow => [ badRow ]),
        ...badRows.map(badRow => [ row, badRow ]),
        [ row2, row2 ],
        [ row, row2 ]
    ];
}

//For deleteMany
function getBadServerKeyLists(tbl, key, key2) {
    const badKeys = getBadServerKeys(tbl, key);
    return [
        ...badKeys.map(badKey => [ badKey ]),
        ...badKeys.map(badKey => [ badKey, key, key, badKey ]),
        [ key, key ],
        [ key, key2 ]
    ];
}

function testWriteManyFuncNegative(wmFunc, tbl, sampleOps, badDriverOpLists,
    badServerOpLists, badOpts) {
    for(let badTblName of badTblNames) {
        it(`${wmFunc.name} with invalid table name: ${badTblName}`,
            async function() {
                return expect(wmFunc(badTblName, sampleOps)).to.eventually
                    .be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
    }

    it(`${wmFunc.name} on non-existent table`, async function() {
        return expect(wmFunc('nosuchtable', sampleOps)).to.eventually.be
            .rejected.and.satisfy(err => err instanceof NoSQLError &&
            err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    for(let badOps of badDriverOpLists) {
        it(`${wmFunc.name} on table ${tbl.name} with invalid driver ops: \
${util.inspect(badOps)}`, async function() {
            return expect(wmFunc(tbl.name, badOps)).to.eventually
                .be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }

    for(let badOps of badServerOpLists) {
        it(`${wmFunc.name} on table ${tbl.name} with invalid server ops: \
${util.inspect(badOps)}`, async function() {
            return expect(wmFunc(tbl.name, badOps)).to.eventually
                .be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    !err._rejectedByDriver);
        });
    }

    for(let badOpt of badOpts) {
        it(`${wmFunc.name} on table ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(wmFunc(tbl.name, sampleOps, badOpt)).to.eventually
                .be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    err._rejectedByDriver);
        });
    }
}

function testWriteManyNegative(client, tbl, row, row2) {
    const samplePut = { put: row };
    const key = Utils.makePrimaryKey(tbl, row);
    const key2 = Utils.makePrimaryKey(tbl, row2);
    const sampleDelete = { delete: key };

    testWriteManyFuncNegative(client.writeMany.bind(client), tbl,
        [ samplePut, sampleDelete ], badDriverOpLists,
        getBadServerOpLists(tbl, row, row2), badOpts);

    testWriteManyFuncNegative(client.putMany.bind(client), tbl, [ samplePut ],
        badDriverRowLists, getBadServerRowLists(tbl, row, row2),
        badOptsPutNoTimeout);

    testWriteManyFuncNegative(client.deleteMany.bind(client), tbl,
        [ sampleDelete ], badDriverKeyLists,
        getBadServerKeyLists(tbl, key, key2),
        badOptsDeleteNoTimeout);

    //extra fields with exactMatch option
    it(`putMany on table ${tbl.name} with exactMatch and extra fields: `,
        async function() {
            const badRow = Object.assign({}, row, { nosuchfield: 'abcde' });
            return expect(client.putMany(tbl.name, [ badRow ],
                { exactMatch: true }))
                .to.eventually.be.rejected.and.satisfy(err =>
                    err instanceof NoSQLArgumentError &&
                    !err._rejectedByDriver);
        });
}

//In case the writeMany operation should succeed, individual sub operations
//may still fail if abortOnFail option was not specified.  In this case,
//failing ops should be marked by _shouldFail property for verification.
//In case writeMany operation should fail due to abortOnFail option, each op
//should contain "_existingRow" property which points to the row
//as it was before being modified by this op, if such row existed.  This will
//be used if the operation fails to verify that no changes were made and also
//to verify "existingRow" and "existingVersion" properties in
//res.failedOpResult.
async function verifyWriteMany(res, client, test, ops, opt, success = true) {
    if (!opt) {
        opt = {};
    }

    expect(res).to.be.an('object');
    Utils.verifyConsumedCapacity(res.consumedCapacity);

    if (success) {
        expect(res.failedOpIndex).to.not.exist;
        expect(res.failedOpResult).to.not.exist;
        expect(res.results).to.be.an('array');
        expect(res.results.length).to.equal(ops.length);
        let successCnt = 0;
        let readCnt = 0;
        for(let i = 0; i < ops.length; i++) {
            const op = ops[i];
            //options are stored in op and inherit properties from opt
            const opOpt = Object.assign(Object.create(opt), op);

            if (op._shouldFail) {
                //checking for correctness of test data just in case
                expect(opOpt.abortOnFail).to.not.be.ok;
            } else {
                successCnt++;
            }
            if (op.ifAbsent || op.ifPresent || op.matchVersion) {
                readCnt++;
            }
            if (op.put) {
                const existingRow = test.byId.get(op.put[_id]);
                await Utils.verifyPut(res.results[i], client, test.table,
                    op.put, opOpt, !op._shouldFail, existingRow, true);
            } else {
                expect(op.delete).to.exist;
                const existingRow = test.byId.get(op.delete[_id]);
                await Utils.verifyDelete(res.results[i], client, test.table,
                    op.delete, opOpt, !op._shouldFail, existingRow, true);
            }
        }
        if (!Utils.isOnPrem) {
            expect(res.consumedCapacity.writeKB).to.be.at.least(successCnt);
            expect(res.consumedCapacity.writeUnits).to.be.at.least(successCnt);
            expect(res.consumedCapacity.readKB).to.be.at.least(readCnt);
            expect(res.consumedCapacity.readUnits).to.be.at.least(readCnt);
        }
    } else { //operation fails because of abortOnFail option
        expect(res.results).to.not.exist;
        expect(res.failedOpIndex).to.satisfy(isPosInt32OrZero);
        expect(res.failedOpIndex).to.be.lessThan(ops.length);

        const op = ops[res.failedOpIndex];
        const opOpt = Object.assign(Object.create(opt), op);
        expect(opOpt.abortOnFail).to.be.ok;

        if (op.put) {
            const existingRow = test.byId.get(op.put[_id]);
            await Utils.verifyPut(res.failedOpResult, client, test.table,
                op.put, opOpt, false, existingRow, true);
        } else {
            expect(op.delete).to.exist;
            const existingRow = test.byId.get(op.delete[_id]);
            await Utils.verifyDelete(res.failedOpResult, client, test.table,
                op.delete, opOpt, false, existingRow, true);
        }

        //Verify that no rows has been affected by the operation
        for(let op of ops) {
            const key = op.put ? Utils.makePrimaryKey(test.table, op.put) :
                op.delete;
            const existingRow = test.byId.get(op.put ? op.put[_id] :
                op.delete[_id]);
            const getRes = await client.get(test.table.name, key);
            Utils.verifyGetResult(getRes, test.table, existingRow);
        }
    }
}

//testCase object is a test case for writeMany operation containing ops array,
//common options (opt) and expected success status (success)
//For putMany and deleteMany, instead of ops array, there are rows and keys
//arrays respectively.  Only one of ops, rows or keys may be present.
function testWriteMany(client, test, testCase) {
    if (testCase.rows) {
        //if we use rows array, we specify _shouldFail as row symbol property
        testCase.ops = testCase.rows.map(row => ({ put: row }));
        it(`putMany on table ${test.table.name}, test case: ${testCase.desc}`,
            async function() {
                const res = await client.putMany(test.table.name,
                    testCase.rows, testCase.opt);
                await verifyWriteMany(res, client, test, testCase.ops,
                    testCase.opt, testCase.success);
            });
    } else if (testCase.keys) {
        //if we use keys array, we specify _shouldFail as key symbol property
        testCase.ops = testCase.keys.map(key => ({ delete: key }));
        it(`deleteMany on table ${test.table.name}, test case: \
${testCase.desc}`, async function() {
            const res = await client.deleteMany(test.table.name, testCase.keys,
                testCase.opt);
            await verifyWriteMany(res, client, test, testCase.ops,
                testCase.opt, testCase.success);
        });
    }

    //we perform writeMany tests for rows or keys as well
    it(`writeMany on table ${test.table.name}, test case: ${testCase.desc}`,
        async function() {
            const res = await client.writeMany(test.table.name, testCase.ops,
                testCase.opt);
            await verifyWriteMany(res, client, test, testCase.ops,
                testCase.opt, testCase.success);
        });

    //We have to back up these in original format since they will be needed
    //to prepare() multiple times.  This will be executed before actual tests.
    testCase.srcOps = Utils.deepCopy(testCase.ops);
    if (testCase.opt) {
        testCase.srcOpt = Utils.deepCopy(testCase.opt);
    }
}

//prepare testcase
function prepare(test, testCase) {
    //test consistency verification
    expect(testCase.ops).to.be.an('array');
    expect(testCase.srcOps).to.be.an('array');
    expect(testCase.ops.length).to.equal(testCase.srcOps.length);

    for(let i = 0; i < testCase.ops.length; i++) {
        const op = testCase.ops[i];
        const srcOp = testCase.srcOps[i];
        if (srcOp.put) {
            expect(op.put).to.exist;
            if (srcOp.put.shouldFail != null) {
                op._shouldFail = srcOp.put.shouldFail;
            }
            op.put = test.ptr2row(srcOp.put);
        } else {
            expect(srcOp.delete).to.exist;
            expect(op.delete).to.exist;
            if (srcOp.delete.shouldFail != null) {
                op._shouldFail = srcOp.delete.shouldFail;
            }
            op.delete = test.ptr2pk(srcOp.delete);
        }
        if (srcOp.matchVersion) {
            op.matchVersion = test.ptr2version(srcOp.matchVersion);
        }
    }
    if (testCase.srcOpt) {
        expect(testCase.opt).to.exist;
        if (testCase.srcOpt.matchVersion) {
            expect(testCase.opt.matchVersion).to.exist;
            testCase.opt.matchVersion = test.ptr2version(
                testCase.srcOpt.matchVersion);
        }
    }

    //both rows and keys have changed, so we have to recreate them
    if (testCase.rows) {
        testCase.rows = testCase.ops.map(op => op.put);
    } else if (testCase.keys) {
        testCase.keys = testCase.ops.map(op => op.delete);
    }
}

//We are assuming that each of our rows or keys in the test case has [_id]
//property
async function restore(client, test, ops) {
    for(let op of ops) {
        if (op.put) {
            const origRow = test.byId.get(op.put[_id]);
            if (origRow) { //was put on existing row
                await Utils.putRow(client, test.table, origRow);
            } else { //was put on new row
                await Utils.deleteRow(client, test.table,
                    Utils.makePrimaryKey(test.table, op.put));
            }
        } else {
            const origRow = test.byId.get(op.delete[_id]);
            if (origRow) { //was delete on existing row
                await Utils.putRow(client, test.table, origRow);
            }
            //ignore delete on non-existing row
        }
    }
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, async function() {
        before(async function() {
            await Utils.createTable(client, test.table);
            for(let row of test.rows) {
                await Utils.putRow(client, test.table, row);
            }
        });
        after(async function() {
            await Utils.dropTable(client, test.table);
        });
        testWriteManyNegative(client, test.table, test.rowFromShard(0),
            test.rowFromShard(1));
        test.testCases.forEach(testCase => {
            describe(`writeMany test case: ${testCase.desc}`, function() {
                beforeEach(function() {
                    prepare(test, testCase);
                });
                testWriteMany(client, test, testCase);
                afterEach(async function() {
                    await restore(client, test, testCase.ops);
                });
            });
        });
        it('', () => {});
    });
}

Utils.runSequential('writeMany tests', doTest, WRITE_MANY_TESTS);
