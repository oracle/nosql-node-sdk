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
const URL = require('url').URL;

const ServiceType = require('./constants').ServiceType;
const Consistency = require('./constants').Consistency;
const ErrorCode = require('./error').ErrorCode;
const NoSQLArgumentError = require('./error').NoSQLArgumentError;
const isPosInt32 = require('./utils').isPosInt32;
const isPosInt32OrZero = require('./utils').isPosInt32OrZero;
const isPlainObject = require('./utils').isPlainObject;
const path = require('path');
const AuthConfig = require('./auth/config');
const NumberTypeHandler = require('./db_number');
const Region = require('./region');

class Config {

    //default retry.handler.doRetry()
    static _shouldRetry(req, numRetries, err) {
        assert(err);
        switch(err.errorCode) {
        case ErrorCode.OPERATION_LIMIT_EXCEEDED:
            return req.opt.retry.controlOpBaseDelay &&
                req.opt.timeout > req.opt.retry.controlOpBaseDelay;
        case ErrorCode.SECURITY_INFO_UNAVAILABLE:
        case ErrorCode.NETWORK_ERROR:
            return true;
        case ErrorCode.INVALID_AUTHORIZATION:
        //Retry once in case the error is due to expired authorization.  But
        //if last error was the same, then the error is not due to expiration
        //so we don't retry anymore.
            return !req.lastError || req.lastError.errorCode !==
                ErrorCode.INVALID_AUTHORIZATION;
        default:
            break;
        }
        assert(req._op);
        if (!req._op.shouldRetry(req)) {
            return false;
        }
        return numRetries < req.opt.retry.maxRetries;
    }

    static _backoffDelay(numRetries, baseDelay) {
        let ms = (1 << (numRetries - 1)) * baseDelay;
        ms += Math.floor(Math.random() * baseDelay);
        return ms;
    }

    static _secInfoNotReadyDelay(numRetries, numBackoff, baseDelay) {
        return numRetries > numBackoff ?
            Config._backoffDelay(numRetries - numBackoff, baseDelay) :
            baseDelay;
    }

    //default retry.handler.delay()
    static _retryDelay(req, numRetries, err) {
        switch(err.errorCode) {
        case ErrorCode.OPERATION_LIMIT_EXCEEDED:
            return Config._backoffDelay(numRetries,
                req.opt.retry.controlOpBaseDelay);
        case ErrorCode.SECURITY_INFO_UNAVAILABLE:
            return Config._secInfoNotReadyDelay(numRetries,
                req.opt.retry.secInfoNumBackoff,
                req.opt.retry.secInfoBaseDelay);
        default:
            return Config._backoffDelay(numRetries, req.opt.retry.baseDelay);
        }
    }

    //Validate and make uniform interface for retry handler
    static _initRetry(cfg) {
        if (cfg.retry == null) {
            cfg.retry = {};
        } else if (typeof cfg.retry !== 'object') {
            throw new NoSQLArgumentError('Invalid retry value', cfg);
        }
        if (cfg.retry.handler == null) {
            cfg.retry.handler = {};
        } else if (typeof cfg.retry.handler !== 'object') {
            throw new NoSQLArgumentError('Invalid retry.handler value', cfg);
        }
        if (!cfg.retry.handler.doRetry) {
            if (cfg.retry.handler.delay != null) {
                throw new NoSQLArgumentError(
                    'Missing retry.handler.doRetry value', cfg);
            }
            cfg.retry.handler.doRetry = () => false;
            return;
        }
        if (cfg.retry.handler.doRetry === true) {
            cfg.retry.handler.doRetry = () => true;
        } else if (typeof cfg.retry.handler.doRetry !== 'function') {
            throw new NoSQLArgumentError(
                'Invalid retry.handler.doRetry value', cfg);
        }
        //If using default doRetry, maxRetries must be valid
        if (cfg.retry.handler.doRetry === this._shouldRetry &&
            !isPosInt32(cfg.retry.maxRetries)) {
            throw new NoSQLArgumentError(
                'Missing or invalid retry.maxRetries value', cfg);
        }
        if (isPosInt32(cfg.retry.handler.delay)) {
            const val = cfg.retry.handler.delay;
            cfg.retry.handler.delay = () => val;
            return;
        }
        if (typeof cfg.retry.handler.delay !== 'function') {
            throw new NoSQLArgumentError(
                'Invalid retry.handler.delay value', cfg);
        }
        //If using default delay, the following parameters must be valid
        if (cfg.retry.handler.delay === this._retryDelay) {
            for(let n of ['baseDelay', 'secInfoBaseDelay']) {
                if (!isPosInt32(cfg.retry[n])) {
                    throw new NoSQLArgumentError(
                        `Invalid retry.${n} value`, cfg);
                }
            }
            if (!isPosInt32OrZero(cfg.retry.secInfoNumBackoff)) {
                throw new NoSQLArgumentError(
                    'Invalid retry.secInfoNumBackoff value', cfg);
            }
            if (cfg.retry.controlOpBaseDelay != null &&
                !isPosInt32(cfg.retry.controlOpBaseDelay)) {
                throw new NoSQLArgumentError(
                    'Invalid retry.controlOpBaseDelay value', cfg);
            }
        }
    }

    static _endpoint2url(cfg) {
        let endpoint = cfg.endpoint;
        if (endpoint instanceof URL) {
            endpoint = endpoint.href;
            if (endpoint.endsWith('/')) {
                endpoint = endpoint.slice(0, -1);
            }
        }
        
        let host = endpoint;
        let proto;
        let port;
        let i = endpoint.indexOf('://');
        if (i !== -1) {
            proto = endpoint.substring(0, i).toLowerCase();
            if (proto !== 'http' && proto !== 'https') {
                throw new NoSQLArgumentError(`Invalid service protocol \
${proto} in endpoint ${endpoint}`, cfg);
            }
            host = endpoint.substring(i + 3);
        }
        if (host.includes('/')) {
            throw new NoSQLArgumentError(`Invalid endpoint: ${endpoint}, may \
not contain path`, cfg);
        }
        const parts = host.split(':');
        host = parts[0];
        if (!parts.length || parts.length > 2) {
            throw new NoSQLArgumentError(`Invalid endpoint: ${endpoint}`,
                cfg);
        }
        if (parts.length === 2) {
            port = Number(parts[1]);
            if (!isPosInt32(port)) {
                throw new NoSQLArgumentError(`Invalid port value ${parts[1]} \
    for endpoint ${endpoint}`, cfg);
            }
        }
        /*
         * If protocol is not specified and the port isn't 443, assume we're
         * using http. Cases where we may use port 80, 8080, or a non-standard
         * port include internal testing to the proxy or minicloud.
         */
        if (proto == null) {
            if (port == null) {
                port = 443;
            }
            proto = port === 443 ? 'https' : 'http';
        } else if (port == null) {
            port = proto === 'https' ? 443 : 8080;
        }
        try {
            return new URL(`${proto}://${host}:${port}`);
        } catch(err) {
            throw new NoSQLArgumentError(`Invalid endpoint: ${endpoint}, \
failed to construct URL`, cfg);
        }
    }
    
    static _init(cfg) {
        if (cfg.serviceType != null) {
            if (typeof cfg.serviceType === 'string') {
                cfg.serviceType = ServiceType[cfg.serviceType.toUpperCase()];
            }
            if (!(cfg.serviceType instanceof ServiceType)) {
                throw new NoSQLArgumentError('Invalid service type', cfg);
            }
        }
        if (cfg.region != null) {
            if (typeof cfg.region === 'string') {
                cfg.region = Region[cfg.region.toUpperCase()];
            }
            if (!(cfg.region instanceof Region)) {
                throw new NoSQLArgumentError('Invalid region', cfg);
            }
            if (cfg.endpoint == null) {
                cfg.endpoint = cfg.region.endpoint;
            }
        }
        if (!cfg.endpoint || (typeof cfg.endpoint !== 'string' &&
        !(cfg.endpoint instanceof URL))) {
            throw new NoSQLArgumentError(
                'Missing or invalid service endpoint', cfg);
        }
        cfg.url = this._endpoint2url(cfg);

        for(let n of ['timeout', 'ddlTimeout', 'securityInfoTimeout',
            'tablePollTimeout', 'tablePollDelay']) {
            if (!isPosInt32(cfg[n])) {
                throw new NoSQLArgumentError(`Invalid ${n} value`, cfg);
            }
        }
        if (cfg.tablePollTimeout < cfg.tablePollDelay) {
            throw new NoSQLArgumentError('Table poll timeout cannot be less \
than table poll delay', cfg);
        }
        if (typeof cfg.consistency === 'string') {
            cfg.consistency = Consistency[cfg.consistency.toUpperCase()];
        }
        if (!(cfg.consistency instanceof Consistency)) {
            throw new NoSQLArgumentError('Invalid consistency value', cfg);
        }
        if (cfg.httpOpt != null && typeof cfg.httpOpt !== 'object') {
            throw new NoSQLArgumentError('Invalid HTTP options object', cfg);
        }
        this._initRetry(cfg);
        AuthConfig.init(cfg);
        if (cfg.dbNumber != null) {
            cfg._dbNumber = new NumberTypeHandler(cfg);
        }
    }

    static _shouldInheritDefault(key, val) {
        //We inherit default properties only for plain Javascript objects,
        //not instances of classes.  In addition we don't inherit handlers or
        //providers.  We assume that in these cases the objects fully
        //implement their functionality.
        if (!isPlainObject(val)) {
            return false;
        }
        const keyLwr = key.toLowerCase();
        return !keyLwr.endsWith('handler') && !keyLwr.endsWith('provider');
    }

    static _inheritOpt(opt, def) {
        for(let [key, val] of Object.entries(opt)) {
            //Recurse if the property should also be inherited and default
            //has matching key
            if (this._shouldInheritDefault(key, val)) {
                const defVal = def[key];
                if (defVal != null) {
                    this._inheritOpt(val, defVal);
                }
            }
        }
        opt.__proto__ = def;
    }

    static _copyOpt(opt) {
        opt = Object.assign({}, opt);
        for(let [key, val] of Object.entries(opt)) {
            //Recurse if the property should also be inherited and default
            //has matching key
            if (isPlainObject(val)) {
                opt[key] = this._copyOpt(val);
            }
        }
        return opt;
    }

    //last argument "req" is only for error reporting
    static inheritOpt(opt, def, req) {
        if (opt == null) {
            opt = {};
        } else if (typeof opt !== 'object') {
            throw new NoSQLArgumentError('Invalid options object',
                req ? req : opt);
        }
        if (opt.__proto__ !== def) {
            this._inheritOpt(opt, def);
        }
        return opt;
    }

    static create(cfg) {
        if (typeof cfg === 'string') {
            try {
                cfg = require(path.resolve(cfg));
            } catch(err) {
                throw new NoSQLArgumentError('Error loading configuration ' +
                    `file ${cfg}`, 'NoSQLClient', err);
            }
        } else if (!cfg || typeof cfg !== 'object') {
            throw new NoSQLArgumentError('Missing or invalid configuration',
                'NoSQLClient');
        }
        //Copy cfg to prevent further user's changes from having effect.  We
        //also copy defaults to make sure all changes during _init() are done
        //on separate object.
        cfg = this.inheritOpt(this._copyOpt(cfg),
            this._copyOpt(this.defaults));
        this._init(cfg);
        return cfg;
    }

    static destroy(cfg) {
        return AuthConfig.close(cfg);
    }

}

//Default configuration values

Config.defaults = Object.freeze({
    timeout: 5000,
    ddlTimeout: 10000,
    securityInfoTimeout: 10000,
    tablePollTimeout: 60000,
    tablePollDelay: 1000,
    adminPollTimeout: 60000,
    adminPollDelay: 1000,
    consistency: Consistency.EVENTUAL,
    maxMemoryMB: 1024,
    retry: Object.freeze({
        maxRetries: 10,
        baseDelay: 1000,
        controlOpBaseDelay: 60000,
        secInfoBaseDelay: 100,
        secInfoNumBackoff: 10,
        handler: Object.freeze({
            doRetry: Config._shouldRetry,
            delay: Config._retryDelay
        })
    }),
    httpOpt: Object.freeze({
        keepAlive: true,
        checkServerIdentity: () => {}
    }),
    auth: AuthConfig.defaults
});

module.exports = Config;
