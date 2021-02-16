/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const URL = require('url').URL;
const isPosInt32 = require('../../utils').isPosInt32;
const isPosInt = require('../../utils').isPosInt;
const HttpConstants = require('../../constants').HttpConstants;
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const NoSQLTimeoutError = require('../../error').NoSQLTimeoutError;
const NoSQLServiceError = require('../../error').NoSQLServiceError;
const AuthError = require('../../error').NoSQLAuthorizationError;
const HttpClient = require('../http_client');

const BASE_PATH = `/${HttpConstants.NOSQL_VERSION}/nosql/security`;

const LOGIN_ENDPOINT = '/login';

const RENEW_ENDPOINT = '/renew';

const LOGOUT_ENDPOINT = '/logout';

class KVStoreTokenProvider {

    constructor(cfg) {
        if (cfg.url == null) {
            throw new NoSQLArgumentError('Missing service endpoint', cfg);
        }
        assert(cfg.url instanceof URL);
        if (!cfg.url.protocol.startsWith('https')) {
            throw new NoSQLArgumentError(`Invalid protocol for \
authorization: ${cfg.url.protocol}, https is required`, cfg);
        }

        this._loginUrl = new URL(BASE_PATH + LOGIN_ENDPOINT, cfg.url);
        this._renewUrl = new URL(BASE_PATH + RENEW_ENDPOINT, cfg.url);
        this._logoutUrl = new URL(BASE_PATH + LOGOUT_ENDPOINT, cfg.url);

        const opt = cfg.auth.kvstore;
        if (!isPosInt32(opt.timeout)) {
            throw new NoSQLArgumentError('Invalid auth.kvstore.timeout value',
                cfg);
        }
        this._timeout = opt.timeout;

        this._httpClient = new HttpClient(cfg.httpOpt);
    }

    async _doGet(req) {
        try {
            return this._httpClient.request(
                Object.assign(req, {
                    method: HttpConstants.GET,
                    timeout: this._timeout
                }));
        } finally {
            this._httpClient.shutdown();
        }
    }

    _parse(res) {
        try {
            res = JSON.parse(res);
        } catch(err) {
            throw AuthError.badProto('Failed to parse kvstore authentication \
token result', err);
        }
        if (typeof res.token !== 'string' || !res.token.length) {
            throw AuthError.badProto(`Token missing or invalid in \
kvstore authentication token result: ${res.token}`);
        }
        if (!isPosInt(res.expireAt)) {
            throw AuthError.badProto(`Expiration time missing or invalid in \
kvstore authentication token result: ${res.expireAt}`);
        }
        return res;
    }

    _handleError(err, action) {
        if (err instanceof NoSQLTimeoutError) {
            throw AuthError.timeout(`Failed to ${action}.  Operation timed \
out, see the cause`);
        }
        if (err instanceof NoSQLServiceError) {
            throw AuthError.service(`Failed to ${action}, unexpected HTTP \
response.  Status code: ${err.statusCode}.  Error response: ${err.response}`,
            err);
        }
        throw AuthError.network(`Failed to ${action}, see the cause`, err);
    }

    async login(user, pwd) {
        try {
            const res = await this._doGet({
                url: this._loginUrl,
                clientId: user,
                secret: Buffer.isBuffer(pwd) ? pwd : Buffer.from(pwd)
            });
            return this._parse(res);
        }
        catch (err) {
            return this._handleError(err, 'login to kvstore');
        }
    }

    async renew(auth) {
        try {
            const res = await this._doGet({
                url: this._renewUrl,
                auth,
            });
            return this._parse(res);
        }
        catch (err) {
            return this._handleError(err,
                'renew kvstore authentication token');
        }
    }

    async logout(auth) {
        try {
            return await this._doGet({
                url: this._logoutUrl,
                auth
            });
        }
        catch (err) {
            return this._handleError(err, 'logout from kvstore');
        }
    }

}

module.exports = KVStoreTokenProvider;
