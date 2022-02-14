/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const http = require('http');
const https = require('https');
const EventEmitter = require('events');
const BinaryProtocolManager = require('./binary_protocol/protocol_manager');
const ErrorCode = require('./error_code');
const error = require('./error');
const NoSQLNetworkError = error.NoSQLNetworkError;
const NoSQLServiceError = error.NoSQLServiceError;
const NoSQLTimeoutError = error.NoSQLTimeoutError;
const HttpConstants = require('./constants').HttpConstants;
const PACKAGE_VERSION = require('./constants').PACKAGE_VERSION;
const RateLimiterClient = require('./rate_limiter/client');
const promisified = require('./utils').promisified;
const sleep = require('./utils').sleep;

class HttpClient extends EventEmitter {

    constructor(config) {
        super();
        //This shouldn't throw since we already validated the endpoint in
        //Config._endpoint2url()
        assert(config.url);
        this._url = new URL(HttpConstants.NOSQL_DATA_PATH, config.url);
        
        this._config = config;
        this._useSSL = this._url.protocol.startsWith('https');
        this._httpMod = this._useSSL ? https : http;
        if ('httpOpt' in config) {
            this._agent = new this._httpMod.Agent(config.httpOpt);
        }
        else {
            this._agent = this._httpMod.globalAgent;
        }

        //can be customized to use other protocols
        this._pm = BinaryProtocolManager;
        this._requestId = 1;

        //This may be decremented if connected to an older server
        this._serialVersion = 3;

        //init rate limiting if enabled
        if (RateLimiterClient.rateLimitingEnabled(config)) {
            this._rlClient = new RateLimiterClient(this);
        }

        // user-agent string
        this._user_agent = 'NoSQL-NodeSDK/' + PACKAGE_VERSION +
            '(node.js ' + process.version + '; ' + process.platform +
            '/' + process.arch + ')';
    }

    _handleResponse(op, req, res, buf, callback) {
        try {
            if (res.statusCode == HttpConstants.HTTP_OK) {
                const dr = this._pm.getDataReader(buf);
                const rc = this._pm.getResponseCode(dr);
                if (this._pm.responseSuccessful(rc)) {
                    const nosqlRes = op.deserialize(this._pm,
                                        dr, req, this._serialVersion);
                    return callback(null, nosqlRes);
                }
                const err = this._pm.createError(rc, dr);
                err._req = req;
                return callback(err);
            } else {
                let errOutput;
                if (res.statusCode == HttpConstants.HTTP_BAD_REQUEST) {
                    errOutput = buf.toString('utf8');
                }
                return callback(new NoSQLServiceError(res, errOutput,
                    req));
            }
        } catch(err) {
            err._req = req;
            return callback(err);
        } finally {
            this._pm.releaseBuffer(buf);
        }
    }

    _executeOnceWithAuth(op, req, callback) {
        const reqId = this._requestId++;
        assert(req.opt.requestTimeout);

        const httpOpt = {
            hostname: this._url.hostname,
            port: this._url.port,
            path: this._url.pathname,
            method: HttpConstants.POST,
            headers: {
                [HttpConstants.HOST]: this._url.host,
                [HttpConstants.REQUEST_ID]: reqId,
                [HttpConstants.CONTENT_TYPE]: this._pm.contentType,
                [HttpConstants.CONNECTION]: 'keep-alive',
                [HttpConstants.ACCEPT]: this._pm.contentType,
                [HttpConstants.USER_AGENT]: this._user_agent
            },
            agent: this._agent,
            timeout: req.opt.requestTimeout
        };
        if (typeof req._auth === 'string') {
            httpOpt.headers[HttpConstants.AUTHORIZATION] = req._auth;
        } else if (req._auth != null) {
            Object.assign(httpOpt.headers, req._auth);
        }

        const httpReq = this._httpMod.request(httpOpt, (res) => {
            if (this._pm.encoding) {
                res.setEncoding(this._pm.encoding);
            }
            const buf = this._pm.getBuffer();
            res.on('data', (chunk) => {
                this._pm.addChunk(buf, chunk);
            });
            res.on('end', () => {
                this._handleResponse(op, req, res, buf, callback);
            });
        }).on('error', (err) =>
            callback(new NoSQLNetworkError(null, req, err)));

        const buf = this._pm.getBuffer();
        //None of the code above in this function should throw.
        try {
            const dw = this._pm.getDataWriter(buf);
            op.serialize(this._pm, dw, req, this._serialVersion);
            const data = this._pm.getData(dw);
            httpReq.setHeader(HttpConstants.CONTENT_LENGTH,
                this._pm.getByteLength(data));
            httpReq.write(data, this._pm.encoding);
            httpReq.end(() => this._pm.releaseBuffer(buf));
        } catch(err) {
            httpReq.destroy();
            //this always executes asynchronously as part of getAuthorization
            //callback
            callback(err);
            this._pm.releaseBuffer(buf);
        }
    }

    async _executeOnce(op, req) {
        try {
            req._auth = await this._config.auth.provider.getAuthorization(
                req);
        } catch(err) {
            err._req = req;
            throw err;
        }

        return promisified(this, this._executeOnceWithAuth, op, req);
    }

    async execute(op, req) {
        op.applyDefaults(req, this._config);
        op.validate(req);
        req._op = op;

        if (this._rlClient != null && op.supportsRateLimiting) {
            this._rlClient.initRequest(req);
        }

        const startTime = Date.now();
        let nextTime = startTime;
        let timeout = req.opt.timeout;
        let remaining = timeout;
        let numRetries = 1;
        let res;

        for(;;) {
            if (this._rlClient != null && op.supportsRateLimiting) {
                await this._rlClient.startRequest(req, nextTime, remaining,
                    timeout, numRetries);
            }
            try {
                res = await this._executeOnce(op, req);
                break;
            } catch(err) {
                if (err.errorCode == ErrorCode.UNSUPPORTED_PROTOCOL &&
                    this._decrementSerialVersion() == true) {
                    continue;
                }

                if (this._rlClient != null && op.supportsRateLimiting) {
                    this._rlClient.onError(req, err);
                }                            
    
                if (!err.retryable || !req.opt.retry.handler.doRetry(
                    req, numRetries, err)) {
                    this.emit('error', err, req);
                    throw err;
                }

                timeout = err.errorCode ===
                    ErrorCode.SECURITY_INFO_UNAVAILABLE ?
                    Math.max(req.opt.securityInfoTimeout, req.opt.timeout) :
                    req.opt.timeout;
                const delay = req.opt.retry.handler.delay(req, numRetries,
                    err);
                nextTime = Date.now() + delay;
                remaining = startTime + timeout - nextTime;
                if (remaining < 0) {
                    throw new NoSQLTimeoutError(timeout, numRetries, req,
                        err);
                }

                this.emit('retryable', err, req, numRetries);
                req.lastError = err;
                numRetries++;
                await sleep(delay);
            }
        }

        op.onResult(this, req, res);
        if (this._rlClient != null && op.supportsRateLimiting) {
            remaining = startTime + timeout - Date.now();
            await this._rlClient.finishRequest(req, res, remaining);
        }

        return res;
    }

    shutdown() {
        this._agent.destroy();
        if (this._rlClient != null) {
            this._rlClient.close();
        }
    }

    _decrementSerialVersion() {
        if (this._serialVersion > 2) {
            this._serialVersion -= 1;
            return true;
        }
        return false;
    }

    /* for tests */
    getSerialVersion() {
        return this._serialVersion;
    }
}

module.exports = HttpClient;
