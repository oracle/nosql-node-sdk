/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const StatsControl = require('./stats_control');
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

function isAuthRetryError(err) {
    return err.errorCode === ErrorCode.INVALID_AUTHORIZATION ||
        err.errorCode === ErrorCode.RETRY_AUTHENTICATION ||
        err.errorCode === ErrorCode.SECURITY_INFO_UNAVAILABLE;
}

function isThrottleRetryError(err) {
    return err.errorCode === ErrorCode.READ_LIMIT_EXCEEDED ||
        err.errorCode === ErrorCode.WRITE_LIMIT_EXCEEDED ||
        err.errorCode === ErrorCode.OPERATION_LIMIT_EXCEEDED;
}

class HttpClient extends EventEmitter {

    constructor(config) {
        super();
        //This shouldn't throw since we already validated the endpoint in
        //Config._endpoint2url()
        assert(config.url);
        const rateLimitingEnabled = RateLimiterClient.rateLimitingEnabled(
            config);
        this._stats = new StatsControl({
            profile: config.statsProfile,
            interval: config.statsInterval,
            prettyPrint: config.statsPrettyPrint,
            enableLog: config.statsEnableLog,
            statsHandler: config.statsHandler,
            rateLimitingEnabled
        });
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
        if (rateLimitingEnabled) {
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
                let cookie = res.headers[HttpConstants.SET_COOKIE];
                if (cookie != null) {
                    if (Array.isArray(cookie)) {
                        cookie = cookie[0];
                    }
                    this._setSessionCookie(cookie);
                }

                if (this._serverSerialVersion === undefined) {
                    const sv =
                        res.headers[HttpConstants.SERVER_SERIAL_VERSION];
                    if (sv != null) {
                        //If invalid value sent, will be set to NaN.
                        this._serverSerialVersion = Number(sv);
                    }
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

        /*
         * Measure latency around the actual HTTP exchange. This starts after
         * serialization/auth and ends when the full response body is received.
         */
        const requestStartTime = process.hrtime.bigint();
        const httpReq = this._httpMod.request(httpOpt, (res) => {
            if (this._pm.encoding) {
                res.setEncoding(this._pm.encoding);
            }
            const buf = this._pm.getBuffer();
            res.on('data', (chunk) => {
                this._pm.addChunk(buf, chunk);
            });
            res.on('end', () => {
                /*
                 * Response size and per-attempt latency are captured before
                 * response parsing so protocol errors are still observable.
                 */
                req._statsResponseSize = this._pm.getContentLength(buf);
                req._statsRequestLatency = Math.floor(Number(
                    process.hrtime.bigint() - requestStartTime) / 1000000);
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
            // Serialized content length is the HTTP request body size.
            req._statsRequestSize = this._pm.getContentLength(buf);
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

    _getConnectionCount() {
        let count = 0;
        if (this._agent == null) {
            return count;
        }
        for (const socketMap of [ this._agent.sockets,
            this._agent.freeSockets ]) {
            if (socketMap == null) {
                continue;
            }
            for (const sockets of Object.values(socketMap)) {
                count += sockets.length;
            }
        }
        return count;
    }

    _getStatsRateLimitDelayMs(req, res) {
        if (res != null && res.consumedCapacity != null) {
            const readDelay = res.consumedCapacity.readRateLimitDelay;
            const writeDelay = res.consumedCapacity.writeRateLimitDelay;
            if (readDelay != null || writeDelay != null) {
                return (readDelay || 0) + (writeDelay || 0);
            }
        }
        /*
         * On failures there is no result object, but the rate limiter may have
         * already delayed the request before the terminal error. Java records
         * that request-level delay for both success and error observations.
         */
        return (req._rrlDelay || 0) + (req._wrlDelay || 0);
    }

    _shouldObserveStats() {
        return this._stats.isStarted() &&
            this._stats.getProfile() !== StatsControl.Profile.NONE;
    }

    _observeStats(method, ...args) {
        try {
            this._stats[method](...args);
        } catch(err) {
            /*
             * Stats collection must never change SDK request behavior. Keep the
             * error for diagnostics and let the original operation continue.
             */
            this._statsError = err;
        }
    }

    _observeStatsError(op, req, err) {
        if (!this._shouldObserveStats()) {
            return;
        }
        req._statsRateLimitDelayMs = this._getStatsRateLimitDelayMs(req);
        this._observeStats('_observeError', op.name,
            this._getConnectionCount(), req._statsRetryCount,
            req._statsRetryDelayMs, req._statsRateLimitDelayMs,
            req._statsRetryAuthCount, req._statsRetryThrottleCount, req, err);
    }

    getStatsControl() {
        return this._stats;
    }

    async execute(op, req) {
        op.applyDefaults(req, this._config);
        op.setProtocolVersion(this, req);
        op.validate(req);
        req._op = op;

        if (this._rlClient != null && op.supportsRateLimiting) {
            this._rlClient.initRequest(req);
        }

        /*
         * These counters represent one logical SDK request and accumulate
         * across all retry attempts until observe()/observeError() is called.
         */
        const startTime = Date.now();
        req._statsRetryCount = 0;
        req._statsRetryDelayMs = 0;
        req._statsRetryAuthCount = 0;
        req._statsRetryThrottleCount = 0;
        req._statsRateLimitDelayMs = 0;
        req._statsRequestSize = 0;
        req._statsResponseSize = 0;
        req._statsRequestLatency = 0;
        let timeout = req.opt.timeout;
        let remaining = timeout;
        let numRetries = 1;
        let res;

        for(;;) {
            if (this._rlClient != null && op.supportsRateLimiting) {
                try {
                    await this._rlClient.startRequest(req, remaining, timeout,
                        numRetries);
                } catch(err) {
                    this._observeStatsError(op, req, err);
                    throw err;
                }
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
                    /*
                     * Record a terminal failed operation once, after retry
                     * policy has decided there will be no more attempts.
                     */
                    this._observeStatsError(op, req, err);
                    this.emit('error', err, req);
                    throw err;
                }

                const delay = req.opt.retry.handler.delay(req, numRetries,
                    err);
                remaining -= delay;

                if (remaining <= 0) {
                    const timeoutErr = new NoSQLTimeoutError(timeout,
                        numRetries, req, err);
                    /*
                     * Timeout after retry delay calculation is also a terminal
                     * failure for the logical request.
                     */
                    this._observeStatsError(op, req, timeoutErr);
                    throw timeoutErr;
                }

                req._statsRetryCount++;
                req._statsRetryDelayMs += delay;
                if (isAuthRetryError(err)) {
                    req._statsRetryAuthCount++;
                }
                if (isThrottleRetryError(err)) {
                    req._statsRetryThrottleCount++;
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

        if (this._shouldObserveStats()) {
            req._statsRateLimitDelayMs =
                this._getStatsRateLimitDelayMs(req, res);
            /*
             * Successful requests are observed after result processing and rate
             * limiting finish so stats include final retry, delay and size values.
             */
            this._observeStats('_observe', op.name, false,
                this._getConnectionCount(),
                req._statsRetryCount, req._statsRetryDelayMs,
                req._statsRateLimitDelayMs,
                req._statsRetryAuthCount, req._statsRetryThrottleCount,
                req._statsRequestSize, req._statsResponseSize,
                req._statsRequestLatency, req, res);
        }
        return res;
    }

    shutdown() {
        this._stats._shutdown();
        this._agent.destroy();
        if (this._rlClient != null) {
            this._rlClient.close();
        }
    }
}

module.exports = HttpClient;
