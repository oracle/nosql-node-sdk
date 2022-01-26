/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/**
 * Defines types used for NoSQL driver authorization.
 */

/**
 * Authorization configuration for the driver provided as {@link Config}#auth
 * when {@link NoSQLClient} instance is created.
 * <p>
 * Every request to the server made by {@link NoSQLClient} methods requires
 * authorization information.  The way authorization information is obtained
 * depends on the {@link ServiceType} used (set as
 * {@link Config}#serviceType):
 * <ul>
 * <li>For {@link ServiceType.CLOUD}, authorization information is obtained
 * using Oracle Cloud Infrastructure Identity and Access Management (IAM).  To
 * enable authorization, you must set IAM configuration in the form of
 * {@link IAMConfig} as {@link AuthConfig}#iam property.</li>
 * <li>For {@link ServiceType.CLOUDSIM}, authorization is not required and
 * you do not need to specify {@link Config}#auth property.</li>
 * <li>For {@link ServiceType.KVSTORE}, if using secure store, you need to
 * specify the store authentication information such as user name and password
 * as {@link AuthConfig}#kvstore property in the form of
 * {@link KVStoreAuthConfig}.  If using non-secure store, authorization is not
 * required and you do not need to specify {@link Config}#auth property.</li>
 * <li>You may also choose to implement your own authorization provider to
 * obtain authorization information for each request depending on the
 * operation performed.  In this case, set this provider as
 * {@link AuthConfig}#provider property.  If the provider is set,
 * {@link ServiceType} can be undefined, although it may also be possible to
 * have custom provider for existing service types.</li>
 * </ul>
 * <p>
 * Note that you may specify both {@link AuthConfig}#iam and
 * {@link AuthConfig}#kvstore in the same configuration object only if
 * {@link Config}#serviceType is set to valid {@link ServiceType}.
 * If {@link Config}#serviceType is not set (in which case the driver will try
 * to deduce service type, see {@link ServiceType}), specifying both
 * {@link AuthConfig}#iam and {@link AuthConfig}#kvstore will
 * result in error.
 * 
 * @see {@link Config}
 * @see {@link ServiceType}
 * @see {@link IAMConfig}
 * @see {@link KVStoreAuthConfig}
 * @see {@link AuthorizationProvider}
 * @tutorial connect-cloud
 * @tutorial connect-on-prem
 * 
 * @example //This AuthConfig object contains required properties to obtain
 * authorization from IAM via OCI configuration file
 * {
 *     iam: {
 *         configFile: '~/myapp/.oci/config',
 *         profileName: 'John'
 *     }
 * };
 * 
 * @example //This AuthConfig object contains required information to connect
 * //to secure kvstore and assumes the user credentials are stored in
 * //separate file credentials.json
 * {
 *     kvstore: {
 *         credentials: '/path/to/credentials.json'
 *     }
 * }
 * 
 * @global
 * @typedef {object} AuthConfig
 * @property {IAMConfig} [iam] IAM configuration, see {@link IAMConfig}.
 * Must be set to use Oracle NoSQL Cloud service
 * @property {KVStoreAuthConfig} [kvstore] Configuration to authenticate with
 * secure On-Premise NoSQL database.  Must be set to connect to secure store
 * @property {AuthorizationProvider} [provider] Custom authorization provider
 */

/**
 * Interface to acquire authorization information.  Authorization information
 * may be returned as a string or as an object:
 * <ul>
 * <li>If represented as a <em>string</em>, it will be used as a value of HTTP
 * <em>Authorization</em> header for the service request.</li>
 * <li>If represented as an <em>object</em>, this object's properties will be
 * added as HTTP headers for the service request.</li>
 * </ul>
 * The specifics depend on the authorization protocol used.
 * 
 * @see {@link AuthorizationProvider}
 * 
 * @global
 * @callback getAuthorization
 * @async
 * @param {Operation} operation NoSQL database operation that requires
 * authorization information, see {@link Operation}
 * @returns {Promise} Promise resolved with authorization <em>string</em> or
 * authorization <em>object</em> or rejected with an error
 */

/**
 * AuthorizationProvider is an interface to obtain authorization information
 * for NoSQL database operation.  By default, the driver will use its own
 * authorization providers based on specified {@link ServiceType} and/or
 * presense of service-specific configurations such as {@link IAMConfig} and
 * {@link KVStoreAuthConfig}.  Alternatively, the application may choose to
 * use custom authorization provider and set it as {@link AuthConfig}#provider
 * property.  This custom provider may be specified either as a
 * {@link getAuthorization} function or as an object implementing
 * {@link getAuthorization} function.
 * 
 * @global
 * @typedef {object|getAuthorization} AuthorizationProvider
 * @property {getAuthorization} getAuthorization Retrieves authorization
 * string for an operation
 * @property {function()} [close] If specified, releases any resources
 * associated with this provider when {@link NoSQLClient} instance is closed.
 * Note that this operation may be asynchronous in which case this function
 * should return a <em>Promise</em> (resolved value is ignored), otherwise
 * return value is ignored.  If error occurs, the function should only log it
 * rather than throwing exception or causing Promise rejection
 */

const assert = require('assert');
const ServiceType = require('../constants').ServiceType;
const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const hasOwnProperty = require('../utils').hasOwnProperty;

class AuthConfig {

    static _str2provider(s) {
        return {
            getAuthorization() {
                return Promise.resolve(s);
            }
        };
    }
    
    static _chkInitProvider(cfg) {
        if (typeof cfg.auth === 'string') {
            cfg.auth = {
                provider: this._str2provider(cfg.auth)
            };
            return;
        }
        if (cfg.auth == null) {
            cfg.auth = {};
            return;
        }
        if (typeof cfg.auth !== 'object') {
            throw new NoSQLArgumentError('Invalid value of auth', cfg);
        }
        if (typeof cfg.auth.provider === 'function') {
            const authProvider = cfg.auth.provider;
            cfg.auth.provider = {
                getAuthorization(req) {
                    return authProvider(req);
                }
            };
            return;
        }
        if (cfg.auth.provider != null &&
            (typeof cfg.auth.provider !== 'object' ||
            typeof cfg.auth.provider.getAuthorization !== 'function')) {
            throw new NoSQLArgumentError('Invalid auth.provider value',
                cfg);
        }
    }

    static _initServiceType(cfg) {
        assert(cfg.auth != null && typeof cfg.auth === 'object');
        const ownsAuth = hasOwnProperty(cfg, 'auth');
        const isIAM = ownsAuth && hasOwnProperty(cfg.auth, 'iam');
        const isKVStore = ownsAuth && hasOwnProperty(cfg.auth, 'kvstore');
        if (isIAM && isKVStore) {
            throw new NoSQLArgumentError('May not specify multiple \
authorization configurations iam and kvstore without specifying service \
type');
        }
        if (isIAM) {
            if (typeof cfg.auth.iam !== 'object') {
                throw new NoSQLArgumentError('Invalid auth.iam value', cfg);
            }
            cfg.serviceType = ServiceType.CLOUD;
        } else if (isKVStore) {
            if (typeof cfg.auth.kvstore !== 'object') {
                throw new NoSQLArgumentError('Invalid auth.kvstore value',
                    cfg);
            }
            cfg.serviceType = ServiceType.KVSTORE;
        }
        else if (cfg.auth.provider == null) {
            cfg.serviceType = cfg.region == null ? ServiceType.CLOUDSIM :
                ServiceType.CLOUD;
        }
    }

    static init(cfg) {
        this._chkInitProvider(cfg);
        if (cfg.serviceType == null) {
            this._initServiceType(cfg);
        }
        if (cfg.auth.provider != null) {
            return;
        }
        switch(cfg.serviceType) {
        case ServiceType.CLOUDSIM:
            cfg.auth.provider = this._str2provider('Bearer TestTenant');
            break;
        case ServiceType.CLOUD: {
            const IAMAuthorizationProvider = require('./iam/auth_provider');
            cfg.auth.provider = new IAMAuthorizationProvider(cfg);
            break;
        }
        case ServiceType.KVSTORE:
            //Create KVStoreAuthorizationProvider instance if either
            //credentials provider/file or user/password is specified.
            //Otherwise assume this is unsecure kvstore and authorization
            //provider is not needed.
            if (cfg.auth.kvstore != null &&
                (cfg.auth.kvstore.credentials != null ||
                cfg.auth.kvstore.user != null ||
                cfg.auth.kvstore.password != null)) {
                const KVStoreAuthorizationProvider = require(
                    './kvstore/auth_provider');
                cfg.auth.provider = new KVStoreAuthorizationProvider(cfg);
            } else {
                cfg.auth.provider = this._str2provider(null);
            }
            break;
        default:
            assert(cfg.serviceType && cfg.serviceType._isInternal);
        }
    }

    static close(cfg) {
        assert(cfg.auth && cfg.auth.provider);
        if (typeof cfg.auth.provider.close === 'function') {
            return cfg.auth.provider.close();
        }
    }

}

AuthConfig.defaults = Object.freeze({
    iam: Object.freeze({
        timeout: 120000,
        refreshAheadMs: 10000
    }),
    kvstore: Object.freeze({
        timeout: 30000,
        autoRenew: true
    })
});

module.exports = AuthConfig;
