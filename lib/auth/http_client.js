/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const HttpConstants = require('../constants').HttpConstants;
const NoSQLServiceError = require('../error').NoSQLServiceError;
const NoSQLTimeoutError = require('../error').NoSQLTimeoutError;
const promisified = require('../utils').promisified;

const DEFAULT_DELAY_MS = 1000;

class HttpClient {

    constructor(opt, isHttps = true) {
        this._httpMod = require(isHttps ? 'https': 'http');
        if (opt != null) {
            this._agent = new this._httpMod.Agent(opt);
        }
        else {
            this._agent = this._httpMod.globalAgent;
        }
    }
    
    _getBasicAuth(clientId, secret) {
        let b;
        try {
            //secret is stored as Buffer
            b = Buffer.concat([Buffer.from(clientId), Buffer.from(':'),
                secret]);
            return 'Basic ' + b.toString('base64');
        } finally {
            if (b) {
                b.fill(0);
            }
        }
    }

    _request(req, callback) {
        if (!(req.url instanceof URL)) {
            req.url = new URL(req.url);
        }

        const httpOpt = {
            hostname: req.url.hostname,
            port: req.url.port,
            path: req.url.pathname + req.url.search,
            method: req.method,
            headers: req.headers,
            agent: this._agent,
            timeout: req.timeout
        };

        if (!httpOpt.headers) {
            httpOpt.headers = {};
        }
        httpOpt.headers[HttpConstants.HOST] = req.url.host;
        if (!httpOpt.headers[HttpConstants.CONNECTION]) {
            httpOpt.headers[HttpConstants.CONNECTION] = 'keep-alive';
        }
        if (!httpOpt.headers[HttpConstants.CACHE_CONTROL]) {
            httpOpt.headers[HttpConstants.CACHE_CONTROL] = 'no-store';
        }
        if (req.auth) {
            httpOpt.headers[HttpConstants.AUTHORIZATION] = req.auth;
        } else if (!httpOpt.headers[HttpConstants.AUTHORIZATION]) {
            assert(req.clientId && req.secret);
            httpOpt.headers[HttpConstants.AUTHORIZATION] = this._getBasicAuth(
                req.clientId, req.secret);
        }
        if (req.contentType) {
            httpOpt.headers[HttpConstants.CONTENT_TYPE] = req.contentType;
        }
        let payload = req.payload;
        if (payload) {
            if (!Buffer.isBuffer(payload) && typeof payload !== 'string') {
                payload = JSON.stringify(payload);
            }
            httpOpt.headers[HttpConstants.CONTENT_LENGTH] =
                Buffer.byteLength(payload);
        }

        const doOnce = () => {
            const httpReq = this._httpMod.request(httpOpt, (res) => {
                res.setEncoding('utf8');
                let body = '';
                res.on('data', (chunk) => {
                    body += chunk;
                });
                res.on('end', () => {
                    if (res.statusCode >= HttpConstants.HTTP_SERVER_ERROR &&
                        Date.now() - startTime <= req.timeout) {
                        numRetries++;
                        return setTimeout(doOnce, DEFAULT_DELAY_MS);
                    }
                    if (res.statusCode >= 200 && res.statusCode <= 299) {
                        return callback(null, body);
                    }
                    const err = new NoSQLServiceError(res, body);
                    if (res.statusCode >= HttpConstants.HTTP_SERVER_ERROR) {
                        return callback(new NoSQLTimeoutError(req.timeout,
                            numRetries, null, err));
                    }
                    callback(err);
                });
            });
            httpReq.on('error', (err) => {
                //May need to check for the type of error
                if (Date.now() - startTime <= req.timeout) {
                    numRetries++;
                    setTimeout(doOnce, DEFAULT_DELAY_MS);
                } else {
                    callback(new NoSQLTimeoutError(req.timeout, numRetries,
                        null, err));
                }
            });
            if (payload) {
                httpReq.write(payload);
            }
            httpReq.end();
        };

        //To offset for waiting for retry
        const startTime = Date.now() - DEFAULT_DELAY_MS;
        let numRetries = 1;
        doOnce();
    }

    request(req) {
        return promisified(this, this._request, req);
    }

    shutdown() {
        this._agent.destroy();
    }

}

module.exports = HttpClient;
