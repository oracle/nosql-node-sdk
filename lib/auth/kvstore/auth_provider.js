/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const promisified = require('../../utils').promisified;
const clearData = require('../../utils').clearData;
const ErrorCode = require('../../error').ErrorCode;
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

    constructor(cfg) {
        assert(cfg.auth);
        const opt = cfg.auth.kvstore;
        assert(opt);

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

        this._tokenProvider = new KVStoreTokenProvider(cfg);
        this._autoRenew = opt.autoRenew;
    }

    _scheduleRenew() {
        assert(this._res);
        const currTime = Date.now();
        const exp = this._res.expireAt - currTime();
        /*
         * If it is 10 seconds before expiration, don't do further renew to
         * avoid too many renew requests in the last few seconds.
         */
        if (exp <= 10000) {
            return;
        }
        if (this._renewTimer != null) {
            clearTimeout(this._renewTimer);
        }
        this._renewTimer = setTimeout(async () => {
            this._res = this._tokenProvider.renew(this._res.token);
            this._scheduleRenew();
        }, exp / 2);
    }

    _isValidCreds(creds) {
        return creds && typeof creds.user === 'string' && creds.user.length &&
        (Buffer.isBuffer(creds.pwd) || typeof creds.pwd === 'string') &&
        creds.pwd.length;
    }

    async _retrieveToken() {
        let creds;
        try {
            if (this._credsProvider) {
                creds = await this._credsProvider.loadCredentials();
                if (!this._isValidCreds(creds)) {
                    throw AuthError.creds('Credentials provider returned \
invalid or missing credentials, check user and password');
                }
            } else {
                creds = this._creds;
            }
            this._res = await this._tokenProvider.login(creds.user,
                creds.password);
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

    async getAuthorization(req) {
        if (!this._res || (req.lastError && req.lastError.errorCode ===
            ErrorCode.RETRY_AUTHENTICATION)) {
            await this._retrieveToken();
        }
        assert(this._res && this._res.token);
        return 'Bearer ' + this._res.token;
    }

    async close() {
        if (this._res) {
            if (this._renewTimer != null) {
                clearTimeout(this._renewTimer);
            }
            assert(this._res.token);
            try {
                await this._tokenProvider.logout(this._res.token);
                //TODO: log the error
            } catch(err) {} //eslint-disable-line no-empty
        }
        if (this._creds) {
            clearData(this._creds);
        }
    }

}

module.exports = KVStoreAuthorizationProvider;
