/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;
const mockfs = require('mock-fs');

const ErrorCode = require('../../../../lib/error_code');
const NoSQLError = require('../../../../lib/error').NoSQLError;
const Utils = require('../../utils');
const { NoSQLClient } = require('../../../..');
const SERVICE_ENDPOINT = require('./constants').SERVICE_ENDPOINT;
const COMPARTMENT_ID = require('./constants').COMPARTMENT_ID;
const PRIVATE_KEY_FILE = require('./constants').PRIVATE_KEY_FILE;
const SESSION_TOKEN_FILE = require('./constants').SESSION_TOKEN_FILE;
const SESSION_TOKEN = require('./constants').SESSION_TOKEN;
const DEFAULT_OCI_DIR = require('./constants').DEFAULT_OCI_DIR;
const DEFAULT_OCI_FILE = require('./constants').DEFAULT_OCI_FILE;
const creds = require('./config').creds;
const sessTokenCreds = require('./config').sessTokenCreds;
const badDirectConfigs = require('./config').badDirectConfigs;
const goodDirectConfigs = require('./config').goodDirectConfigs;
const badFileConfigs = require('./config').badFileConfigs;
const goodFileConfigs = require('./config').goodFileConfigs;
const badUserConfigs = require('./config').badUserConfigs;
const goodUserConfigs = require('./config').goodUserConfigs;
const badExclPropsConfigsCons = require('./config').badExclPropsConfigsCons;
const iam2cfg = require('./utils').iam2cfg;
const makeAuthProvider = require('./utils').makeAuthProvider;
const initAuthProvider = require('./utils').initAuthProvider;
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
        writeOrRemove(cfg._useDefaultOCIFile ?
            DEFAULT_OCI_FILE : cfg.configFile, cfg._ociConfigData);

        if (cfg.useSessionToken) {
            writeOrRemove(SESSION_TOKEN_FILE, cfg._sessTokenData != null ?
                cfg._sessTokenData : SESSION_TOKEN);
        }
    }
}

async function testConfig(iamCfg, compartment) {
    prepConfig(iamCfg);
    const cfg = iam2cfg(iamCfg, compartment);
    const provider = initAuthProvider(cfg);
    try {
        return await provider.getAuthorization(makeReq(cfg));
    } finally {
        provider.close();
    }
}

async function testConfigWithNoSQLClient(iamCfg, compartment) {
    prepConfig(iamCfg);
    let provider = makeAuthProvider(iamCfg);
    const noSqlCfg = {
        endpoint: SERVICE_ENDPOINT,
        compartment,
        auth: { provider }
    };
    const client = new NoSQLClient(noSqlCfg);
    expect(client._config).to.exist;
    expect(client._config.auth).to.exist;
    provider = client._config.auth.provider;
    expect(provider).to.exist;
    try {
        return await provider.getAuthorization(makeReq(noSqlCfg));
    } finally {
        client.close();
    }
}

function testCacheAndRefresh(iamCfg) {
    it(`Cache test with iam config: ${inspect(iamCfg)}`, async function() {
        prepConfig(iamCfg);
        const provider = initAuthProvider(iam2cfg(Object.assign({
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
        const provider = initAuthProvider(iam2cfg(Object.assign({
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
            auth = await testConfigWithNoSQLClient(cfg, COMPARTMENT_ID);
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
            let auth = await testConfig(cfg);
            verifyAuth(auth, cfg.useSessionToken ? sessTokenCreds : creds);
            auth = await testConfigWithNoSQLClient(cfg);
            verifyAuth(auth, cfg.useSessionToken ? sessTokenCreds : creds);
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
            let auth = await testConfig(cfg);
            verifyAuth(auth, creds);
            auth = await testConfigWithNoSQLClient(cfg);
            verifyAuth(auth, creds);
        });
    }

    for(let cfg of badExclPropsConfigsCons) {
        it(`Invalid config with exclusive properties: ${inspect(cfg)}`,
            async function() {
                return expect(testConfig(cfg)).to.eventually.be
                    .rejected.and.satisfy(err => err instanceof NoSQLError &&
                    err.errorCode == ErrorCode.ILLEGAL_ARGUMENT);
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
        before(() => mockfs({
            [DEFAULT_OCI_DIR] : {}
        }));
        after(() => mockfs.restore());
        doTest();
        it('', () => {});
    });
}
