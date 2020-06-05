/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');

const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const AdminState = require('../../index').AdminState;
const badStringsOrBinaries = require('./common').badStringsOrBinaries;
const badStringsNoEmpty = require('./common').badStringsNoEmpty;
const badStrings = require('./common').badStrings;
const badPlainObjects = require('./common').badPlainObjects;
const Utils = require('./utils');
const ADMIN_DDL_TESTS = require('./test_schemas').ADMIN_DDL_TESTS;
const badStatusOpts = require('./common').badDDLStatusOpts;
const badDDLCompleteOpts = require('./common').badDDLCompleteOpts;
const badCompletionOpts = require('./common').badDDLForCompletionOpts;

const badAdminDDLOpts = badStatusOpts.concat(badDDLCompleteOpts);

const badDriverStmts = [ undefined, null, ...badStringsOrBinaries ];
const badServerStmts = [ 'blah blah', Buffer.alloc(10) ];

const badDriverAdminRes = [
    ...badPlainObjects,
    {
        _forAdmin: true
    }, //missing operationId
    {
        _forAdmin: true,
        state: AdminState.IN_PROGRESS,
        operationId: null
    }, //missing operationId
    ...badStrings.map(operationId => ({
        _forAdmin: true,
        operationId
    })),
    ...badStringsNoEmpty.map(statement => ({
        _forAdmin: true,
        operationId: '123',
        statement
    }))
];

function testAdminDDLNegative(client) {
    for(let badStmt of badDriverStmts) {
        it(`adminDDL with invalid driver statement: ${util.inspect(badStmt)}`,
            async function() {
                return expect(client.adminDDL(badStmt)).to.eventually.
                    be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
    }
    for(let badStmt of badServerStmts) {
        it(`adminDDL with invalid server statement: ${util.inspect(badStmt)}`,
            async function() {
                return expect(client.adminDDL(badStmt)).to.eventually.
                    be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        !err._rejectedByDriver);
            });
    }
    for(let badOpt of badAdminDDLOpts) {
        it(`adminDDL with invalid options: ${util.inspect(badOpt)}`,
            async function() {
                return expect(client.adminDDL('CREATE NAMESPACE foo', badOpt))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
    }
    for(let func of [ 'listNamespaces', 'listUsers', 'listRoles' ]) {
        for(let badOpt of badCompletionOpts) {
            it(`${func} with invalid options: ${util.inspect(badOpt)}`,
                async function() {
                    return expect(client[func](badOpt))
                        .to.eventually.be.rejected.and.satisfy(err =>
                            err instanceof NoSQLArgumentError &&
                            err._rejectedByDriver);
                });
        }
    }
}

function testAdminStatusNegative(client) {
    describe('adminStatus and forCompletion negative tests', function foo() {
        let adminRes;
        before(async function() {
            await client.adminDDL('DROP NAMESPACE IF EXISTS NS4TEST12', {
                complete: true
            });
            adminRes = await client.adminDDL('CREATE NAMESPACE NS4TEST12');
            expect(adminRes.operationId).to.exist;
        });
        after(async function() {
            await client.adminDDL('DROP NAMESPACE NS4TEST12', {
                complete: true
            });
        });
        for(let badOpt of badStatusOpts) {
            it(`adminStatus with invalid options: ${util.inspect(badOpt)}`,
                async function foo() {
                    return expect(client.adminStatus(adminRes, badOpt))
                        .to.eventually.be.rejected.and.satisfy(err =>
                            err instanceof NoSQLArgumentError &&
                            err._rejectedByDriver);
                });
        }
        for(let badOpt of badCompletionOpts) {
            it(`forCompletion with invalid options: ${util.inspect(badOpt)}`,
                async function foo() {
                    return expect(client.forCompletion(adminRes, badOpt))
                        .to.eventually.be.rejected.and.satisfy(err =>
                            err instanceof NoSQLArgumentError &&
                            err._rejectedByDriver);
                });
        }
        for(let badRes of badDriverAdminRes) {
            it(`adminStatus with invalid driver adminResult: \
    ${util.inspect(badRes)}`, async function foo() {
                return expect(client.adminStatus(badRes))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
            it(`forCompletion with invalid driver adminResult: \
    ${util.inspect(badRes)}`, async function foo() {
                return expect(client.forCompletion(badRes))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        err._rejectedByDriver);
            });
        }
        const badServerAdminRes = [
            {
                _forAdmin: true,
                operationId: 'blah'
            },
            /* apparently invalid statement is not rejected by proxy
            {
                _forAdmin: true,
                statement: 'blah'
            }
            */
        ];
        for(let badRes of badServerAdminRes) {
            it(`adminStatus with invalid server adminResult: \
    ${util.inspect(badRes)}`, async function foo() {
                //get operationId and state from adminRes, overwrite
                //invalid properties from badRes
                const res = Object.assign({}, adminRes, badRes);
                return expect(client.adminStatus(res))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        !err._rejectedByDriver);
            });
            it(`forCompletion with invalid server adminResult: \
    ${util.inspect(badRes)}`, async function foo() {
                const res = Object.assign({}, adminRes, badRes);
                return expect(client.forCompletion(res))
                    .to.eventually.be.rejected.and.satisfy(err =>
                        err instanceof NoSQLArgumentError &&
                        !err._rejectedByDriver);
            });
        }
    });
}

function verifyAdminResult(res, completed, hasOutput) {
    expect(res).to.be.an('object');
    expect(res.state).to.be.an.instanceOf(AdminState);
    if (completed || res.operationId == null) {
        expect(res.state).to.equal(AdminState.COMPLETE);
    }
    if (res.operationId != null) {
        expect(res.operationId).to.be.a('string').that.is.not.empty;
    }
    if (res.statement != null) {
        expect(res.statement).to.be.a('string').that.is.not.empty;
    }
    if (hasOutput) {
        expect(res.output).to.be.a('string');
    } else {
        expect(res.output).to.not.exist;
    }
}

function testAdminDDL(client, stmt, cleanupStmt) {
    const isShow = stmt.startsWith('SHOW');
    describe(`Testing statement: ${stmt}`, function() {
        if (cleanupStmt) {
            const cleanup = async () => {
                const res = await client.adminDDL(cleanupStmt, {
                    complete: true
                });
                verifyAdminResult(res, true);
            };
            afterEach(cleanup);
        }
        it(`adminDDL(${stmt}) with forCompletion`, async function() {
            let res = await client.adminDDL(stmt);
            verifyAdminResult(res, isShow, isShow);
            let res1 = await client.forCompletion(res);
            expect(res1).to.equal(res);
            verifyAdminResult(res, true, isShow);
            res = await client.adminStatus(res);
            verifyAdminResult(res, true, isShow);
            await client.forCompletion(res);
            verifyAdminResult(res, true, isShow);
        });
        it(`adminDDL(Buffer(${stmt})) with forCompletion`, async function() {
            let res = await client.adminDDL(Buffer.from(stmt));
            verifyAdminResult(res, isShow, isShow);
            res = await client.adminStatus(res);
            verifyAdminResult(res, isShow, isShow);
            await client.forCompletion(res);
            verifyAdminResult(res, true, isShow);
        });
        it(`adminDDL(${stmt}) with forCompletion with options`,
            async function() {
                let res = await client.adminDDL(stmt, { timeout: 15000 });
                verifyAdminResult(res, isShow, isShow);
                res = await client.adminStatus(res, { timeout: 8000 });
                verifyAdminResult(res, isShow, isShow);
                await client.forCompletion(res, {
                    timeout: 10000,
                    delay: 2000
                });
                verifyAdminResult(res, true, isShow);
                //operation should be complete now
                await client.forCompletion(res, {
                    delay: 100
                });
                verifyAdminResult(res, true, isShow);
            });
        it(`adminDDL(${stmt}) with complete:true and options`,
            async function() {
                let res = await client.adminDDL(stmt, {
                    complete: true,
                    timeout: 12000,
                    delay: 899
                });
                verifyAdminResult(res, true, isShow);
                //already completed
                res = await client.adminStatus(res);
                verifyAdminResult(res, true, isShow);
                let res1 = await client.forCompletion(res, {
                    //should have no effect since those are inherited
                    //from config only
                    adminPollTimeout: 'blah',
                    adminPollDelay: 'blah'
                });
                expect(res1).to.equal(res);
                verifyAdminResult(res, true, isShow);
            });
        it(`adminDDL(Buffer(${stmt})) with complete:true`,
            async function foo() {
                let res = await client.adminDDL(Buffer.from(stmt, 'utf8'), {
                    complete: true
                });
                verifyAdminResult(res, true, isShow);
                await client.forCompletion(res);
                verifyAdminResult(res, true, isShow);
            });
    });
}

function testListFuncs(client) {
    const ns = [ 'list_test_n1', 'list_test_n2' ];
    const opts = [
        {
            delay: 999
        },
        {
            timeout: 5555,
            delay: 500
        }
    ];
    describe('Testing list functions', function() {
        before(async function() {
            for(let n of ns) {
                await client.adminDDL('CREATE NAMESPACE ' + n,
                    { complete: true });
            }
        });
        after(async function() {
            for(let n of ns) {
                await client.adminDDL('DROP NAMESPACE ' + n,
                    { complete: true });
            }
        });
        it('listNamespaces', async function() {
            const res = await client.listNamespaces();
            expect(res).to.be.an('array').that.is.not.empty;
            for(let val of res) {
                expect(val).to.be.a('string').that.is.not.empty;
            }
            expect(res).to.include.members(ns);
            for(let opt of opts) {
                const res1 = await client.listNamespaces(opt);
                expect(res1).to.deep.equal(res);
            }
        });
        it('listRoles', async function() {
            const res = await client.listRoles();
            expect(res).to.be.an('array').that.is.not.empty;
            for(let val of res) {
                expect(val).to.be.a('string').that.is.not.empty;
            }
            for(let opt of opts) {
                const res1 = await client.listRoles(opt);
                expect(res1).to.deep.equal(res);
            }
        });
        it('listUsers', async function() {
            const res = await client.listUsers();
            expect(res).to.be.an('array');
            if (Utils.isSecureOnPrem) {
                expect(res).to.not.be.empty;
            }
            for(let val of res) {
                expect(val).to.be.an('object');
                expect(val).to.have.all.keys('id', 'name');
                expect(val.id).to.be.a('string').that.is.not.empty;
                expect(val.name).to.be.a('string').that.is.not.empty;
            }
            for(let opt of opts) {
                const res1 = await client.listUsers(opt);
                expect(res1).to.deep.equal(res);
            }
        });
    });
}

function doTest(client, test) {
    describe(`Running ${test.desc}`, function() {
        testAdminDDLNegative(client);
        testAdminStatusNegative(client);
        for(let ddl of test.ddls) {
            testAdminDDL(client, ddl.stmt, ddl.cleanupStmt);
        }
        testListFuncs(client);
        it('', () => {});
    });
}

if (Utils.isOnPrem) {
    Utils.runSequential('DDL tests', doTest, ADMIN_DDL_TESTS);
}
