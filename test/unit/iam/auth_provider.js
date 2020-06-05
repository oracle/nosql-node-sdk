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

const util = require('util');
const crypto = require('crypto');
const IAMAuthorizationProvider =
    require('../../../lib/auth/iam/auth_provider');
const ErrorCode = require('../../../lib/error').ErrorCode;
const NoSQLError = require('../../../lib/error').NoSQLError;
const HttpConstants = require('../../../lib/utils').HttpConstants;
const Utils = require('../utils');
const creds = require('./config').creds;
const makeTestFiles = require('./config').makeTestFiles;
const removeTestFiles = require('./config').removeTestFiles;
const badDirectConfigs = require('./config').badDirectConfigs;
const goodDirectConfigs = require('./config').goodDirectConfigs;
const badFileConfigs = require('./config').badFileConfigs;
const goodFileConfigs = require('./config').goodFileConfigs;
const badUserConfigs = require('./config').badUserConfigs;
const goodUserConfigs = require('./config').goodUserConfigs;

const serviceUrl = new URL('https://' + creds.serviceHost);

const COMPARTMENT_ID = 'test_compartment';

const HEADER_PATTERN = new RegExp('^Signature headers=".+?",\
keyId="(.+?)\\/(.+?)\\/(.+?)",algorithm="(.+?)",signature="(.+?)",\
version="(.+?)"$');

function signingContent(creds, dateStr) {
    return `${HttpConstants.REQUEST_TARGET}: post /\
${HttpConstants.NOSQL_DATA_PATH}\n\
${HttpConstants.HOST}: ${creds.serviceHost}\n\
${HttpConstants.DATE}: ${dateStr}`;
}

function verifyHeader(header, dateStr) {
    const match = header.match(HEADER_PATTERN);
    expect(match).to.be.an('array');
    expect(match.length).to.equal(7);
    expect(match[1]).to.equal(creds.tenantId);
    expect(match[2]).to.equal(creds.userId);
    expect(match[3]).to.equal(creds.fingerprint);
    const signature = match[5];
    //verify signature
    const verify = crypto.createVerify('sha256WithRSAEncryption');
    verify.update(signingContent(creds, dateStr));
    expect(verify.verify(creds.publicKey, signature, 'base64'))
        .to.equal(true);
}

function verifyAuth(auth, expectedCompartmentId) {
    expect(auth).to.be.an('object');
    expect(auth).to.haveOwnProperty(HttpConstants.AUTHORIZATION);
    expect(auth).to.haveOwnProperty(HttpConstants.DATE);
    expect(auth).to.haveOwnProperty(HttpConstants.COMPARTMENT_ID);
    const header = auth[HttpConstants.AUTHORIZATION];
    expect(header).to.be.a('string');
    const dateStr = auth[HttpConstants.DATE];
    expect(dateStr).to.be.a('string');
    expect(new Date(dateStr).getTime()).to.be.finite;
    const compartment = auth[HttpConstants.COMPARTMENT_ID];
    expect(compartment).to.be.a('string');
    expect(compartment).to.equal(expectedCompartmentId ?
        expectedCompartmentId : creds.tenantId);
    verifyHeader(header, dateStr);
}

function iam2cfg(cfg) {
    return {
        url: serviceUrl,
        auth: {
            iam: cfg
        }
    };
}

function makeReq(compartment) {
    const req = {
        opt: {}
    };
    if (compartment) {
        req.opt.compartment = compartment;
    }
    return req;
}

async function testConfig(cfg, compartment) {
    const provider = new IAMAuthorizationProvider(iam2cfg(cfg));
    try {
        return await provider.getAuthorization(makeReq(compartment));
    } finally {
        provider.close();
    }
}

function verifyEqual(auth, auth0, compartment) {
    verifyAuth(auth0, compartment);
    verifyAuth(auth, compartment);
    const header = auth[HttpConstants.AUTHORIZATION];
    const header0 = auth0[HttpConstants.AUTHORIZATION];
    const dateStr = auth[HttpConstants.DATE];
    const dateStr0 = auth0[HttpConstants.DATE];
    expect(header).to.equal(header0);
    expect(dateStr).to.equal(dateStr0);
}

function verifyGreater(auth, auth0, compartment) {
    verifyAuth(auth0, compartment);
    verifyAuth(auth, compartment);
    const header = auth[HttpConstants.AUTHORIZATION];
    const header0 = auth0[HttpConstants.AUTHORIZATION];
    const dateStr = auth[HttpConstants.DATE];
    const dateStr0 = auth0[HttpConstants.DATE];
    expect(header).to.not.equal(header0);
    expect(dateStr).to.not.equal(dateStr0);
    expect(new Date(dateStr).getTime()).to.be.greaterThan(
        new Date(dateStr0).getTime());
}

function testCacheAndRefresh(iamCfg) {
    it(`Cache test with iam config: \
${util.inspect(iamCfg)}`, async function() {
        const provider = new IAMAuthorizationProvider(iam2cfg(Object.assign({
            durationSeconds: 2,
            refreshAheadMs: null //disable refresh
        }, iamCfg)));
        try {
            const auth0 = await provider.getAuthorization(makeReq());
            await Utils.sleep(1000);
            let auth = await provider.getAuthorization(makeReq());
            verifyEqual(auth, auth0);
            await Utils.sleep(1100);
            auth = await provider.getAuthorization(makeReq());
            verifyGreater(auth, auth0);
        } finally {
            provider.close();
        }
    });
    it(`Refresh test with iam config: \
${util.inspect(iamCfg)}`, async function() {
        const provider = new IAMAuthorizationProvider(iam2cfg(Object.assign({
            durationSeconds: 3,
            refreshAheadMs: 1000
        }, iamCfg)));
        try {
            let auth0 = await provider.getAuthorization(makeReq());
            await Utils.sleep(1000);
            let auth = await provider.getAuthorization(makeReq());
            //+1000, no refresh yet
            verifyEqual(auth, auth0);
            await Utils.sleep(1200);
            auth = await provider.getAuthorization(makeReq());
            //+2200, automatic refresh should have happened
            verifyGreater(auth, auth0);
            auth0 = auth;
            await Utils.sleep(1700);
            auth = await provider.getAuthorization(makeReq());
            //+3900, shouldn't change again within 2s of last refresh
            verifyEqual(auth, auth0);
            await Utils.sleep(200);
            auth = await provider.getAuthorization(makeReq());
            //+4100, automatic refresh should have happened again
            verifyGreater(auth, auth0);
        } finally {
            provider.close();
        }
    });
}

function doTest() {
    for(let cfg of badDirectConfigs) {
        it(`Invalid direct config: ${util.inspect(cfg)}`, async function() {
            return expect(testConfig(cfg)).to.eventually.be
                .rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.ILLEGAL_ARGUMENT);
        });
    }
    for(let cfg of goodDirectConfigs) {
        it(`Valid direct config: ${util.inspect(cfg)}`, async function() {
            let auth = await testConfig(cfg);
            verifyAuth(auth);
            auth = await testConfig(cfg, COMPARTMENT_ID);
            verifyAuth(auth, COMPARTMENT_ID);
        });
    }
    for(let cfg of badFileConfigs) {
        it(`Invalid file config: ${util.inspect(cfg)}`, async function() {
            return expect(testConfig(cfg)).to.eventually.be
                .rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.ILLEGAL_ARGUMENT);
        });
    }
    for(let cfg of goodFileConfigs) {
        it(`Valid file config: ${util.inspect(cfg)}`, async function() {
            const auth = await testConfig(cfg);
            verifyAuth(auth);
        });
    }
    for(let cfg of badUserConfigs) {
        it(`Invalid file config: ${util.inspect(cfg)}`, async function() {
            return expect(testConfig(cfg)).to.eventually.be
                .rejected.and.satisfy(err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.ILLEGAL_ARGUMENT);
        });
    }
    for(let cfg of goodUserConfigs) {
        it(`Valid file config: ${util.inspect(cfg)}`, async function() {
            const auth = await testConfig(cfg);
            verifyAuth(auth);
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
        before(makeTestFiles);
        after(removeTestFiles);
        doTest();
        it('', () => {});
    });
}
