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
const http = require('http');
const https = require('https');
const URL = require('url').URL;
const EventEmitter = require('events');
const BinaryProtocolManager = require('./binary_protocol/protocol_manager');
const error = require('./error');
const ErrorCode = error.ErrorCode;
const NoSQLNetworkError = error.NoSQLNetworkError;
const NoSQLServiceError = error.NoSQLServiceError;
const NoSQLTimeoutError = error.NoSQLTimeoutError;
const HttpConstants = require('./utils').HttpConstants;

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
    }

    _handleResponse(op, req, res, buf, callback) {
        try {
            if (res.statusCode == HttpConstants.HTTP_OK) {
                const dr = this._pm.getDataReader(buf);
                const rc = this._pm.getResponseCode(dr);
                if (this._pm.responseSuccessful(rc)) {
                    const nosqlRes = op.deserialize(this._pm, dr, req);
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
                [HttpConstants.HOST]: this._url.hostname,
                [HttpConstants.REQUEST_ID]: reqId,
                [HttpConstants.CONTENT_TYPE]: this._pm.contentType,
                [HttpConstants.CONNECTION]: 'keep-alive',
                [HttpConstants.ACCEPT]: this._pm.contentType
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
        }).on('error', (err) => callback(new NoSQLNetworkError(null, req, err)));

        const buf = this._pm.getBuffer();
        //None of the code above in this function should throw.
        try {
            const dw = this._pm.getDataWriter(buf);
            op.serialize(this._pm, dw, req);
            const data = this._pm.getData(dw);
            httpReq.setHeader(HttpConstants.CONTENT_LENGTH,
                this._pm.getByteLength(data));
            httpReq.write(data, this._pm.encoding);
            httpReq.end(() => this._pm.releaseBuffer(buf));
        } catch(err) {
            httpReq.abort();
            //this always executes asynchronously as part of getAuthorization
            //callback
            callback(err);
            this._pm.releaseBuffer(buf);
        }
    }

    _executeOnce(op, req, callback) {
        this._config.auth.provider.getAuthorization(req)
            .then(res => {
                req._auth = res;
                this._executeOnceWithAuth(op, req, callback);    
            }, err => callback(err));
    }

    execute(op, req, callback) {
        op.applyDefaults(req, this._config);
        op.validate(req);
        req._op = op;

        const startTime = Date.now();
        let numRetries = 1;
        let throttleRetries = 1;

        const cb = (err, res) => {
            if (!err ||
                !err.retryable ||
                !req.opt.retry.handler.doRetry(req, throttleRetries, err)) {
                if (err) {
                    this.emit('error', err, req);
                } else {
                    op.onResult(this, req, res);
                }
                return callback(err, res);
            }
            const timeout = err.errorCode ===
                ErrorCode.SECURITY_INFO_UNAVAILABLE ?
                Math.max(req.opt.securityInfoTimeout, req.opt.timeout) :
                req.opt.timeout;
            if (Date.now() - startTime > timeout) {
                return callback(new NoSQLTimeoutError(timeout, numRetries,
                    req, err));
            }
            this.emit('retryable', err, req, throttleRetries);
            const delay = req.opt.retry.handler.delay(req, throttleRetries,
                err);
            req.lastError = err;
            numRetries++;
            if (err.errorCode !== ErrorCode.SECURITY_INFO_UNAVAILABLE &&
                err.errorCode !== ErrorCode.NETWORK_ERROR) {
                throttleRetries++;
            }
            setTimeout(() => this._executeOnce(op, req, cb), delay);
        };
        this._executeOnce(op, req, cb);
    }

    shutdown() {
        this._agent.destroy();
    }

}

module.exports = HttpClient;
