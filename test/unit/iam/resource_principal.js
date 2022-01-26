/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;

const process = require('process');
const path = require('path');
const mockfs = require('mock-fs');

const IAMAuthorizationProvider =
    require('../../../lib/auth/iam/auth_provider');
const ErrorCode = require('../../../lib/error_code');
const NoSQLError = require('../../../lib/error').NoSQLError;
const Utils = require('../utils');
const COMPARTMENT_ID = require('./constants').COMPARTMENT_ID;
const PASSPHRASE = require('./constants').PASSPHRASE;
const ST_HEADER = require('./constants').ST_HEADER;
const ST_SIG = require('./constants').ST_SIG;
const keys = require('./config').keys;
const PRIVATE_KEY_FILE = require('./config').PRIVATE_KEY_FILE;
const badPrivateKeyPEMs = require('./config').badPrivateKeyPEMs; 
const writeOrRemove = require('./utils').writeOrRemove;
const base64UrlEncode = require('./utils').base64UrlEncode;
const makeSTPayload = require('./utils').makeSTPayload;
const iam2cfg = require('./utils').iam2cfg;
const makeReq = require('./utils').makeReq;
const verifyAuth = require('./utils').verifyAuth;
const createKeys = require('./utils').createKeys;
const makeST = require('./utils').makeST;
const verifyAuthEqual = require('./utils').verifyAuthEqual;
const verifyAuthLaterDate = require('./utils').verifyAuthLaterDate;
const inspect = require('./utils').inspect;

const RP_VERSION_2_2 = '2.2';

const rpst = makeST(100000000);

const passFile = path.resolve('key_private_pass');
const rpstFile = path.resolve('rpst');

function setOrUnsetEnv(key, val) {
    if (val != null) {
        process.env[key] = val;
    } else {
        delete process.env[key];
    }
}

function prepEnv(env) {
    setOrUnsetEnv('OCI_RESOURCE_PRINCIPAL_VERSION', env.ver);
    setOrUnsetEnv('OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM', env.pk);
    writeOrRemove(env.pk, env.pkData);
    setOrUnsetEnv('OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM_PASSPHRASE', env.pass);
    writeOrRemove(env.pass, env.passData);
    setOrUnsetEnv('OCI_RESOURCE_PRINCIPAL_RPST', env.rpst);
    writeOrRemove(env.rpst, env.rpstData);
    setOrUnsetEnv('OCI_RESOURCE_PRINCIPAL_REGION', env.region);
}

const rpCfg = iam2cfg({
    useResourcePrincipal: true,
    refreshAheadMs: null //disable signature auto-refresh
}, COMPARTMENT_ID);

const rpReq = makeReq(rpCfg);

async function testEnv(env) {
    prepEnv(env);
    const provider = new IAMAuthorizationProvider(rpCfg);
    try {
        return await provider.getAuthorization(rpReq);
    } finally {
        provider.close();
    }
}

const goodEnvs = [
    {
        ver: RP_VERSION_2_2,
        pk: keys.privatePEM,
        rpst,
        region: 'us-phoenix-1'
    },
    {
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        pkData: keys.privatePEM,
        rpst,
        region: 'ca-montreal-1'
    },
    {
        ver: RP_VERSION_2_2,
        pk: keys.privateEncPEM,
        pass: PASSPHRASE,
        rpst,
        region: 'ca-montreal-1'
    },
    {
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        pkData: keys.privateEncPEM,
        pass: passFile,
        passData: PASSPHRASE,
        rpst,
        region: 'us-luke-1'
    },
    {
        ver: RP_VERSION_2_2,
        pk: keys.privatePEM,
        rpst : rpstFile,
        rpstData: rpst,
        region: 'us-ashburn-1'
    },
    {
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        pkData: keys.privatePEM,
        rpst : rpstFile,
        rpstData: rpst,
        region: 'sa-saopaulo-1'
    },
    {
        ver: RP_VERSION_2_2,
        pk: keys.privateEncPEM,
        pass: PASSPHRASE,
        rpst : rpstFile,
        rpstData: rpst,
        region: 'ap-mumbai-1'
    },
    {
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        pkData: keys.privateEncPEM,
        pass: passFile,
        passData: PASSPHRASE,
        rpst,
        region: 'ap-sydney-1'
    }
];

const badVers = [ null, '', '2.1' ];

const badRPSTs = [ null, '', 'blah', path.resolve('nosuchfile'),
    'aaa.bbb.ccc',
    ST_HEADER + '.' + base64UrlEncode(makeSTPayload(1000)) + ST_SIG];

const badEnvs = [
    ...badVers.map(ver => ({ //missing or invalid version
        ver,
        pk: keys.privatePEM,
        rpst,
        region: 'us-phoenix-1'        
    })),
    {   //missing region
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        pkData: keys.privatePEM,
        rpst
    },
    ...badRPSTs.map(rpst => ({ //missing or invalid rpst
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        pkData: keys.privatePEM,
        rpst,
        region: 'us-phoenix-1'
    })),
    ...badRPSTs.map(rpstData => ({ //missing or invalid rpst in file
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        pkData: keys.privatePEM,
        rpst: rpstFile,
        rpstData,
        region: 'us-phoenix-1'
    })),
    ...badPrivateKeyPEMs.map(pk => ({
        ver: RP_VERSION_2_2,
        pk,
        rpst,
        region: 'us-ashburn-1'
    })),
    ...badPrivateKeyPEMs.map(pkData => ({
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        pkData,
        rpst,
        region: 'us-ashburn-1'
    }))
];

function testTokenCache() {
    const rpEnv = {
        ver: RP_VERSION_2_2,
        pk: PRIVATE_KEY_FILE,
        rpst : rpstFile,
        region: 'sa-saopaulo-1'
    };
    let kp;
    let st;
    const updateEnv = () => {
        kp = createKeys();
        st = makeST(3000);
        rpEnv.pkData = kp.privatePEM;
        rpEnv.rpstData = st;
        prepEnv(rpEnv);
    };
    it('Token cache test', async function() {
        updateEnv();
        const provider = new IAMAuthorizationProvider(rpCfg);
        try {
            let profile0 = { token: st, publicKey: kp.publicKey };
            const auth0 = await provider.getAuthorization(rpReq);
            verifyAuth(auth0, profile0, COMPARTMENT_ID);
            //obtain new key pair and token
            updateEnv();
            let profile = { token: st, publicKey: kp.publicKey };
            await Utils.sleep(1000);
            let auth = await provider.getAuthorization(rpReq);
            //still same signature
            verifyAuthEqual(auth, auth0, profile0, COMPARTMENT_ID);
            provider.clearCache();
            auth = await provider.getAuthorization(rpReq);
            //different signature but same profile
            verifyAuthLaterDate(auth, auth0, profile0, profile0,
                COMPARTMENT_ID);
            await Utils.sleep(3000);
            provider.clearCache();
            auth = await provider.getAuthorization(rpReq);
            //since 4 seconds elapsed, different signature and new profile
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID);
        } finally {
            provider.close();
        }
    });
    it('Token invalidate on invalid auth test', async function() {
        updateEnv();
        const provider = new IAMAuthorizationProvider(rpCfg);
        try {
            let profile0 = { token: st, publicKey: kp.publicKey };
            const auth0 = await provider.getAuthorization(rpReq);
            //obtain new key pair and token
            updateEnv();
            let profile = { token: st, publicKey: kp.publicKey };
            provider.clearCache();
            await Utils.sleep(1000);
            const req1 = Object.assign({
                lastError: new NoSQLError(ErrorCode.INVALID_AUTHORIZATION)
            }, rpReq);
            //Even though the token has not expired, because request failed,
            //we should receive new token.
            let auth = await provider.getAuthorization(req1);
            verifyAuthLaterDate(auth, auth0, profile, profile0,
                COMPARTMENT_ID);
        } finally {
            provider.close();
        }
    });
}

//assign test case id to help debug failed cases, do on as needed basis for now
let testCaseId = 0;

function doTest() {
    const profile = {
        publicKey: keys.publicKey,
        token: rpst
    };
    for(let env of badEnvs) {
        it(`Invalid env: ${inspect(env)}`, async function() {
            return expect(testEnv(env)).to.eventually.be
                .rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.ILLEGAL_ARGUMENT);
        });
    }
    for(let env of goodEnvs) {
        it(`Valid env: ${inspect(env)}, testCaseId=${testCaseId}`,
            async function() {
                let auth = await testEnv(env);
                verifyAuth(auth, profile, COMPARTMENT_ID);
            })._testCaseId = testCaseId++;
    }
    testTokenCache();
}

if (!Utils.isOnPrem) {
    describe('Resource Principal test', function() {
        this.timeout(60000);
        before(() => mockfs());
        after(() => mockfs.restore());
        doTest();
        it('', () => {});
    });
}
