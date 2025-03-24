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

const crypto = require('crypto');
const mockfs = require('mock-fs');

const Region = require('../../../../index').Region;
const ErrorCode = require('../../../../index').ErrorCode;
const NoSQLError = require('../../../../index').NoSQLError;
const NoSQLServiceError = require('../../../../index').NoSQLServiceError;
const IAMAuthorizationProvider =
    require('../../../../lib/auth/iam/auth_provider');
const HttpConstants = require('../../../../lib/constants').HttpConstants;
const Utils = require('../../utils');
const badMillis = require('../../common').badMillis;
const badStrings = require('../../common').badStrings;
const badFilePathsNotNull = require('../../common').badFilePathsNotNull;
const MockHttp = require('../mock_http').MockHttp;
const MockHttps = require('../mock_http').MockHttps;
const initAuthProvider = require('./utils').initAuthProvider;
const makeST = require('./utils').makeST;
const iam2cfg = require('./utils').iam2cfg;
const makeReq = require('./utils').makeReq;
const inspect = require('./utils').inspect;
const verifyAuth = require('./utils').verifyAuth;
const writeOrRemove = require('./utils').writeOrRemove;
const verifyAuthLaterDate = require('./utils').verifyAuthLaterDate;
const setOrUnsetEnv = require('./utils').setOrUnsetEnv;
const testTokenCache = require('./cached_profile').testTokenCache;
const testTokenAutoRefresh = require('./cached_profile').testTokenAutoRefresh;
const testPrecacheAuth = require('./cached_profile').testPrecacheAuth;
const COMPARTMENT_ID = require('./constants').COMPARTMENT_ID;

const METADATA_HOST = '169.254.169.254';
const METADATA_PATH_V2 = '/opc/v2/';
const METADATA_PATH_V1 = '/opc/v1/';

const SA_CERT = Buffer.from('Kubernetes Service Account Certificate');
const DEFAULT_SA_CERT_FILE =
    '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';
const KUB_HOST = 'kubhost';

const DEFAULT_SA_TOKEN_FILE =
    '/var/run/secrets/kubernetes.io/serviceaccount/token';

const SA_CERT_FILE = '/user/app/kub/sa/ca.crt';
const SA_TOKEN_FILE = '/user/app/kub/sa/token';

//Make sure TTL is enough time for the test to run, the client will validate
//expration of SA tokens.
const SA_TOKEN = makeST(36000000);
const SA_TOKEN2 = makeST(72000000);

function verifyPayload(payload) {
    expect(() => {
        payload = JSON.parse(payload);
    }).to.not.throw();
    expect(payload.podKey).to.be.a('string').that.is.not.empty;
    expect(() => {
        //Save public key created by oke workload identity client to verify
        //auth signature.
        clientPublicKey = crypto.createPublicKey({
            key: Buffer.from(payload.podKey, 'base64'),
            format: 'der',
            type: 'spki'
        });
    }).to.not.throw();
}

function checkOpcRequestId(reqId) {
    expect(reqId).to.be.a('string').of.length(32);
    expect(reqId.toUpperCase()).to.equal(reqId);
    const val = Buffer.from(reqId, 'hex');
    expect(val.toString('hex').toUpperCase()).to.equal(reqId);
}

//We only check that the CA cert supplied by the client is the same as the
//expected one (SA_CERT).
function checkSACert(opt) {
    let ca;
    if ('ca' in opt) {
        ca = opt.ca;
    } else {
        expect(opt.agent).to.exist;
        expect(opt.agent.options).to.exist;
        ca = opt.agent.options.ca;
    }
    
    expect(ca).to.satisfy(val => typeof val === 'string' ||
        Buffer.isBuffer(val));
    if (typeof ca === 'string') {
        ca = Buffer.from(ca);
    }

    expect(ca).to.deep.equal(SA_CERT);
}

function verifyRequest(payload, opt, cfg) {
    const headers = opt.headers;
    let auth;

    try {
        verifyPayload(payload, cfg);
        expect(headers[HttpConstants.CONTENT_TYPE]).to.equal(
            HttpConstants.APPLICATION_JSON);
        checkOpcRequestId(headers[HttpConstants.OPC_REQUEST_ID]);
        auth = headers[HttpConstants.AUTHORIZATION];
        expect(auth).to.be.a('string').that.is.not.empty;
    } catch(err) {
        throw MockHttp.badRequest(err.stack);
    }

    //We differentiate between expected SA token data and the one provided
    //by the client, for negative tests. In most cases, expected SA token data
    //will be SA_TOKEN.
    const expSATokenData = cfg._expSATokenData != null ?
        cfg._expSATokenData : SA_TOKEN;
    try {
        checkSACert(opt);
        expect(auth).to.equal('Bearer ' + expSATokenData);
    } catch(err) {
        throw MockHttp.unauthorized(err.stack);
    }
}

const mockHttp = new MockHttp();
const mockHttps = new MockHttps();

//We keep current token issued by MockHttps as well as public key created by
//instance principal client to verify auth.
let currentToken;
let clientPublicKey;

function prepConfig(cfg) {
    mockHttp.clear();
    mockHttps.clear();
    const isValidRegion = cfg.region instanceof Region;
    const region = isValidRegion ? cfg.region.regionCode : cfg.region;

    if (!cfg.mdHostDown) {
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V2 +
            'instance/region', cfg.missingMDV2 ? MockHttp.notFound() :
            region);
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V1 +
            'instance/region', cfg.missingMDV1 ? MockHttp.notFound() :
            region);
    }
    if (!cfg.kubHostDown) {
        mockHttps.setEndpoint(`${KUB_HOST}:12250`,
            '/resourcePrincipalSessionTokens', (opt, payload) => {
                MockHttps.checkMethod(opt, HttpConstants.POST);
                verifyRequest(payload, opt, cfg);
                currentToken = makeST(cfg.tokenTTL ? cfg.tokenTTL : 3000);
                const res = Buffer.from(JSON.stringify({
                    token: `$ST${currentToken}`
                })).toString('base64');
                return `"${res}"`;
            });
    }

    setOrUnsetEnv('OCI_KUBERNETES_SERVICE_ACCOUNT_CERT_PATH', cfg.saCertFile);

    let saCertFile;
    if (cfg.saCertFile != null) {
        //For negative tests, put valid CA cert into the default file, they
        //should still fail. For positive tests, remove default CA cert file,
        //they should still succeed.
        writeOrRemove(DEFAULT_SA_CERT_FILE,
            cfg._invalidCACert ? SA_CERT : null);
        saCertFile = cfg.saCertFile;
    } else {
        saCertFile = DEFAULT_SA_CERT_FILE;
    }
    writeOrRemove(saCertFile, 'saCert' in cfg ? cfg.saCert : SA_CERT);

    setOrUnsetEnv('KUBERNETES_SERVICE_HOST',
        'kubHost' in cfg ? cfg.kubHost : KUB_HOST);

    const saTokenData = '_saTokenData' in cfg ?
        cfg._saTokenData : SA_TOKEN;
    if ('saToken' in cfg || 'saTokenFile' in cfg ||
        'saTokenProvider' in cfg) {
        //For negative tests on SA token (cfg._invaliSAToken = true), put
        //valid SA token into the default file, they should still fail. For
        //positive tests, remove default SA token file, they should still
        //succeed.
        writeOrRemove(DEFAULT_SA_TOKEN_FILE, cfg._invalidSAToken ?
            (cfg.expSATokenData ? cfg.expSATokenData : SA_TOKEN) : null);
        //cfg._invalidSATokenFile indicates that the file path itself is
        //invalid so we should not write to it (cfg._invalidSAToken should
        //also be set to true in this case).
        if ('saTokenFile' in cfg && !cfg._invalidSATokenFile) {
            writeOrRemove(cfg.saTokenFile, saTokenData);
        }
    } else {
        writeOrRemove(DEFAULT_SA_TOKEN_FILE, saTokenData);
    }
}

function okeCfg(cfg, excludeURL) {
    const iamCfg = {
        useOKEWorkloadIdentity: true,
        _createFunc: cfg.createFunc
    };
    if ('durationSeconds' in cfg) {
        iamCfg.durationSeconds = cfg.durationSeconds;
    }
    if ('timeout' in cfg) {
        iamCfg.timeout = cfg.timeout;
    }
    if ('saToken' in cfg) {
        iamCfg.serviceAccountToken = cfg.saToken;
    }
    if ('saTokenProvider' in cfg) {
        iamCfg.serviceAccountTokenProvider = cfg.saTokenProvider;
    }
    if ('saTokenFile' in cfg) {
        iamCfg.serviceAccountTokenFile = cfg.saTokenFile;
    }
    iamCfg.securityTokenRefreshAheadMs =
        ('securityTokenRefreshAheadMs' in cfg) ?
            cfg.securityTokenRefreshAheadMs : 0;
    iamCfg.securityTokenExpireBeforeMs =
        ('securityTokenExpireBeforeMs' in cfg) ?
            cfg.securityTokenExpireBeforeMs : 0;
    return iam2cfg(iamCfg, COMPARTMENT_ID, excludeURL);
}

async function getOKEAuth(cfg) {
    prepConfig(cfg);
    const noSqlCfg = okeCfg(cfg);
    const provider = initAuthProvider(noSqlCfg);
    try {
        return await provider.getAuthorization(makeReq(noSqlCfg));
    } finally {
        provider.close();
    }
}

async function getIMDSRegion(cfg) {
    prepConfig(cfg);
    const provider = initAuthProvider(okeCfg(cfg));
    try {
        return await provider.getRegion();
    } finally {
        provider.close();
    }
}

const badSATokensNotNull = [
    ...badStrings,
    'nosuchtoken',
    makeST(-1), //expired token
];

const badSATokens = [
    undefined,
    null,
    ...badSATokensNotNull
];

//Used to specify invalid SA token values in a file.
const badSATokenValues = [
    null, // SA token file doesn't exist
    ...badSATokensNotNull.filter(val => typeof val === 'string')
];

const badSATokenProviders = [
    1,
    'aaaaa',
    new Date(),
    {
        //loadServiceAccountToken wrong spelling
        loadServiceAcountToken: async () => SA_TOKEN
    },
    {
        //loadServiceAccountToken must be function
        loadServiceAccountToken: null
    },
    {
        //loadServiceAccountToken must be function
        loadServiceAccountToken: SA_TOKEN,
    },
    ...badSATokens.map(val => ({
        loadServiceAccountToken: async () => val
    })),
    ...badSATokens.map(val => (async () => val)),
    async () => {
        await Utils.sleep(10);
        throw new Error('sa provider error');
    }
];

//For network errors we specify short timeout in order to avoid long retries.

const badIMDSConfigs = [
    {
        //invalid region code
        region: 'blah'
    },
    ...badMillis.map(timeout => ({
        region: Region.US_PHOENIX_1,
        timeout,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    {
        region: Region.AP_SEOUL_1,
        //metadata host down
        mdHostDown: true,
        timeout: 2000,
        errCode: ErrorCode.NETWORK_ERROR
    },
    {
        region: Region.AP_SYDNEY_1,
        //both metadata V1 and V2 are down
        missingMDV1: true,
        missingMDV2: true,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_NOT_FOUND
    }
];

const badAuthConfigs = [
    ...badMillis.map(timeout => ({
        timeout,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    {
        kubHostDown: true,
        timeout: 2000,
        errCode: ErrorCode.NETWORK_ERROR
    },
    {
        //KUBERNETES_SERVICE_HOST env variable not set
        kubHost: null,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    },
    {
        //Wrong value of KUBERNETES_SERVICE_HOST env variable
        kubHost: 'nosuchhost',
        timeout: 2000,
        errCode: ErrorCode.NETWORK_ERROR
    },
    {
        //Missing default CA certificate file
        saCert: null,
        _invalidCACert: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    },
    {
        //Wrong certificate in the default CA certificate file
        saCert: 'nosuchcert',
        _invalidCACert: true,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_UNAUTHORIZED
    },
    {
        //Missing specified CA certificate file
        saCertFile: SA_CERT_FILE,
        saCert: null,
        _invalidCACert: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    },
    {
        //Wrong certificate in the specified CA certificate file
        saCertFile: SA_CERT_FILE,
        saCert: 'nosuchcert',
        _invalidCACert: true,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_UNAUTHORIZED
    },
    ...badSATokenValues.map(_saTokenData => ({
        //Invalid SA token in default file or default file doesn't exist
        _saTokenData,
        _invalidSAToken: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    {
        //Wrong SA token specified, server should reject
        _saTokenData: SA_TOKEN2,
        _invalidSAToken: true,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_UNAUTHORIZED
    },
    ...badSATokensNotNull.map(saToken => ({
        //Invalid SA token in config
        saToken,
        _invalidSAToken: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    {
        //Wrong SA token specified in config, server should reject
        saToken: SA_TOKEN2,
        _invalidSAToken: true,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_UNAUTHORIZED
    },
    ...badSATokenProviders.map(saTokenProvider => ({
        //Invalid SA token provider in config
        saTokenProvider,
        _invalidSAToken: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    {
        //Wrong SA token returned by the provider, server should reject
        saTokenProvider: async () => SA_TOKEN2,
        _invalidSAToken: true,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_UNAUTHORIZED
    },
    ...badFilePathsNotNull.map(saTokenFile => ({
        //invalid service account token file
        saTokenFile,
        _invalidSAToken: true,
        _invalidSATokenFile: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    ...badSATokenValues.map(_saTokenData => ({
        saTokenFile: SA_TOKEN_FILE,
        //Invalid SA token value in the file specified in config or the file
        //doesn't exist.
        _saTokenData,
        _invalidSAToken: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    {
        //Wrong SA token specified in file, server should reject
        saTokenFile: SA_TOKEN_FILE,
        _saTokenData: SA_TOKEN2,
        _invalidSAToken: true,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_UNAUTHORIZED
    },
    {
        //cannot specify serviceAccountTokenProvider together with
        //serviceAccountToken
        saToken: SA_TOKEN,
        saTokenProvider: async () => SA_TOKEN,
        _invalidSAToken: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    },
    {
        //cannot specify serviceAccountTokenFile together with
        //serviceAccountToekn
        saToken: SA_TOKEN,
        saTokenFile: SA_TOKEN_FILE,
        _invalidSAToken: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    },
    {
        //cannot specify serviceAccountTokenProvider together with
        //serviceAccountTokenFile
        saTokenProvider: async () => SA_TOKEN,
        saTokenFile: SA_TOKEN_FILE,
        _invalidSAToken: true,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    }
];

class GoodSATP {
    async loadServiceAccountToken() {
        await Utils.sleep(10);
        return SA_TOKEN;
    }
}

const goodConfigs = [
    ...Region.values.map(region => ({ //valid config for all regions
        region
    })),
    {
        region: Region.AP_HYDERABAD_1,
        createFunc: () => IAMAuthorizationProvider.withOKEWorkloadIdentity()
    },
    {
        //test fallback to metadata V1
        region: Region.US_ASHBURN_1,
        missingMDV2: true
    },
    {
        //metadata V1 is not working shouldn't affect V2
        region: Region.US_ASHBURN_1,
        missingMDV1: true
    },
    {
        //custom service account certificate file path
        saCertFile: SA_CERT_FILE
    },
    {
        saToken: SA_TOKEN,
    },
    {
        region: Region.EU_AMSTERDAM_1,
        saToken: SA_TOKEN,
        createFunc: () => IAMAuthorizationProvider
            .withOKEWorkloadIdentity(SA_TOKEN),
    },
    {
        saTokenProvider: new GoodSATP()
    },
    {
        saTokenProvider: new GoodSATP(),
        saCertFile: SA_CERT_FILE,
        createFunc: () => IAMAuthorizationProvider
            .withOKEWorkloadIdentity(new GoodSATP())
    },
    {
        saTokenProvider: {
            loadServiceAccountToken: async () => SA_TOKEN
        }
    },
    {
        saTokeProvider: async () => { return SA_TOKEN; }
    },
    {
        saTokenFile: SA_TOKEN_FILE
    },
    {
        //specified the same SA token file as default
        saTokenFile: DEFAULT_SA_TOKEN_FILE
    },
    {
        saTokenFile: SA_TOKEN_FILE,
        createFunc: () => IAMAuthorizationProvider
            .withOKEWorkloadIdentityAndTokenFile(SA_TOKEN_FILE)
    }
];

//assign test case id to help debug failed cases
let testCaseId = 0;

function authProfile() {
    return {
        token: currentToken,
        publicKey: clientPublicKey
    };
}

function expectErrCode(cfg, res) {
    return expect(res).to.eventually.be.rejected.and.satisfy(
        err => err instanceof NoSQLError &&
        err.errorCode === cfg.errCode &&
        (cfg.httpStatus == null ||
        (err.cause instanceof NoSQLServiceError &&
        err.cause.statusCode === cfg.httpStatus)));
}

function testGetAuthNegative(cfg) {
    it(`getAuthorization negative, config: ${inspect(cfg)}, \
testCaseId=${testCaseId}}`, async function() {
        return expectErrCode(cfg, getOKEAuth(cfg));
    })._testCaseId = testCaseId++;
}

function testGetAuth(cfg) {
    it(`getAuthorization, config: ${inspect(cfg)}, testCaseId=${testCaseId}}`,
        async function() {
            const auth = await getOKEAuth(cfg);
            expect(currentToken).to.be.a('string').that.is.not.empty;
            verifyAuth(auth, authProfile(), COMPARTMENT_ID);
        })._testCaseId = testCaseId++;
}

function testGetRegionNegative(cfg) {
    //For negative testcases, when cfg has errCode specified, getRegion()
    //should throw, otherwise it returns undefined.
    it(`getRegion negative, config: ${inspect(cfg)}, \
testCaseId=${testCaseId}`, async function() {
        if (cfg.errCode != null) {
            return expectErrCode(cfg, getIMDSRegion(cfg));
        }
        const region = await getIMDSRegion(cfg);
        expect(region).to.not.exist;
    })._testCaseId = testCaseId++;
}

function testGetRegion(cfg) {
    it(`getRegion, config: ${inspect(cfg)}, testCaseId=${testCaseId}`,
        async function() {
            expect(cfg.region).to.be.instanceOf(Region);
            const region = await getIMDSRegion(cfg);
            expect(region).to.equal(cfg.region);
        })._testCaseId = testCaseId++;
}

function testServiceAccountTokenRefresh() {
    const cfg0 = {
        tokenTTL: 3600000
    };
    const saContainer = {};
    const saProvider = async () => saContainer.token;
    it('Default SA token file refresh on signature refresh',
        async function() {
            const cfg = Object.assign({
                durationSeconds: 1
            }, cfg0);
            prepConfig(cfg);
            const noSqlCfg = okeCfg(cfg);
            const provider = initAuthProvider(noSqlCfg);
            try {
                const req = makeReq(noSqlCfg);
                const auth0 = await provider.getAuthorization(req);
                const profile0 = authProfile();
                verifyAuth(auth0, profile0, COMPARTMENT_ID);
                await Utils.sleep(1200);
                cfg._saTokenData = SA_TOKEN2;
                cfg._expSATokenData = SA_TOKEN2;
                prepConfig(cfg);
                const auth = await provider.getAuthorization(req);
                const profile = authProfile();
                verifyAuthLaterDate(auth, auth0, profile, profile0,
                    COMPARTMENT_ID);
            } finally {
                provider.close();
            }
        });
    it('SA token file refresh on signature refresh',
        async function() {
            const cfg = Object.assign({
                durationSeconds: 1,
                saTokenFile: SA_TOKEN_FILE
            }, cfg0);
            prepConfig(cfg);
            const noSqlCfg = okeCfg(cfg);
            const provider = initAuthProvider(noSqlCfg);
            try {
                const req = makeReq(noSqlCfg);
                const auth0 = await provider.getAuthorization(req);
                const profile0 = authProfile();
                verifyAuth(auth0, profile0, COMPARTMENT_ID);
                await Utils.sleep(1200);
                cfg._saTokenData = SA_TOKEN2;
                cfg._expSATokenData = SA_TOKEN2;
                prepConfig(cfg);
                const auth = await provider.getAuthorization(req);
                const profile = authProfile();
                verifyAuthLaterDate(auth, auth0, profile, profile0,
                    COMPARTMENT_ID);
            } finally {
                provider.close();
            }
        });
    it('SA token provider refresh on signature refresh',
        async function() {
            const cfg = Object.assign({
                serviceAccountTokenProvider: saProvider,
                durationSeconds: 1
            }, cfg0);
            prepConfig(cfg);
            const noSqlCfg = okeCfg(cfg);
            const provider = initAuthProvider(noSqlCfg);
            try {
                saContainer.token = SA_TOKEN;
                const req = makeReq(noSqlCfg);
                const auth0 = await provider.getAuthorization(req);
                const profile0 = authProfile();
                verifyAuth(auth0, profile0, COMPARTMENT_ID);
                await Utils.sleep(1200);
                saContainer.token = SA_TOKEN2;
                cfg._expSATokenData = SA_TOKEN2;
                prepConfig(cfg);
                const auth = await provider.getAuthorization(req);
                const profile = authProfile();
                verifyAuthLaterDate(auth, auth0, profile, profile0,
                    COMPARTMENT_ID);
            } finally {
                provider.close();
            }
        });
    it('Default SA token file refresh on invalid auth', async function() {
        const cfg = Object.assign({}, cfg0);
        prepConfig(cfg);
        const noSqlCfg = okeCfg(cfg);
        const provider = initAuthProvider(noSqlCfg);
        try {
            const req = makeReq(noSqlCfg);
            const auth0 = await provider.getAuthorization(req);
            const profile0 = authProfile();
            verifyAuth(auth0, profile0, COMPARTMENT_ID);
            await Utils.sleep(1200);
            const req1 = Object.assign({
                lastError: new NoSQLError(ErrorCode.INVALID_AUTHORIZATION)
            }, req);
            cfg._saTokenData = SA_TOKEN2;
            cfg._expSATokenData = SA_TOKEN2;
            prepConfig(cfg);
            const auth = await provider.getAuthorization(req1);
            const profile = authProfile();
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID);
        } finally {
            provider.close();
        }
    });
    it('SA token file refresh on invalid auth', async function() {
        const cfg = Object.assign({
            saTokenFile: SA_TOKEN_FILE,
        }, cfg0);
        prepConfig(cfg);
        const noSqlCfg = okeCfg(cfg);
        const provider = initAuthProvider(noSqlCfg);
        try {
            const req = makeReq(noSqlCfg);
            const auth0 = await provider.getAuthorization(req);
            const profile0 = authProfile();
            verifyAuth(auth0, profile0, COMPARTMENT_ID);
            await Utils.sleep(1200);
            const req1 = Object.assign({
                lastError: new NoSQLError(ErrorCode.INVALID_AUTHORIZATION)
            }, req);
            cfg._saTokenData = SA_TOKEN2;
            cfg._expSATokenData = SA_TOKEN2;
            prepConfig(cfg);
            const auth = await provider.getAuthorization(req1);
            const profile = authProfile();
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID);
        } finally {
            provider.close();
        }
    });
    it('Delegation token provider refresh on invalid auth', async function() {
        const cfg = Object.assign({
            saTokenProvider: saProvider
        }, cfg0);
        prepConfig(cfg);
        const noSqlCfg = okeCfg(cfg);
        const provider = initAuthProvider(noSqlCfg);
        try {
            saContainer.token = SA_TOKEN;
            const req = makeReq(noSqlCfg);
            const auth0 = await provider.getAuthorization(req);
            const profile0 = authProfile();
            verifyAuth(auth0, profile0, COMPARTMENT_ID);
            await Utils.sleep(1200);
            const req1 = Object.assign({
                lastError: new NoSQLError(ErrorCode.INVALID_AUTHORIZATION)
            }, req);
            saContainer.token = SA_TOKEN2;
            cfg._expSATokenData = SA_TOKEN2;
            prepConfig(cfg);
            const auth = await provider.getAuthorization(req1);
            const profile = authProfile();
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID);
        } finally {
            provider.close();
        }
    });
}

function testGetRegionWithAuth() {
    const cfg = {
        region: Region.US_ASHBURN_1
    };
    it('getRegion before getAuthorization', async function() {
        prepConfig(cfg);
        const noSqlCfg = okeCfg(cfg);
        const provider = initAuthProvider(noSqlCfg);
        try {
            let region = await provider.getRegion();
            expect(region).to.equal(cfg.region);
            const auth = await provider.getAuthorization(makeReq(noSqlCfg));
            verifyAuth(auth, authProfile(), COMPARTMENT_ID);
            region = await provider.getRegion();
            expect(region).to.equal(cfg.region);
        } finally {
            provider.close();
        }
    });
    it('getRegion after getAuthorization', async function() {
        prepConfig(cfg);
        const noSqlCfg = okeCfg(cfg);
        const provider = initAuthProvider(noSqlCfg);
        try {
            const auth = await provider.getAuthorization(makeReq(noSqlCfg));
            verifyAuth(auth, authProfile(), COMPARTMENT_ID);
            const region = await provider.getRegion();
            expect(region).to.equal(cfg.region);
        } finally {
            provider.close();
        }
    });
}

function doTest() {
    for(let cfg of badIMDSConfigs) {
        testGetRegionNegative(cfg);
    }
    for(let cfg of badAuthConfigs) {
        testGetAuthNegative(cfg);
    }
    for(let cfg of goodConfigs) {
        if (cfg.region != null) {
            testGetRegion(cfg);
        }
        testGetAuth(cfg);
    }

    testTokenCache({}, okeCfg, prepConfig, authProfile, () => currentToken);
    testTokenAutoRefresh({}, okeCfg, prepConfig, authProfile,
        () => currentToken);
    testPrecacheAuth({}, okeCfg, prepConfig, authProfile, () => currentToken);
    testServiceAccountTokenRefresh();
    testGetRegionWithAuth();
    it('', () => {});
}

if (!Utils.isOnPrem) {
    describe('IAMAuthorizationProvider test', function() {
        this.timeout(60000);
        before(() => {
            mockfs();
            mockHttp.stub();
            mockHttps.stub();
        });
        after(() => {
            mockfs.restore();
            mockHttp.restore();
            mockHttps.restore();
        });
        doTest();
        it('', () => {});
    });
}
