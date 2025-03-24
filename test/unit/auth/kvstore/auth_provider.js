/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect =  chai.expect;

const util = require('util');
const fs = require('fs');
const mockfs = require('mock-fs');

const ErrorCode = require('../../../../index').ErrorCode;
const NoSQLError = require('../../../../index').NoSQLError;
const NoSQLServiceError = require('../../../../index').NoSQLServiceError;
const Utils = require('../../utils');
const { MockHttp } = require('../mock_http');
const KVStoreAuthorizationProvider =
    require('../../../../lib/auth/kvstore/auth_provider');
const { NoSQLClient } = require('../../../..');
const MockHttps = require('../mock_http').MockHttps;
const badFilePaths = require('../../common').badFilePaths;

const AUTH_HEADER = 'Authorization';
const HTTP_UNAUTHORIZED = 401;
const SERVICE_HOST = 'localhost';
const SERVICE_ENDPOINT = new URL('https://' + SERVICE_HOST);
const NOSQL_VERSION = 'V2';
const BASE_PATH = `/${NOSQL_VERSION}/nosql/security`;
const LOGIN_ENDPOINT = '/login';
const RENEW_ENDPOINT = '/renew';
const LOGOUT_ENDPOINT = '/logout';

//From the test for Java driver.
const USER_NAME = 'test';
const PASSWORD = 'NoSql00__123456';
const CREDS = { user: USER_NAME, password: PASSWORD };
//BASIC_AUTH_STRING matching user name test and password NoSql00__123456.
const BASIC_AUTH_STRING = 'Basic dGVzdDpOb1NxbDAwX18xMjM0NTY=';
const AUTH_TOKEN_PREFIX = 'Bearer ';
const CREDS_FILE = 'credentials.json';

const LOGIN_TOKEN = 'LOGIN_TOKEN';
const RENEW_TOKEN = 'RENEW_TOKEN';

const TOKEN_TTL = 3000;

const mockHttps = new MockHttps();
const tokenIds = new Set();
let tokenIdSeq = 0;

const badCredsProviders = [
    undefined,
    null,
    0,
    1,  //must function or object
    'abcde', //must function or object
    {}, //missing loadCredentials
    {
        //loadCredentials wrong spelling
        loadCredentails: async () => CREDS
    },
    {
        loadCredentials: null //loadCredentials must be function
    },
    {
        loadCredentials: 'abcde', //loadCredentials must be function
    },
    async () => null,
    async () => BASIC_AUTH_STRING,
    async () => 1,
    {
        // missing password
        loadCredentials: async () => ({ user: USER_NAME })
    },
    {

        // invalid password
        loadCredentials: async () =>
            ({ user: USER_NAME, password: PASSWORD.slice(0, -1) }),
        _httpStatus: HTTP_UNAUTHORIZED
    },
    () => { throw new Error('creds provider error'); },
    async () => {
        await Utils.sleep(10);
        throw new Error('async creds provider error');
    }
];

function createTokenResponse(cfg, isLogin) {
    const id = tokenIdSeq++;
    const exp = Date.now() + (cfg.tokenTTL ? cfg.tokenTTL : TOKEN_TTL);
    const res = {
        expireAt: exp,
        token: JSON.stringify({
            id,
            exp,
            data: isLogin ? LOGIN_TOKEN : RENEW_TOKEN
        })
    };
    //test self-check
    expect(tokenIds).to.not.contain(id);
    tokenIds.add(id);
    return JSON.stringify(res);
} 

async function handleRequest(cfg, opt, endpoint) {
    MockHttps.checkMethod(opt, 'GET');
    if (cfg.delay) {
        await Utils.sleep(cfg.delay);
    }
    try {
        expect(opt.headers).to.exist;
        let auth = opt.headers[AUTH_HEADER];
        expect(auth).to.be.a('string').that.is.not.empty;

        if (endpoint === LOGIN_ENDPOINT) {
            if (auth !== BASIC_AUTH_STRING) {
                throw MockHttps.unauthorized('Invalid user or password');
            }
        } else {
            expect(auth).to.satisfy(s => s.startsWith(AUTH_TOKEN_PREFIX));
            auth = auth.slice(AUTH_TOKEN_PREFIX.length);
            auth = JSON.parse(auth);
            expect(auth).to.be.an('object');
            expect(auth).to.have.property('id').that.is.a('number');
            expect(auth).to.have.property('exp').that.is.a('number');
            expect(auth).to.have.property('data').that.is.a('string');
            if (!tokenIds.has(auth.id)) {
                throw MockHttps.unauthorized('Token not found');
            }
            if (auth.exp < Date.now()) {
                throw MockHttps.unauthorized('Token has expired');
            }
            expect(auth.data).to.be.oneOf([LOGIN_TOKEN, RENEW_TOKEN]);
            tokenIds.delete(auth.id);
        }
    } catch(err) {
        throw err instanceof NoSQLServiceError ?
            err : MockHttp.badRequest(err.stack);
    }

    if (endpoint === LOGOUT_ENDPOINT) {
        return;
    }

    return createTokenResponse(cfg, endpoint === LOGIN_ENDPOINT);
}

function prepConfig(cfg) {
    mockHttps.clear();
    if (!cfg.loginDown) {
        mockHttps.setEndpoint(SERVICE_HOST, BASE_PATH + LOGIN_ENDPOINT,
            opt => handleRequest(cfg, opt, LOGIN_ENDPOINT));
    }
    if (!cfg.renewDown) {
        mockHttps.setEndpoint(SERVICE_HOST, BASE_PATH + RENEW_ENDPOINT,
            opt => handleRequest(cfg, opt, RENEW_ENDPOINT));
    }
    if (!cfg.logoutDown) {
        mockHttps.setEndpoint(SERVICE_HOST, BASE_PATH + LOGOUT_ENDPOINT,
            opt => handleRequest(cfg, opt, LOGOUT_ENDPOINT));
    }
    if (cfg.credsFileData != null) {
        const credsFile =
            cfg.kvstore != null &&
            typeof cfg.kvstore.credentials === 'string' ?
                cfg.kvstore.credentials : cfg.credsFile;
        //test self-check
        expect(credsFile).to.exist; 
        fs.writeFileSync(credsFile, cfg.credsFileData);
    }
}

function kv2cfg(kvCfg, excludeURL) {
    const res = {
        endpoint: SERVICE_ENDPOINT,
        auth: { kvstore: kvCfg }
    };
    if (!excludeURL) {
        res.url = res.endpoint;
    }
    return res;
}

function makeReq(cfg, opt) {
    const req = {
        opt: opt ? opt : {}
    };
    if (cfg != null) {
        req.opt.__proto__ = cfg;
    }
    return req;
}

async function testConfig(cfg) {
    prepConfig(cfg);
    const noSqlCfg = kv2cfg(cfg.kvstore);
    const provider = cfg.createFunc ?
        cfg.createFunc() : new KVStoreAuthorizationProvider(cfg.kvstore);
    provider.onInit(noSqlCfg);
    try {
        return await provider.getAuthorization(makeReq(noSqlCfg));
    } finally {
        await provider.close();
        expect(tokenIds.size).to.equal(0);
    }
}

async function testConfigWithNoSQLClient(cfg) {
    prepConfig(cfg);
    let provider = cfg.createFunc ?
        cfg.createFunc() : new KVStoreAuthorizationProvider(cfg.kvstore);
    const noSqlCfg = {
        endpoint: SERVICE_ENDPOINT,
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
        await client.close();
        expect(tokenIds.size).to.equal(0);
    }
}

function verifyAuth(auth, cfg, endpoint) {
    expect(auth).to.be.a('string');
    expect(auth).to.satisfy(s => s.startsWith(AUTH_TOKEN_PREFIX));
    auth = auth.slice(AUTH_TOKEN_PREFIX.length);
    expect(() => { auth = JSON.parse(auth); }).to.not.throw();
    expect(auth).to.be.an('object');
    expect(auth).to.have.property('id').that.is.a('number');
    expect(auth).to.have.property('exp').that.is.a('number');
    expect(auth).to.have.property('data').that.is.a('string');
    expect(auth.exp).to.be.greaterThan(Date.now());
    expect(auth.data).to.equal(endpoint === LOGIN_ENDPOINT ?
        LOGIN_TOKEN : RENEW_TOKEN);
    return auth.id;
}

class GoodCP {
    async loadCredentials() {
        await Utils.sleep(10);
        return CREDS;
    }
}

const goodConfigs = [
    {
        kvstore: {
            user: USER_NAME,
            password: PASSWORD
        }
    },
    {
        kvstore: {
            user: USER_NAME,
            password: Buffer.from(PASSWORD)
        }
    },
    {
        kvstore: {
            credentials: async () => CREDS
        }
    },
    {
        kvstore: {
            credentials: new GoodCP()
        }
    },
    {
        credsFileData: JSON.stringify(CREDS),
        kvstore: {
            credentials: CREDS_FILE
        }
    },
    {
        createFunc: () => KVStoreAuthorizationProvider.withCredentials(
            USER_NAME, PASSWORD)
    },
    {
        createFunc: () => KVStoreAuthorizationProvider
            .withCredentialsProvider(async () => CREDS)
    },
    {
        createFunc: () => KVStoreAuthorizationProvider
            .withCredentialsProvider(async () => CREDS)
    },
    {
        credsFile: CREDS_FILE,
        credsFileData: JSON.stringify(CREDS),
        createFunc: () => KVStoreAuthorizationProvider.withCredentialsFile(
            CREDS_FILE)
    }
];

//For network errors we specify short timeout in order to avoid long retries.

const badConfigs = [
    { //kvstore not defined
    },
    { //kvstore is empty
        kvstore: {}
    },
    { //missing password
        kvstore: { user: USER_NAME }
    },
    { //missing user name
        kvstore: { password: PASSWORD }
    },
    { //wrong password
        kvstore: { user: USER_NAME, password: PASSWORD + ' ' },
        httpStatus: HTTP_UNAUTHORIZED
    },
    { //wrong user name
        kvstore: { user: USER_NAME + ' ', password: PASSWORD },
        httpStatus: HTTP_UNAUTHORIZED
    },
    { //cannot specify both user name/password and credentials
        credsFileData: JSON.stringify(CREDS),
        kvstore: {
            user: USER_NAME,
            password: PASSWORD,
            credentials: CREDS_FILE
        }
    },
    { //cannot specify both user name/password and credentials
        kvstore: {
            user: USER_NAME,
            password: PASSWORD,
            credentials: new GoodCP()
        }
    },
    {
        //missing user name and password
        createFunc: () => KVStoreAuthorizationProvider.withCredentials()
    },
    {
        //missing password
        createFunc: () => KVStoreAuthorizationProvider.withCredentials(
            USER_NAME)
    },
    {   //invalid type for password
        createFunc: () => KVStoreAuthorizationProvider.withCredentials(
            USER_NAME, 1)
    },
    {   //invalid type for user name
        createFunc: () => KVStoreAuthorizationProvider.withCredentials(
            1, PASSWORD)
    },
    {   //invalid type for credentials file
        createFunc: () => KVStoreAuthorizationProvider.withCredentialsFile(
            new GoodCP())
    },
    {   //invalid type for credentials provider
        createFunc: () => KVStoreAuthorizationProvider
            .withCredentialsProvider(CREDS_FILE)
    },
    ...badFilePaths.map(file => ({
        kvstore: { credentials: file }
    })),
    {
        kvstore: { credentials: CREDS_FILE },
        // empty credentials file
        credsFileData: ''
    },
    {
        kvstore: { credentials: CREDS_FILE },
        // invalid credentials file
        credsFileData: JSON.stringify(CREDS).slice(0, -1)
    },
    ...badFilePaths.map(file => ({
        createFunc: () => KVStoreAuthorizationProvider.withCredentialsFile(
            file)
    })),
    ...badCredsProviders.map(provider => ({
        kvstore: { credentials: provider },
        httpStatus: provider ? provider._httpStatus : undefined,
        errorCode: provider ? provider._errorCode : undefined
    })),
    ...badCredsProviders.map(provider => ({
        createFunc: () => KVStoreAuthorizationProvider
            .withCredentialsProvider(provider),
        httpStatus: provider ? provider._httpStatus : undefined,
        errorCode: provider ? provider._errorCode : undefined
    }))
];

function testTokenRefresh() {
    it('Test auto-renew disabled', async function() {
        const cfg = {
            kvstore: {
                user: USER_NAME,
                password: PASSWORD,
                autoRenew: false,
                noRenewBeforeMs: 0
            },
            tokenTTL: 3000
        };
        prepConfig(cfg);
        const noSqlCfg = kv2cfg(cfg.kvstore);
        const provider = new KVStoreAuthorizationProvider(
            noSqlCfg.auth.kvstore);
        try {
            provider.onInit(noSqlCfg);
            const req = makeReq(noSqlCfg);
            const auth = await provider.getAuthorization(req);
            const tokenId = verifyAuth(auth, cfg, LOGIN_ENDPOINT);
            await Utils.sleep(2500);
            //Since there is no auto-renew, auth shoud be the same
            let auth2 = await provider.getAuthorization(req);
            expect(auth).to.equal(auth2);
            await Utils.sleep(1000);
            //Now the token should have expired.  To request new token,
            //NoSQLClient sets req.lastError to RETRY_AUTHENTICATION.
            req.lastError = NoSQLError.create(ErrorCode.RETRY_AUTHENTICATION,
                'token expired');
            auth2 = await provider.getAuthorization(req);
            //should receive new token
            const tokenId2 = verifyAuth(auth2, cfg, LOGIN_ENDPOINT);
            expect(tokenId2).to.be.greaterThan(tokenId);
        } finally {
            await provider.close();
        }
    });
    it('Test auto-renew enabled', async function() {
        const cfg = {
            kvstore: {
                user: USER_NAME,
                password: PASSWORD,
                noRenewBeforeMs: 500
            },
            tokenTTL: 3000
        };
        prepConfig(cfg);
        const noSqlCfg = kv2cfg(cfg.kvstore);
        const provider = new KVStoreAuthorizationProvider(
            noSqlCfg.auth.kvstore);
        try {
            provider.onInit(noSqlCfg);
            const req = makeReq(noSqlCfg);
            const auth = await provider.getAuthorization(req);
            const tokenId = verifyAuth(auth, cfg, LOGIN_ENDPOINT);
            await Utils.sleep(2000);
            //more than 1/2 TTL elapsed, so the token should be renewed
            const auth2 = await provider.getAuthorization(req);
            const tokenId2 = verifyAuth(auth2, cfg, RENEW_ENDPOINT);
            expect(tokenId2).to.be.greaterThan(tokenId);
        } finally {
            await provider.close();
        }
    });
}

//assign test case id to help debug failed cases
let testCaseId = 0;

function doTest() {
    for(let cfg of goodConfigs) {
        it(`Valid config: ${util.inspect(cfg)}, testCaseId=${testCaseId}}`,
            async function() {
                let auth = await testConfig(cfg);
                verifyAuth(auth, cfg, LOGIN_ENDPOINT);
                auth = await testConfigWithNoSQLClient(cfg);
                verifyAuth(auth, cfg, LOGIN_ENDPOINT);
            })._testCaseId = testCaseId++;
    }
    for(let cfg of badConfigs) {
        it(`Invalid config: ${util.inspect(cfg)}, testCaseId=${testCaseId}}`,
            async function() {
                return expect(testConfig(cfg)).to.eventually.be.rejected
                    .and.satisfy(err => err instanceof NoSQLError &&
                    (cfg.httpStatus == null ?
                        (cfg.errorCode != null ?
                            err.errorCode === cfg.errorCode :
                            (err.errorCode === ErrorCode.ILLEGAL_ARGUMENT ||
                            err.errorCode === ErrorCode.CREDENTIALS_ERROR)) :
                        (err.errorCode === ErrorCode.SERVICE_ERROR &&
                            err.cause instanceof NoSQLServiceError &&
                        err.cause.statusCode === cfg.httpStatus)));
            })._testCaseId = testCaseId++;
    }
    testTokenRefresh();
}

before(() => mockfs());
after(() => mockfs.restore());

if (Utils.isOnPrem) {
    describe('KVStoreAuthorizationProvider test', function() {
        this.timeout(60000);
        before(() => {
            mockfs();
            mockHttps.stub();
        });
        after(() => {
            mockfs.restore();
            mockHttps.restore();
        });
        doTest();
        it('', () => {});
    });
}
