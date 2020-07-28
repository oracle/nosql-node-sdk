/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const mockfs = require('mock-fs');

const IAMAuthorizationProvider =
    require('../../../lib/auth/iam/auth_provider');
const ErrorCode = require('../../../lib/error_code');
const NoSQLError = require('../../../lib/error').NoSQLError;
const Utils = require('../utils');
const COMPARTMENT_ID = require('./constants').COMPARTMENT_ID;
const PRIVATE_KEY_FILE = require('./constants').PRIVATE_KEY_FILE;
const creds = require('./config').creds;
const badDirectConfigs = require('./config').badDirectConfigs;
const goodDirectConfigs = require('./config').goodDirectConfigs;
const badFileConfigs = require('./config').badFileConfigs;
const goodFileConfigs = require('./config').goodFileConfigs;
const badUserConfigs = require('./config').badUserConfigs;
const goodUserConfigs = require('./config').goodUserConfigs;
const iam2cfg = require('./utils').iam2cfg;
const makeReq = require('./utils').makeReq;
const writeOrRemove = require('./utils').writeOrRemove;
const verifyAuth = require('./utils').verifyAuth;
const verifyAuthEqual = require('./utils').verifyAuthEqual;
const verifyAuthLaterDate = require('./utils').verifyAuthLaterDate;
const inspect = require('./utils').inspect;

function prepConfig(cfg) {
    if (cfg != null) {
        //For oci config files and user's provider configs cfg.privateKeyFile
        //is not specified, so we use default path instead.
        let pkFile = cfg.privateKeyFile;
        if (cfg._privateKeyData != null && pkFile == null) {
            pkFile = PRIVATE_KEY_FILE;
        }
        writeOrRemove(pkFile, cfg._privateKeyData);
        writeOrRemove(cfg.configFile, cfg._ociConfigData);
    }
}

async function testConfig(iamCfg, compartment) {
    prepConfig(iamCfg);
    const cfg = iam2cfg(iamCfg, compartment);
    const provider = new IAMAuthorizationProvider(cfg);
    try {
        return await provider.getAuthorization(makeReq(cfg));
    } finally {
        provider.close();
    }
}

function testCacheAndRefresh(iamCfg) {
    it(`Cache test with iam config: ${inspect(iamCfg)}`, async function() {
        prepConfig(iamCfg);
        const provider = new IAMAuthorizationProvider(iam2cfg(Object.assign({
            durationSeconds: 2,
            refreshAheadMs: null //disable refresh
        }, iamCfg)));
        try {
            const auth0 = await provider.getAuthorization(makeReq());
            await Utils.sleep(1000);
            let auth = await provider.getAuthorization(makeReq());
            verifyAuthEqual(auth, auth0, creds);
            await Utils.sleep(1100);
            auth = await provider.getAuthorization(makeReq());
            verifyAuthLaterDate(auth, auth0, creds);
        } finally {
            provider.close();
        }
    });
    it(`Refresh test with iam config: ${inspect(iamCfg)}`, async function() {
        prepConfig(iamCfg);
        const provider = new IAMAuthorizationProvider(iam2cfg(Object.assign({
            durationSeconds: 3,
            refreshAheadMs: 1000
        }, iamCfg)));
        try {
            let auth0 = await provider.getAuthorization(makeReq());
            await Utils.sleep(1000);
            let auth = await provider.getAuthorization(makeReq());
            //+1000, no refresh yet
            verifyAuthEqual(auth, auth0, creds);
            await Utils.sleep(1200);
            auth = await provider.getAuthorization(makeReq());
            //+2200, automatic refresh should have happened
            verifyAuthLaterDate(auth, auth0, creds);
            auth0 = auth;
            await Utils.sleep(1700);
            auth = await provider.getAuthorization(makeReq());
            //+3900, shouldn't change again within 2s of last refresh
            verifyAuthEqual(auth, auth0, creds);
            await Utils.sleep(200);
            auth = await provider.getAuthorization(makeReq());
            //+4100, automatic refresh should have happened again
            verifyAuthLaterDate(auth, auth0, creds);
        } finally {
            provider.close();
        }
    });
}

//assign test case id to help debug failed cases, do on as needed basis for now
let testCaseId = 0;

function doTest() {
    for(let cfg of badDirectConfigs) {
        it(`Invalid direct config: ${inspect(cfg)}`, async function() {
            return expect(testConfig(cfg)).to.eventually.be
                .rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.ILLEGAL_ARGUMENT);
        });
    }
    for(let cfg of goodDirectConfigs) {
        it(`Valid direct config: ${inspect(cfg)}`, async function() {
            let auth = await testConfig(cfg);
            verifyAuth(auth, creds);
            auth = await testConfig(cfg, COMPARTMENT_ID);
            verifyAuth(auth, creds, COMPARTMENT_ID);
        });
    }
    for(let cfg of badFileConfigs) {
        it(`Invalid file config: ${inspect(cfg)}`, async function() {
            return expect(testConfig(cfg)).to.eventually.be
                .rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.ILLEGAL_ARGUMENT);
        });
    }
    for(let cfg of goodFileConfigs) {
        it(`Valid file config: ${inspect(cfg)}`, async function() {
            const auth = await testConfig(cfg);
            verifyAuth(auth, creds);
        });
    }
    for(let cfg of badUserConfigs) {
        it(`Invalid user's provider config: ${inspect(cfg)}, \
testCaseId=${testCaseId}`, async function() {
            return expect(testConfig(cfg)).to.eventually.be
                .rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.ILLEGAL_ARGUMENT);
        })._testCaseId = testCaseId++;
    }
    for(let cfg of goodUserConfigs) {
        it(`Valid user's provider config: ${inspect(cfg)}`, async function() {
            const auth = await testConfig(cfg);
            verifyAuth(auth, creds);
        });
    }
    //test with all 3 config types
    testCacheAndRefresh(goodDirectConfigs[0]);
    testCacheAndRefresh(goodFileConfigs[0]);
    testCacheAndRefresh(goodUserConfigs[0]);
}

if (!Utils.isOnPrem) {
    describe('IAMAuthorizationProvider test', function() {
        this.timeout(60000);
        before(() => mockfs());
        after(() => mockfs.restore());
        doTest();
        it('', () => {});
    });
}
