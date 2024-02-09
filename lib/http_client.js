/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const http = require('http');
const https = require('https');
const EventEmitter = require('events');
const NsonProtocolManager = require('./nson_protocol/protocol_manager');
const BinaryProtocolManager = require('./binary_protocol/protocol_manager');
const ErrorCode = require('./error_code');
const error = require('./error');
const NoSQLNetworkError = error.NoSQLNetworkError;
const NoSQLServiceError = error.NoSQLServiceError;
const NoSQLTimeoutError = error.NoSQLTimeoutError;
const HttpConstants = require('./constants').HttpConstants;
const PACKAGE_VERSION = require('./constants').PACKAGE_VERSION;
const Limits = require('./constants').Limits;
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
        this._pm = NsonProtocolManager;
        this._requestId = 1;

        // Session cookie
        this._sessionCookie = null;

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
                // is there a set-cookie header? If so, use it
                var cookie = res.headers[HttpConstants.SET_COOKIE];
                if (cookie != null) {
                    if (Array.isArray(cookie)) {
                        cookie = cookie[0];
                    }
                    this._setSessionCookie(cookie);
                }
                const nosqlRes = op.deserialize(this._pm, buf, req);
                return callback(null, nosqlRes);
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

    _setSessionCookie(cookie) {
        if (cookie.startsWith('session=')) {
            var value = cookie.substring(0, cookie.indexOf(';'));
            this._sessionCookie = value;
        }
    }

    _decrementSerialVersion(versionUsed) {
        //The purpose of checking versionUsed is to avoid a race condition
        //where _decrementSerialVersion() gets called called concurrently by
        //mutliple requests and thus decrements the serial version twice
        //without retrying the request with the intermediate version.
        if (this._pm.serialVersion !== versionUsed) {
            return true;
        }

        //Check if current protocol can decrement its serial version.
        if (this._pm.decrementSerialVersion()) {
            return true;
        }
        
        //If not and the current protocol is Nson, switch to binary protocol.
        if (this._pm === NsonProtocolManager) {
            this._pm = BinaryProtocolManager;
            return true;
        }

        return false;
    }

    _executeOnceWithAuth(op, req, auth, endSend, callback) {
        const reqId = this._requestId++;
        assert(req._buf);
        assert(req.opt.requestTimeout);

        const httpOpt = {
            hostname: this._url.hostname,
            port: this._url.port,
            path: this._url.pathname,
            method: HttpConstants.POST,
            headers: {
                [HttpConstants.HOST]: this._url.host,
                [HttpConstants.REQUEST_ID]: reqId,
                [HttpConstants.CONNECTION]: 'keep-alive',
                [HttpConstants.ACCEPT]: this._pm.contentType,
                [HttpConstants.USER_AGENT]: this._user_agent,
                [HttpConstants.CONTENT_TYPE]: this._pm.contentType,
                [HttpConstants.CONTENT_LENGTH]: this._pm.getContentLength(
                    req._buf)
            },
            agent: this._agent,
            timeout: req.opt.requestTimeout
        };
        if (typeof auth === 'string') {
            httpOpt.headers[HttpConstants.AUTHORIZATION] = auth;
        } else if (auth != null) {
            Object.assign(httpOpt.headers, auth);
        }

        if (this._sessionCookie != null) {
            httpOpt.headers[HttpConstants.COOKIE] = this._sessionCookie;
        }

        if (req.opt.namespace != null) {
            httpOpt.headers[HttpConstants.NAMESPACE] = req.opt.namespace;
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

        //This code should not throw synchronously. The code that can throw
        //have been moved to _executeOnce().
        httpReq.write(this._pm.getContent(req._buf), this._pm.encoding);
        httpReq.end(endSend);
    }

    async _executeOnce(op, req) {
        const buf = this._pm.getBuffer();
        let auth;
        try {
            op.serialize(this._pm, buf, req);
            //Allow auth provider to use request content. This is needed for
            //cross-region authentication in the Cloud. ProtoMgr is used to
            //get content, content type type and length in
            //protocol-independent manner.
            req._protoMgr = this._pm;
            req._buf = buf;
            auth = await this._config.auth.provider.getAuthorization(req);
        } catch(err) {
            req._buf = undefined;
            this._pm.releaseBuffer(buf);
            err._req = req;
            throw err;
        }

        return promisified(this, this._executeOnceWithAuth, op, req, auth,
            //Small optimization to release buffer (for reuse) immediately
            //after request is sent rather than after waiting for a response.
            () => {
                req._buf = undefined;
                this._pm.releaseBuffer(buf);
            });
    }

    get serialVersion() {
        return this._pm.serialVersion;
    }

    async execute(op, req) {
        op.applyDefaults(req, this._config);
        op.setProtocolVersion(this, req);
        op.validate(req);
        req._op = op;

        if (this._rlClient != null && op.supportsRateLimiting) {
            this._rlClient.initRequest(req);
        }

        const startTime = Date.now();
        let timeout = req.opt.timeout;
        let remaining = timeout;
        let numRetries = 1;
        let res;

        for(;;) {
            if (this._rlClient != null && op.supportsRateLimiting) {
                await this._rlClient.startRequest(req, remaining, timeout,
                    numRetries);
            }
            try {
                res = await this._executeOnce(op, req);
                break;
            } catch(err) {
                timeout = err.errorCode ===
                    ErrorCode.SECURITY_INFO_UNAVAILABLE ?
                    Math.max(req.opt.securityInfoTimeout, req.opt.timeout) :
                    req.opt.timeout;
                remaining = startTime + timeout - Date.now();

                //If remaining <= 0, we will throw NoSQLTimeoutError below.
                if (remaining > 0 &&
                    op.handleUnsupportedProtocol(this, req, err)) {
                    //Since we changed protocol version(s), set new protocol
                    //version(s) and revalidate the request before continuing.
                    op.setProtocolVersion(this, req);
                    op.validate(req);
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

                const delay = req.opt.retry.handler.delay(req, numRetries,
                    err);
                remaining -= delay;

                if (remaining <= 0) {
                    throw new NoSQLTimeoutError(timeout, numRetries, req,
                        err);
                }

                this.emit('retryable', err, req, numRetries);
                req.lastError = err;                
                numRetries++;
                
                //Adjust HTTP request timeout for the time already elapsed.
                req.opt.requestTimeout = Math.min(remaining,
                    Limits.MAX_REQUEST_TIMEOUT);

                await sleep(delay);

                //Handle case where protocol version(s) have been changed by
                //another concurrent request.
                if (op.protocolChanged(this, req)) {
                    op.setProtocolVersion(this, req);
                    op.validate(req);
                }
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
}

module.exports = HttpClient;
