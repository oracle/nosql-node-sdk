/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
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
                const reader = this._pm.getReader(buf);
                const nosqlRes = op.deserialize(this._pm, reader, req);
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

    _decrementSerialVersion() {
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

    _executeOnceWithAuth(op, req, auth, callback) {
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

        const buf = this._pm.getBuffer();
        //None of the code above in this function should throw.
        try {
            const writer = this._pm.getWriter(buf);
            op.serialize(this._pm, writer, req);
            const data = this._pm.getData(writer);
            httpReq.setHeader(HttpConstants.CONTENT_LENGTH,
                this._pm.getRequestLength(writer));
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
        let auth;
        try {
            auth = await this._config.auth.provider.getAuthorization(req);
        } catch(err) {
            err._req = req;
            throw err;
        }

        return promisified(this, this._executeOnceWithAuth, op, req, auth);
    }

    get serialVersion() {
        return this._pm.serialVersion;
    }

    async execute(op, req) {
        op.applyDefaults(req, this._config);
        op.validate(req, this._pm.serialVersion);
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
            const serialVersion = this._pm.serialVersion;
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

                //If remaming <= 0, we will throw NoSQLTimeoutError below.
                if (remaining > 0) {
                    //Check if we got UNSUPPORTED_PROTOCOL error and can
                    //can retry with older older protocol, in which case we
                    //can immediately retry (otherwise use retry handler as
                    //usual).
                    //Note that we do not call _decrementSerialVersion() if
                    //it has already been decremented by a concurrent request
                    //to avoid decrementing it twice.
                    const retryWithOlderProtocol =
                        (err.errorCode === ErrorCode.UNSUPPORTED_PROTOCOL &&
                         (this._pm.serialVersion !== serialVersion ||
                          this._decrementSerialVersion()));

                    //Protocol version has been decremented by us or another
                    //concurrent request.
                    if (this._pm.serialVersion !== serialVersion) {
                        //Re-validate the request with the new protocol
                        //version.
                        op.validate(req, this._pm.serialVersion);
                        if (retryWithOlderProtocol) {
                            continue;
                        }
                    }
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
