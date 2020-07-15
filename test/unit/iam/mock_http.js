/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const http = require('http');
const https = require('https');
const URL = require('url').URL;
const PassThrough = require('stream').PassThrough;
const sinon = require('sinon');

const HttpConstants = require('../../../lib/constants').HttpConstants;
const NoSQLNetworkError = require('../../../index').NoSQLNetworkError;
const NoSQLServiceError = require('../../../index').NoSQLServiceError;

class MockHttp {
    
    constructor() {
        this._endpoints = new Map();
        this._hosts = new Set();
        this._hostnames = new Set();
    }

    static serviceError(statusCode, statusMessage, errOutput) {
        return new NoSQLServiceError({
            statusCode,
            statusMessage
        }, errOutput);    
    }

    static notFound(msg) {
        return MockHttp.serviceError(HttpConstants.HTTP_NOT_FOUND,
            'Not Found', msg);
    }

    static badRequest(msg) {
        return MockHttp.serviceError(HttpConstants.HTTP_BAD_REQUEST,
            'Bad Request', msg);
    }

    static unauthorized(msg) {
        return MockHttp.serviceError(HttpConstants.HTTP_UNAUTHORIZED,
            'Unauthorized', msg);
    }

    static serverError(msg) {
        return MockHttp.serviceError(HttpConstants.HTTP_SERVER_ERROR,
            'Server Error', msg);
    }

    static checkMethod(opt, method) {
        if (!opt.method) {
            throw this.badRequest(
                `Missing HTTP method, should be ${method}`);
        }
        if (opt.method !== method) {
            throw this.badRequest(
                `Wrong HTTP method ${opt.method}, should be ${method}`);
        }
    }

    static handleGet(opt, val) {
        this.checkMethod(opt, HttpConstants.GET);
        return val;
    }

    get defaultPort() {
        return '80';
    }

    get module() {
        return http;
    }

    get proto() {
        return 'http://';
    }

    setEndpoint(host, path, handler) {
        const url = new URL(path, this.proto + host);
        if (url.port === this.defaultPort) {
            url.port = '';
        }
        this._endpoints.set(url.href, handler);
        this._hosts.add(url.host);
        this._hostnames.add(url.hostname);
    }

    clear() {
        this._endpoints.clear();
        this._hosts.clear();
        this._hostnames.clear();
    }

    stub() {
        this._stub = sinon.stub(this.module, 'request');
        this._stub.callsFake((url, opt, callback) =>
            this._request(url, opt, callback));
    }

    restore() {
        if (this._stub) {
            this._stub.restore();
        }
    }

    _getEndpoint(url, opt) {
        if (url != null && !(url instanceof URL)) {
            url = new URL(url);
        }
        if (!opt) {
            opt = {};
        }

        let host = '';
        if (opt.host != null) {
            host = opt.host;
        } else if(opt.hostname != null) {
            host = opt.hostname;
        } else if (url != null) {
            host = url.hostname;
        }
        if (!host || !this._hostnames.has(host)) {
            throw new NoSQLNetworkError(`Address not found: ${host}`);
        }

        let port = opt.port ? String(opt.port) : (url != null ?
            url.port : '');
        if (port && port !== this.defaultPort) {
            host = host + ':' + port;
        }
        if (!this._hosts.has(host)) {
            throw new NoSQLNetworkError(`Connection refused to ${host}`);
        }

        const path = opt.path ? opt.path : (url ? url.pathname : '/');

        return new URL(path, this.proto + host);
    }

    //Handler can be:
    //1) A function that takes 3 (optional) parameters: opt passed to
    //http.request(), request payload and url search parameters string.
    //2) An instance of Error, same as handler function throwing this error.
    //3) A string or Buffer, in same as calling handleGet() with that value.
    //4) An object, same as 3) where the value is JSON.stringify() of that
    //object.

    _getHandler(url) {
        let handler = this._endpoints.get(url.href);
        if (handler == null) {
            handler = () => {
                throw MockHttp.notFound();
            };
        } else if (typeof handler !== 'function') {
            const val = handler;
            handler = (handler instanceof Error) ? () => { throw val; } :
                (opt) => MockHttp.handleGet(opt, val);
        }
        return handler;
    }

    _writeChunks(res, data) {
        const chunkSize = Math.max(data.length / 10, 1);
        for(let off = 0; off < data.length; off += chunkSize) {
            res.write(data.slice(off, off + chunkSize));
        }
    }

    _sendOKResponse(res, data) {
        res.statusCode = HttpConstants.HTTP_OK;
        res.headers = {};
        if (data != null) {
            if (typeof data === 'string') {
                res.headers[HttpConstants.CONTENT_TYPE] = 'text/plain';
                data = Buffer.from(data);
            } else if (Buffer.isBuffer(data)) {
                res.headers[HttpConstants.CONTENT_TYPE] =
                    'application/octet-stream';
            } else { //assume JSON
                res.headers[HttpConstants.CONTENT_TYPE] =
                    HttpConstants.APPLICATION_JSON;
                data = Buffer.from(JSON.stringify(data));
            }
            res.headers[HttpConstants.CONTENT_LENGTH] = data.length;
            this._writeChunks(res, data);
        }
        res.end();
    }

    _sendErrorResponse(res, err) {
        res.statusCode = err.statusCode;
        res.statusMessage = err.statusMessage;
        res.headers = {};
        if (err.response != null) {
            const data = Buffer.from(err.response);
            res.headers[HttpConstants.CONTENT_TYPE] = 'text/plain';
            res.headers[HttpConstants.CONTENT_LENGTH] = data.length;
            res.write(data);
        }
        res.end();
    }

    _chkHostHeader(opt, url) {
        if (opt.headers == null) {
            throw MockHttp.badRequest('Missing headers');
        }
        const host = opt.headers[HttpConstants.HOST];
        if (host == null) {
            throw MockHttp.badRequest('Missing HOST header');
        }
        if (host !== url.host) {
            throw MockHttp.badRequest(
                `Invalid or missing HOST header: ${host}`);
        }
    }

    _request(url, opt, callback) {
        if (!callback) { //2 argument call (opt, callback)
            callback = opt;
            opt = url;
            url = null;
        } else {
            if (!opt.hostname) {
                opt.hostname = url.hostname;
            }
            if (!opt.path) {
                opt.path = url.pathname + url.search;
            }
        }
        if (!opt) {
            opt = {};
        }
        return this._doRequest(opt, callback);
    }

    _doRequest(opt, callback) {
        const req = new PassThrough();
        let url;
        let handler;
        
        try {
            url = this._getEndpoint(url, opt);
            handler = this._getHandler(url, opt);
        } catch(err) {
            setTimeout(() => req.emit('error', err), 0);
            return req;
        }

        setTimeout(() => {
            let chunks = [];
            req.on('data', (chunk) => {
                chunks.push(chunk);
            });
            req.on('end', () => {
                const payload = Buffer.concat(chunks);
                let res = new PassThrough();
                callback(res);
                try {
                    this._chkHostHeader(opt, url);
                    const data = handler(opt, payload, url.search);
                    this._sendOKResponse(res, data);
                } catch(err) {
                    if (err instanceof NoSQLServiceError) {
                        return this._sendErrorResponse(res, err);
                    } else {
                        return req.emit('error', err);
                    }
                }
            });
        }, 0);

        return req;
    }

}

class MockHttps extends MockHttp {

    get defaultPort() {
        return '443';
    }

    get module() {
        return https;
    }

    get proto() {
        return 'https://';
    }

}

module.exports = {
    MockHttp,
    MockHttps
};
