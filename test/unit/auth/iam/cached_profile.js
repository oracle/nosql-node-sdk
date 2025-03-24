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

const NoSQLClient = require('../../../../index').NoSQLClient;
const Region = require('../../../../index').Region;
const ErrorCode = require('../../../../index').ErrorCode;
const NoSQLError = require('../../../../index').NoSQLError;
const IAMAuthorizationProvider =
    require('../../../../lib/auth/iam/auth_provider');
const Utils = require('../../utils');
const initAuthProvider = require('./utils').initAuthProvider;
const makeReq = require('./utils').makeReq;
const verifyAuth = require('./utils').verifyAuth;
const verifyAuthLaterDate = require('./utils').verifyAuthLaterDate;
const COMPARTMENT_ID = require('./constants').COMPARTMENT_ID;

function testTokenCache(cfg, cfg2iam, prepConfig, authProfile, currentToken) {
    cfg = Object.assign({
        __proto__: cfg.__proto__,
        tokenTTL: 5000,
        durationSeconds: 10,
        securityTokenExpireBeforeMs: 2000
    }, cfg);
    const noSqlCfg = cfg2iam(cfg);
    const ipReq = makeReq(noSqlCfg);
    it('Token cache test', async function() {
        prepConfig(cfg);
        const provider = initAuthProvider(noSqlCfg);
        try {
            const auth0 = await provider.getAuthorization(ipReq);
            let profile0 = authProfile();
            expect(profile0.token).to.be.a('string').that.is.not.empty;
            verifyAuth(auth0, profile0, COMPARTMENT_ID);
            await Utils.sleep(1000);
            provider.clearCache();
            let auth = await provider.getAuthorization(ipReq);
            //after 1 second should still be same token
            expect(currentToken()).to.equal(profile0.token);
            //different signature (we cleared signature cache),
            //but the same profile
            verifyAuthLaterDate(auth, auth0, profile0, profile0,
                COMPARTMENT_ID);
            await Utils.sleep(3000);
            auth = await provider.getAuthorization(ipReq);
            //4 seconds elapsed, so we are within expireBeforeMs window,
            //the token should be refreshed and signature regenerated
            //(even though we didn't clear signature cache and the signature
            //did not expire).
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
        const provider = initAuthProvider(noSqlCfg);
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

function testTokenAutoRefresh(cfg, cfg2iam, prepConfig, authProfile,
    currentToken) {
    cfg = Object.assign({
        __proto__: cfg.__proto__,
        tokenTTL: 5000,
        durationSeconds: 10,
        securityTokenExpireBeforeMs: 0,
        securityTokenRefreshAheadMs: 2000
    }, cfg);
    const noSqlCfg = cfg2iam(cfg);
    const ipReq = makeReq(noSqlCfg);
    it('Token auto-refresh test', async function() {
        prepConfig(cfg);
        const provider = initAuthProvider(noSqlCfg);
        try {
            const auth0 = await provider.getAuthorization(ipReq);
            let profile0 = authProfile();
            expect(profile0.token).to.be.a('string').that.is.not.empty;
            verifyAuth(auth0, profile0, COMPARTMENT_ID);
            await Utils.sleep(1000);
            let auth = await provider.getAuthorization(ipReq);
            //after 1 second should still be same token
            expect(currentToken()).to.equal(profile0.token);
            await Utils.sleep(3000);
            //4 seconds elapsed, we are within refreshAheadMs window,
            //the provider should have obtained new token (without call
            //to getAuthorization()).
            let profile1 = authProfile();
            expect(profile1.token).to.not.equal(profile0.token);

            auth = await provider.getAuthorization(ipReq);
            let profile2 = authProfile();

            //The token was already refreshed in the background, so
            //getAuthorization() should not have changed it again.
            expect(profile2.token).to.equal(profile1.token);

            //we should have new signature
            verifyAuthLaterDate(auth, auth0, profile2, profile0,
                COMPARTMENT_ID);
        } finally {
            provider.close();
        }
    });
}

function testPrecacheAuth(cfg, cfg2iam, prepConfig, authProfile,
    currentToken) {
    cfg = Object.assign({
        __proto__: cfg.__proto__,
        region: Region.US_PHOENIX_1,
        tokenTTL: 1000,
        durationSeconds: 10,
        securityTokenExpireBeforeMs: 0,
        //disable token background refresh
        securityTokenRefreshAheadMs: 0
    }, cfg);
    const noSqlCfg = cfg2iam(cfg, true);
    const ipReq = makeReq(noSqlCfg);
    it('Precache auth test', async function() {
        prepConfig(cfg);
        let client;
        try {
            client = await new NoSQLClient(noSqlCfg)
                .precacheAuth();
            
            //precacheAuth() should have obtained new token and created
            //the auth signature.
            const profile0 = authProfile();
            expect(profile0.token).to.to.be.a('string').that.is.not.empty;

            //We can't make any real requests with this client, so we have to
            //obtain the provider explicitly.
            const provider = client._config.auth.provider;
            expect(provider).to.be.an.instanceOf(IAMAuthorizationProvider);
            const auth = await provider.getAuthorization(ipReq);
            let profile1 = authProfile();
            //Token has already been obtained by precacheAuth() so it should
            //be the same here.
            expect(profile1.token).to.equal(profile0.token);
            verifyAuth(auth, profile1, COMPARTMENT_ID);

            await Utils.sleep(1500);
            //Token has expired but there is no background refresh so it
            //should not have changed.
            expect(currentToken()).to.equal(profile1.token);

            await client.precacheAuth();
            let profile2 = authProfile();
            //Since token has expired, precacheAuth() should obtain new token.
            expect(profile2.token).to.not.equal(profile1.token);

            //We should have new signature.
            const auth2 = await provider.getAuthorization(ipReq);
            verifyAuthLaterDate(auth2, auth, profile2, profile1,
                COMPARTMENT_ID);
        } finally {
            if (client != null) {
                client.close();
            }
        }
    });
}

module.exports = {
    testTokenCache,
    testTokenAutoRefresh,
    testPrecacheAuth
};
