/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
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

const Region = require('../../../index').Region;
const ErrorCode = require('../../../index').ErrorCode;
const NoSQLError = require('../../../index').NoSQLError;
const NoSQLServiceError = require('../../../index').NoSQLServiceError;
const IAMAuthorizationProvider =
    require('../../../lib/auth/iam/auth_provider');
const HttpConstants = require('../../../lib/constants').HttpConstants;
const Utils = require('../utils');
const badMillis = require('../common').badMillis;
const badStrings = require('../common').badStrings;
const badStringsOrFunctions = require('../common').badStringsOrFunctions;
const MockHttp = require('./mock_http').MockHttp;
const MockHttps = require('./mock_http').MockHttps;
const makeST = require('./utils').makeST;
const iam2cfg = require('./utils').iam2cfg;
const makeReq = require('./utils').makeReq;
const inspect = require('./utils').inspect;
const verifyAuth = require('./utils').verifyAuth;
const writeOrRemove = require('./utils').writeOrRemove;
const verifyAuthLaterDate = require('./utils').verifyAuthLaterDate;
const COMPARTMENT_ID = require('./constants').COMPARTMENT_ID;
const CERT_INFO = require('./constants').CERT_INFO;
const DELEGATION_TOKEN_FILE = require('./constants').DELEGATION_TOKEN_FILE;
const DELEGATION_TOKEN = require('./constants').DELEGATION_TOKEN;
const DELEGATION_TOKEN2 = require('./constants').DELEGATION_TOKEN2;
const keys = require('./config').keys;

const SIGNING_HEADERS =
    'date (request-target) content-length content-type x-content-sha256';

const AUTH_HEADER_PATTERN = new RegExp('^Signature headers="(.+?)",\
keyId="(.+?)\\/fed-x509\\/(.+?)",algorithm="(.+?)",signature="(.+?)",\
version="(.+?)"$');

const METADATA_HOST = '169.254.169.254';
const METADATA_PATH_V2 = '/opc/v2/';
const METADATA_PATH_V1 = '/opc/v1/';

const DEFAULT_PURPOSE = 'DEFAULT';

function pemCert2derB64(pem) {
    //remove header and footer
    return pem.replace('-----BEGIN CERTIFICATE-----', '')
        .replace('-----END CERTIFICATE-----', '');
}

function signingContent(dateStr, path, payload, digest) {
    return `${HttpConstants.DATE}: ${dateStr}\n\
${HttpConstants.REQUEST_TARGET}: post ${path}\n\
${HttpConstants.CONTENT_LENGTH.toLowerCase()}: ${payload.length}\n\
${HttpConstants.CONTENT_TYPE.toLowerCase()}: \
${HttpConstants.APPLICATION_JSON}\n\
${HttpConstants.CONTENT_SHA256}: ${digest}`;
}

function verifyPayload(payload, cfg) {
    expect(() => {
        payload = JSON.parse(payload);
    }).to.not.throw();
    expect(payload.publicKey).to.be.a('string').that.is.not.empty;
    expect(() => {
        //Save public key created by instance principal client to verify auth
        //signature.
        clientPublicKey = crypto.createPublicKey({
            key: Buffer.from(payload.publicKey, 'base64'),
            format: 'der',
            type: 'spki'
        });
    }).to.not.throw();
    expect(payload.certificate).to.be.a('string');
    expect(payload.certificate).to.equal(pemCert2derB64(cfg.cert));
    expect(payload.purpose).to.equal(DEFAULT_PURPOSE);
    expect(payload.intermediateCertificates).to.be.an('array')
        .of.length(1);
    expect(payload.intermediateCertificates[0]).to.be.a('string').that.is
        .not.empty;
    expect(payload.intermediateCertificates[0]).to.equal(
        pemCert2derB64(cfg.intermediateCert));
}

function verifyAuthHeader(auth, payload, digest, dateStr, path, cfg) {
    const match = auth.match(AUTH_HEADER_PATTERN);
    expect(match).to.be.an('array');
    expect(match.length).to.equal(7);
    expect(match[1]).to.equal(SIGNING_HEADERS);
    expect(match[2]).to.equal(cfg.tenantId);
    expect(match[3].toUpperCase()).to.equal(cfg.fingerprint.toUpperCase());
    const signature = match[5];
    //verify signature
    const verify = crypto.createVerify('sha256WithRSAEncryption');
    verify.update(signingContent(dateStr, path, payload, digest));
    const publicKey = crypto.createPublicKey(cfg.cert);
    expect(verify.verify(publicKey, signature, 'base64'))
        .to.equal(true);
}

function verifyRequest(payload, opt, cfg) {
    const headers = opt.headers;
    let digest, dateStr, auth;
    try {
        verifyPayload(payload, cfg);
        expect(opt.path).to.be.a('string').that.is.not.empty;
        expect(headers[HttpConstants.CONTENT_TYPE]).to.equal(
            HttpConstants.APPLICATION_JSON);
        digest = headers[HttpConstants.CONTENT_SHA256];
        expect(digest).to.be.a('string').that.is.not.empty;
        dateStr = headers[HttpConstants.DATE];
        expect(dateStr).to.be.a('string');
        expect(Date.parse(dateStr)).to.be.finite;
        auth = headers[HttpConstants.AUTHORIZATION];
        expect(auth).to.be.a('string').that.is.not.empty;
    } catch(err) {
        throw MockHttp.badRequest(err.stack);
    }
    try {
        verifyAuthHeader(auth, payload, digest, dateStr, opt.path, cfg);
    } catch(err) {
        throw MockHttp.unauthorized(err.stack);
    }
}

const mockHttp = new MockHttp();
const mockHttps = new MockHttps();

//We keep current token issued by MockHttps as well as public key created by
//instance principal client to verify auth.
let token;
let clientPublicKey;

function prepConfig(cfg) {
    mockHttp.clear();
    mockHttps.clear();
    const isValidRegion = cfg.region instanceof Region;
    const region = isValidRegion ? cfg.region.regionCode : cfg.region;
    //assume self-signed certificate by default
    const intermediateCert = 'intermediateCert' in cfg ?
        cfg.intermediateCert : cfg.cert;
    if (!cfg.mdHostDown) {
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V2 +
            'instance/region', cfg.missingMDV2 ? MockHttp.notFound() :
            region);
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V2 +
            'identity/cert.pem', cfg.missingMDV2 ? MockHttp.notFound() :
            cfg.cert);
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V2 +
            'identity/key.pem', cfg.missingMDV2 ? MockHttp.notFound() :
            cfg.privateKey);
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V2 +
            'identity/intermediate.pem', cfg.missingMDV2 ?
            MockHttp.notFound() :intermediateCert);
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V1 +
            'instance/region', cfg.missingMDV1 ? MockHttp.notFound() :
            region);
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V1 +
            'identity/cert.pem', cfg.missingMDV1 ? MockHttp.notFound() :
            cfg.cert);
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V1 +
            'identity/key.pem', cfg.missingMDV1 ? MockHttp.notFound() :
            cfg.privateKey);
        mockHttp.setEndpoint(METADATA_HOST, METADATA_PATH_V1 +
            'identity/intermediate.pem', cfg.missingMDV1 ?
            MockHttp.notFound() :intermediateCert);
    }
    let fedHost;
    if (isValidRegion) {
        fedHost =
            `auth.${cfg.region.regionId}.${cfg.region.secondLevelDomain}`;
    } else if (cfg.fedEP != null) {
        //to test invalid federation endpoint, the config should specify
        //valid region, otherwise it assumed the federation endpoint is valid
        expect(() => new URL(cfg.fedEP)).to.not.throw; //test self-check
        fedHost = new URL(cfg.fedEP).host;
    }
    if (fedHost) {
        mockHttps.setEndpoint(fedHost, '/v1/x509', (opt, payload) => {
            MockHttps.checkMethod(opt, HttpConstants.POST);
            verifyRequest(payload, opt, cfg);
            token = makeST(cfg.tokenTTL ? cfg.tokenTTL : 3000);
            return { token };
        });
    }

    //delegation token file
    if ('_delegationTokenData' in cfg &&
        typeof cfg.delegationTokenProvider === 'string') {
        writeOrRemove(cfg.delegationTokenProvider, cfg._delegationTokenData);
    }
}

function ipCfg(cfg) {
    const iamCfg = {
        useInstancePrincipal: true
    };
    if ('durationSeconds' in cfg) {
        iamCfg.durationSeconds = cfg.durationSeconds;
    }
    if ('timeout' in cfg) {
        iamCfg.timeout = cfg.timeout;
    }
    if ('fedEP' in cfg) {
        iamCfg.federationEndpoint = cfg.fedEP;
    }
    if ('delegationToken' in cfg) {
        iamCfg.delegationToken = cfg.delegationToken;
    }
    if ('delegationTokenProvider' in cfg) {
        iamCfg.delegationTokenProvider = cfg.delegationTokenProvider;
    }
    return iam2cfg(iamCfg, COMPARTMENT_ID);
}

async function testConfig(cfg) {
    prepConfig(cfg);
    const noSqlCfg = ipCfg(cfg);
    const provider = new IAMAuthorizationProvider(noSqlCfg);
    try {
        return await provider.getAuthorization(makeReq(noSqlCfg));
    } finally {
        provider.close();
    }
}

class GoodDTP {
    async loadDelegationToken() {
        await Utils.sleep(10);
        return DELEGATION_TOKEN;
    }
}

const goodConfigs = [
    ...Region.values.map(region => ({ //valid config for all regions
        __proto__: CERT_INFO[0],
        region
    })),
    {   //user's provided valid federationEndpoint
        __proto__: CERT_INFO[0],
        fedEP: 'https://auth.ap-hyderabad-1.oraclecloud.com'
    },
    {   //user's provided valid federationEndpoint as URL
        __proto__: CERT_INFO[0],
        fedEP: new URL('https://auth.ap-tokyo-1.oraclecloud.com')
    },
    {
        //test fallback to metadata V1
        __proto__: CERT_INFO[0],
        region: Region.US_ASHBURN_1,
        missingMDV2: true
    },
    {
        //metadata V1 is not working shouldn't affect V2
        __proto__: CERT_INFO[0],
        region: Region.US_ASHBURN_1,
        missingMDV1: true
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.EU_AMSTERDAM_1,
        delegationToken: DELEGATION_TOKEN,
        _delegationTokenData: DELEGATION_TOKEN
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.EU_FRANKFURT_1,
        delegationTokenProvider: new GoodDTP(),
        _delegationTokenData: DELEGATION_TOKEN
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.ME_DUBAI_1,
        delegationTokenProvider: {
            loadDelegationToken: async () => DELEGATION_TOKEN
        },
        _delegationTokenData: DELEGATION_TOKEN
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.ME_DUBAI_1,
        delegationTokenProvider: async () => {
            return DELEGATION_TOKEN;
        },
        _delegationTokenData: DELEGATION_TOKEN
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.ME_JEDDAH_1,
        delegationTokenProvider: DELEGATION_TOKEN_FILE,
        _delegationTokenData: DELEGATION_TOKEN
    }
];

const badFedEPs = [
    0,
    [],
    new Date(),
    'blahblahblah',
    //has path
    'https://auth.us-phoenix-1.oraclecloud.com/a/b/c/',
    //has search params
    new URL('https://auth.us-phoenix-1.oraclecloud.com/?a=1'),
    //no port allowed
    'https://auth.us-phoenix-1.oraclecloud.com:8181',
    //hostname must start with "auth."
    'https://blah.us-phoenix-1.oraclecloud.com',
    //wrong protocol
    'http://auth.us-ashburn-1.oraclecloud.com'
];

const badDelegationTokenProviders = [
    //this may include objects but they will not be valid delegation token
    //providers
    ...badStringsOrFunctions,
    'no_such_file', //non-existent file
    {
        //loadDelegationToken wrong spelling
        loadDelegatoinToken: async () => DELEGATION_TOKEN
    },
    {
        loadDelegationToken: null //loadDelegationToken must be function
    },
    {
        //loadDelegationToken must be function
        loadDelegationToken: DELEGATION_TOKEN,
    },
    ...badStrings.map(val => ({
        loadDelegationToken: async () => val
    })),
    ...badStrings.map(val => (async () => val)),
    async () => {
        await Utils.sleep(10);
        throw new Error('dt provider error');
    }
];

//For network errors we specify short timeout in order to avoid long retries.

const badConfigs = [
    {
        //invalid region code
        __proto__: CERT_INFO[0],
        region: 'blah',
        errCode: ErrorCode.ILLEGAL_STATE
    },
    ...badFedEPs.map(fedEP => ({
        __proto__: CERT_INFO[0],
        region: Region.AP_SYDNEY_1,
        fedEP, //invalid value for federationEndpoint
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    ...badMillis.map(timeout => ({
        __proto__: CERT_INFO[0],
        timeout,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    {
        __proto__: CERT_INFO[0],
        region: Region.AP_SEOUL_1,
        //metadata host down
        mdHostDown: true,
        timeout: 2000,
        errCode: ErrorCode.NETWORK_ERROR
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.AP_SYDNEY_1,
        //both metadata V1 and V2 are down
        missingMDV1: true,
        missingMDV2: true,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_NOT_FOUND
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.EU_AMSTERDAM_1,
        //missing certificates and keys
        cert: '',
        privateKey: '',
        intermediateCert: '',
        //cannot obtain tenant id from cert
        errCode: ErrorCode.ILLEGAL_STATE
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.AP_MUMBAI_1,
        //missing intermediate certificate
        intermediateCert: '',
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_BAD_REQUEST
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.AP_MUMBAI_1,
        //missing instance private key
        privateKey: '',
        //cannot create private key object
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.EU_FRANKFURT_1,
        //wrong private key
        privateKey: keys.privatePEM,
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_UNAUTHORIZED
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.AP_TOKYO_1,
        //different tenant id in the certificate
        tenantId: 'TestTenant2',
        errCode: ErrorCode.SERVICE_ERROR,
        httpStatus: HttpConstants.HTTP_UNAUTHORIZED
    },
    ...badStrings.map(delegationToken => ({
        __proto__: CERT_INFO[0],
        region: Region.AP_MUMBAI_1,
        //invalid delegation token
        delegationToken,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    ...badDelegationTokenProviders.map(delegationTokenProvider => ({
        __proto__: CERT_INFO[0],
        region: Region.AP_OSAKA_1,
        //invalid delegation token provider
        delegationTokenProvider,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    })),
    {
        __proto__: CERT_INFO[0],
        region: Region.AP_MELBOURNE_1,
        delegationTokenProvider: DELEGATION_TOKEN_FILE,
        // empty delegation token in file
        _delegationTokenData: '',
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    },
    {
        __proto__: CERT_INFO[0],
        region: Region.US_PHOENIX_1,
        //cannot specify delegationTokenProvider together with
        //delegationToken
        delegationToken: DELEGATION_TOKEN,
        delegationTokenProvider: async () => DELEGATION_TOKEN,
        errCode: ErrorCode.ILLEGAL_ARGUMENT
    }
];

//assign test case id to help debug failed cases
let testCaseId = 0;

function authProfile() {
    return {
        token,
        publicKey: clientPublicKey
    };
}

function testTokenCache() {
    const cfg = {
        __proto__: CERT_INFO[0],
        region: Region.US_PHOENIX_1,
        tokenTTL: 3000
    };
    const noSqlCfg = ipCfg(cfg);
    const ipReq = makeReq(noSqlCfg);
    it('Token cache test', async function() {
        prepConfig(cfg);
        const provider = new IAMAuthorizationProvider(noSqlCfg);
        try {
            const auth0 = await provider.getAuthorization(ipReq);
            let profile0 = authProfile();
            expect(profile0.token).to.be.a('string').that.is.not.empty;
            verifyAuth(auth0, profile0, COMPARTMENT_ID);
            await Utils.sleep(1000);
            provider.clearCache();
            let auth = await provider.getAuthorization(ipReq);
            //after 1 second should still be same token
            expect(token).to.equal(profile0.token);
            //different signature but same profile
            verifyAuthLaterDate(auth, auth0, profile0, profile0,
                COMPARTMENT_ID);
            await Utils.sleep(3000);
            provider.clearCache();
            auth = await provider.getAuthorization(ipReq);
            //since 4 seconds elapsed, should get different token
            let profile = authProfile();
            expect(profile.token).to.not.equal(profile0.token);
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID);
        } finally {
            provider.close();
        }
    });
    it('Token invalidate on invalid auth test', async function() {
        prepConfig(cfg);
        const provider = new IAMAuthorizationProvider(noSqlCfg);
        try {
            const auth0 = await provider.getAuthorization(ipReq);
            let profile0 = authProfile();
            provider.clearCache();
            await Utils.sleep(1000);
            const req1 = Object.assign({
                lastError: new NoSQLError(ErrorCode.INVALID_AUTHORIZATION)
            }, ipReq);
            let auth = await provider.getAuthorization(req1);
            let profile = authProfile();
            //Even though the token has not expired, because request failed,
            //we should receive new token.
            expect(profile.token).to.not.equal(profile0.token);
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID);
        } finally {
            provider.close();
        }
    });
}

function testDelegationTokenRefresh() {
    const cfg0 = {
        __proto__: CERT_INFO[0],
        region: Region.US_PHOENIX_1,
        tokenTTL: 3600000
    };
    const dtContainer = {};
    const dtProvider = async () => dtContainer.token;
    it('Delegation token file refresh on signature refresh',
        async function() {
            const cfg = Object.assign({
                delegationTokenProvider: DELEGATION_TOKEN_FILE,
                durationSeconds: 1
            }, cfg0);
            const noSqlCfg = ipCfg(cfg);
            const provider = new IAMAuthorizationProvider(noSqlCfg);
            try {
                writeOrRemove(DELEGATION_TOKEN_FILE, DELEGATION_TOKEN);
                const ipReq = makeReq(noSqlCfg);
                const auth0 = await provider.getAuthorization(ipReq);
                const profile0 = authProfile();
                verifyAuth(auth0, profile0, COMPARTMENT_ID,
                    DELEGATION_TOKEN);
                await Utils.sleep(1200);
                writeOrRemove(DELEGATION_TOKEN_FILE, DELEGATION_TOKEN2);
                const auth = await provider.getAuthorization(ipReq);
                const profile = authProfile();
                verifyAuthLaterDate(auth, auth0, profile, profile0,
                    COMPARTMENT_ID, DELEGATION_TOKEN2, DELEGATION_TOKEN);
            } finally {
                provider.close();
            }
        });
    it('Delegation token provider refresh on signature refresh',
        async function() {
            const cfg = Object.assign({
                delegationTokenProvider: dtProvider,
                durationSeconds: 1
            }, cfg0);
            const noSqlCfg = ipCfg(cfg);
            const provider = new IAMAuthorizationProvider(noSqlCfg);
            try {
                dtContainer.token = DELEGATION_TOKEN;
                const ipReq = makeReq(noSqlCfg);
                const auth0 = await provider.getAuthorization(ipReq);
                const profile0 = authProfile();
                verifyAuth(auth0, profile0, COMPARTMENT_ID, DELEGATION_TOKEN);
                await Utils.sleep(1200);
                dtContainer.token = DELEGATION_TOKEN2;
                const auth = await provider.getAuthorization(ipReq);
                const profile = authProfile();
                verifyAuthLaterDate(auth, auth0, profile, profile0,
                    COMPARTMENT_ID, DELEGATION_TOKEN2, DELEGATION_TOKEN);
            } finally {
                provider.close();
            }
        });
    it('Delegation token file refresh on invalid auth', async function() {
        const cfg = Object.assign({
            delegationTokenProvider: DELEGATION_TOKEN_FILE
        }, cfg0);
        const noSqlCfg = ipCfg(cfg);
        const provider = new IAMAuthorizationProvider(noSqlCfg);
        try {
            writeOrRemove(DELEGATION_TOKEN_FILE, DELEGATION_TOKEN);
            const ipReq = makeReq(noSqlCfg);
            const auth0 = await provider.getAuthorization(ipReq);
            const profile0 = authProfile();
            verifyAuth(auth0, profile0, COMPARTMENT_ID, DELEGATION_TOKEN);
            await Utils.sleep(1200);
            const req1 = Object.assign({
                lastError: new NoSQLError(ErrorCode.INVALID_AUTHORIZATION)
            }, ipReq);
            writeOrRemove(DELEGATION_TOKEN_FILE, DELEGATION_TOKEN2);
            const auth = await provider.getAuthorization(req1);
            const profile = authProfile();
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID, DELEGATION_TOKEN2, DELEGATION_TOKEN);
        } finally {
            provider.close();
        }
    });
    it('Delegation token provider refresh on invalid auth', async function() {
        const cfg = Object.assign({
            delegationTokenProvider: dtProvider
        }, cfg0);
        const noSqlCfg = ipCfg(cfg);
        const provider = new IAMAuthorizationProvider(noSqlCfg);
        try {
            dtContainer.token = DELEGATION_TOKEN;
            const ipReq = makeReq(noSqlCfg);
            const auth0 = await provider.getAuthorization(ipReq);
            const profile0 = authProfile();
            verifyAuth(auth0, profile0, COMPARTMENT_ID, DELEGATION_TOKEN);
            await Utils.sleep(1200);
            const req1 = Object.assign({
                lastError: new NoSQLError(ErrorCode.INVALID_AUTHORIZATION)
            }, ipReq);
            dtContainer.token = DELEGATION_TOKEN2;
            const auth = await provider.getAuthorization(req1);
            const profile = authProfile();
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID, DELEGATION_TOKEN2, DELEGATION_TOKEN);
        } finally {
            provider.close();
        }
    });
}

function doTest() {
    for(let cfg of goodConfigs) {
        it(`Valid config: ${inspect(cfg)}, testCaseId=${testCaseId}}`,
            async function() {
                const auth = await testConfig(cfg);
                expect(token).to.be.a('string').that.is.not.empty;
                verifyAuth(auth, authProfile(), COMPARTMENT_ID,
                    cfg._delegationTokenData);
            })._testCaseId = testCaseId++;
    }
    for(let cfg of badConfigs) {
        it(`Invalid config: ${inspect(cfg)}, testCaseId=${testCaseId}}`,
            async function() {
                return expect(testConfig(cfg)).to.eventually.be.rejected
                    .and.satisfy(err => err instanceof NoSQLError &&
                    err.errorCode === cfg.errCode &&
                    (cfg.httpStatus == null ||
                    (err.cause instanceof NoSQLServiceError &&
                    err.cause.statusCode === cfg.httpStatus)));
            })._testCaseId = testCaseId++;
    }
    testTokenCache();
    testDelegationTokenRefresh();
}

before(() => mockfs());
after(() => mockfs.restore());


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
