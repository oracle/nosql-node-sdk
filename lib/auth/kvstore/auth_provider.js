/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const isPosInt32 = require('../../utils').isPosInt32;
const isPosInt32OrZero = require('../../utils').isPosInt32OrZero;
const promisified = require('../../utils').promisified;
const clearData = require('../../utils').clearData;
const ErrorCode = require('../../error_code');
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const AuthError = require('../../error').NoSQLAuthorizationError;
const KVStoreTokenProvider = require('./token_provider');

class KVStoreFileCredentialsProvider {

    constructor(credentialsFile) {
        this._fileName = credentialsFile;
        if (!this._fileName || typeof this._fileName !== 'string') {
            throw new NoSQLArgumentError('Missing or invalid credentials file \
name');
        }
    }

    _loadCredentials(callback) {
        fs.readFile(this._fileName, 'utf8', (err, data) => {
            if (err) {
                return callback(AuthError.creds('Failed to load ' +
                    `kvstore credentials file ${this._fileName}`, err));
            }
            try {
                const creds = JSON.parse(data, (key, value) => {
                    return key === 'password' ? Buffer.from(value) : value;
                });
                callback(null, creds);
            } catch(err) {
                callback(AuthError.creds(`Failed to parse kvstore \
credentials file ${this._fileName}`, err));
            }
        });
    }

    loadCredentials() {
        return promisified(this, this._loadCredentials);
    }

}

class KVStoreAuthorizationProvider {

    constructor(opt, cfg) {
        if (!opt || typeof opt !== 'object') {
            throw new NoSQLArgumentError('Missing or invalid auth.kvstore',
                cfg);
        }

        //Needed in case this provider is created outside NoSQLClient
        //instance. Note that this is currently sufficient, because
        //AuthConfig.defaults.kvstore has no nested properties. Otherwise the
        //code below will need to change to use Config.inheritOpt().
        opt.__proto__ = KVStoreAuthorizationProvider.configDefaults;

        //init credentials provider if any
        if (opt.credentials != null) {
            if (opt.user != null || opt.password != null) {
                throw new NoSQLArgumentError('May not specify \
auth.kvstore.credentials together with auth.kvstore.user or \
auth.kvstore.password', cfg);
            }
            if (typeof opt.credentials === 'string') {
                this._credsProvider = new KVStoreFileCredentialsProvider(
                    opt.credentials);
            } else if (typeof opt.credentials === 'function') {
                this._credsProvider = { loadCredentials : opt.credentials };
            }
            else {
                if (typeof opt.credentials !== 'object' ||
                    typeof opt.credentials.loadCredentials !== 'function') {
                    throw new NoSQLArgumentError(
                        'Invlaid value of auth.kvstore.credentials', cfg);
                }
                this._credsProvider = opt.credentials;
            }
        } else { //user & password supplied directly
            if (typeof opt.user !== 'string' || !opt.user.length) {
                throw new NoSQLArgumentError(
                    'Missing or invalid value of auth.kvstore.user');
            }
            if (!Buffer.isBuffer(opt.password) &&
                (typeof opt.password !== 'string' || !opt.password.length)) {
                throw new NoSQLArgumentError('Missing or invalid value of \
opt.kvstore.password');
            }
            this._creds = {
                user: opt.user,
                password: Buffer.from(opt.password)
            };
        }

        if (!isPosInt32(opt.timeout)) {
            throw new NoSQLArgumentError('Invalid auth.kvstore.timeout value',
                cfg);
        }

        this._timeout = opt.timeout;
        this._autoRenew = opt.autoRenew;

        this._noRenewBeforeMs = opt.noRenewBeforeMs;
        assert(isPosInt32OrZero(this._noRenewBeforeMs));
    }

    _setAuthResult(res) {
        assert(res && res.token && res.expireAt);
        this._auth = 'Bearer ' + res.token;
        this._expireAt = res.expireAt;
    }

    _scheduleRenew() {
        assert(this._auth && this._expireAt);
        const currTime = Date.now();
        const exp = this._expireAt - currTime;

        //If it is 10 seconds before expiration, don't do further renew to
        //avoid too many renew requests in the last few seconds.
        if (exp <= this._noRenewBeforeMs) {
            return;
        }
        if (this._renewTimer != null) {
            clearTimeout(this._renewTimer);
        }
        this._renewTimer = setTimeout(async () => {
            this._setAuthResult(
                await this._tokenProvider.renew(this._auth));
            this._scheduleRenew();
        }, exp / 2);
    }

    _isValidCreds(creds) {
        return creds && typeof creds.user === 'string' && creds.user.length &&
            (Buffer.isBuffer(creds.password) ||
            typeof creds.password === 'string') &&
            creds.password.length;
    }

    async _retrieveToken() {
        let creds;
        try {
            if (this._credsProvider) {
                try {
                    creds = await this._credsProvider.loadCredentials();
                } catch(err) {
                    throw AuthError.creds('Error retrieving credentials',
                        err);
                }
                if (!this._isValidCreds(creds)) {
                    throw AuthError.creds('Credentials provider returned \
invalid or missing credentials, check user and password');
                }
            } else {
                creds = this._creds;
            }
            assert(this._tokenProvider != null);
            this._setAuthResult(
                await this._tokenProvider.login(creds.user, creds.password));
            if (this._autoRenew) {
                this._scheduleRenew();
            }
        } finally {
            if (this._credsProvider) {
                clearData(creds);
            }
        }
    }

    get credentialsProvider() {
        return this._credsProvider;
    }

    onInit(cfg) {
        this._tokenProvider = new KVStoreTokenProvider(this, cfg);
    }

    async getAuthorization(req) {
        if (!this._auth || (req.lastError && req.lastError.errorCode ===
            ErrorCode.RETRY_AUTHENTICATION)) {
            await this._retrieveToken();
        }
        assert(this._auth);
        return this._auth;
    }

    async close() {
        if (this._auth) {
            if (this._renewTimer != null) {
                clearTimeout(this._renewTimer);
            }
            if (this._tokenProvider != null) {
                try {
                    await this._tokenProvider.logout(this._auth);
                    //TODO: log the error
                } catch(err) {} //eslint-disable-line no-empty
            }
        }
        if (this._creds) {
            clearData(this._creds);
        }
    }

    static withCredentials(user, password) {
        return new KVStoreAuthorizationProvider({
            user,
            password
        });
    }

    static withCredentialsProvider(provider) {
        if (!provider || (typeof provider !== 'object' &&
            typeof provider !== 'function')) {
            throw new NoSQLArgumentError(
                'Missing or invalid credentials provider');
        }
        return new KVStoreAuthorizationProvider({
            credentials: provider
        });
    }

    static withCredentialsFile(file) {
        if (!file || typeof file !== 'string') {
            throw new NoSQLArgumentError(
                `Missing or invalid credentials file path: ${file}`);
        }
        return new KVStoreAuthorizationProvider({
            credentials: file
        });
    }
}

KVStoreAuthorizationProvider.configDefaults = Object.freeze({
    timeout: 30000,
    autoRenew: true,
    //The below properties are not exposed to the user but different
    //values are used in tests.
    noRenewBeforeMs: 10000
});

module.exports = KVStoreAuthorizationProvider;
