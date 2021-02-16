/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');
const isPosInt32 = require('../../utils').isPosInt32;
const HttpConstants = require('../../constants').HttpConstants;
const Config = require('../../config');
const ErrorCode = require('../../error_code');
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const hasAnyProperty = require('../../utils').hasAnyProperty;
const Utils = require('./utils');
const IAMProfileProvider = require('./profile').IAMProfileProvider;
const UserProfileProvider = require('./profile').UserProfileProvider;
const OCIConfigFileProvider = require('./profile').OCIConfigFileProvider;
const ResourcePrincipalProvider = require('./resource_principal');
const InstancePrincipalProvider = require('./instance_principal');

/* Maximum lifetime of signature 300 seconds */
const MAX_ENTRY_LIFE_TIME = 300;

const SIGNING_HEADERS = '(request-target) host date';

const PROFILE_PROPS = [ 'tenantId', 'userId', 'fingerprint', 'privateKey',
    'privateKeyFile', 'passphrase' ];

const OCI_CONFIG_PROPS = [ 'configFile', 'profileName' ];

const PROFILE_PROVIDER_PROP = 'credentialsProvider';

const USER_IDEN_PROPS = [ PROFILE_PROPS, OCI_CONFIG_PROPS,
    PROFILE_PROVIDER_PROP ];

class IAMAuthorizationProvider {

    constructor(cfg) {
        assert(cfg.auth != null);
        if (cfg.compartment != null &&
            (typeof cfg.compartment !== 'string' || !cfg.compartment)) {
            throw new NoSQLArgumentError(
                `Invalid value of compartment: ${cfg.compartment}`);
        }
        const opt = cfg.auth.iam;
        if (!opt || typeof opt !== 'object') {
            throw new NoSQLArgumentError('Missing or invalid auth.iam', cfg);
        }

        if (opt.durationSeconds == null) {
            this._duration = MAX_ENTRY_LIFE_TIME;
        } else {
            if (!isPosInt32(opt.durationSeconds)) {
                throw new NoSQLArgumentError(
                    'Invalid auth.iam.durationSeconds value', cfg);
            }
            if (opt.durationSeconds > MAX_ENTRY_LIFE_TIME) {
                throw new NoSQLArgumentError(`Signature cannot be cached for \
more than ${MAX_ENTRY_LIFE_TIME} seconds`, cfg);
            }
            this._duration = opt.durationSeconds;
        }
        this._duration *= 1000;

        if (opt.refreshAheadMs != null) {
            if (!isPosInt32(opt.refreshAheadMs)) {
                throw new NoSQLArgumentError(
                    'Invalid auth.iam.refreshAheadMs value', cfg);
            }
            if (this._duration > opt.refreshAheadMs) {
                this._refreshInterval = this._duration - opt.refreshAheadMs;
            }
        }
        //init authentication details provider
        if (opt.useResourcePrincipal) {
            if (opt.useInstancePrincipal ||
                hasAnyProperty(opt, USER_IDEN_PROPS)) {
                throw new NoSQLArgumentError('Cannot specify \
useInstancePrincipal, user identity, OCI config or credentials provider \
properties together with resource principal', cfg);
            }
            this._provider = new ResourcePrincipalProvider(cfg);
        } else if (opt.useInstancePrincipal) {
            if (hasAnyProperty(opt, USER_IDEN_PROPS)) {
                throw new NoSQLArgumentError('Cannot specify user identity, \
OCI config or credentials provider properties together with instance \
principal', cfg);
            }
            this._provider = new InstancePrincipalProvider(cfg);
        } else if (hasAnyProperty(opt, PROFILE_PROPS)) {
            if (hasAnyProperty(opt, OCI_CONFIG_PROPS,
                PROFILE_PROVIDER_PROP)) {
                throw new NoSQLArgumentError('Cannot specify OCI config or \
credentials provider properties together with user identity properties', cfg);
            }
            this._provider = new IAMProfileProvider(opt, cfg);
        } else if (hasAnyProperty(opt, PROFILE_PROVIDER_PROP)) {
            if (hasAnyProperty(opt, OCI_CONFIG_PROPS)) {
                throw new NoSQLArgumentError('Cannot specify OCI config \
properties together with credentials provider', cfg);
            }
            this._provider = new UserProfileProvider(cfg);
        } else {
            this._provider = new OCIConfigFileProvider(cfg);
        }
        //Special case for cloud where the region may be specified in OCI
        //config file or as part of resource principal environment.  In this
        //case we try to get the region from the auth provider and retry
        //getting the url from this region.
        if (cfg.url == null) {
            if (this._provider.getRegion != null) {
                cfg.region = this._provider.getRegion();
            }
            //If the provider above does not have getRegion() function, this
            //will retult in NoSQLArgumentError.
            Config.initUrl(cfg, true);
        }

        this._serviceHost = cfg.url.hostname;
        this._signature = null;
        this._refreshTimer = null;
    }

    _signingContent(dateStr) {
        return `${HttpConstants.REQUEST_TARGET}: post /\
${HttpConstants.NOSQL_DATA_PATH}\n\
${HttpConstants.HOST}: ${this._serviceHost}\n\
${HttpConstants.DATE}: ${dateStr}`;
    }

    async _createSignatureDetails(needProfileRefresh) {
        const profile = await this._provider.getProfile(needProfileRefresh);
        const date = new Date();
        const dateStr = date.toUTCString();
        let signature = Utils.sign(this._signingContent(dateStr),
            profile.privateKey, 'request');
        return {
            time: date.getTime(),
            dateStr,
            header: Utils.signatureHeader(SIGNING_HEADERS, profile.keyId,
                signature),
            tenantId: profile.tenantId
        };
    }

    _scheduleRefresh() {
        if (this._refreshInterval) {
            //_createSignatureDetails may be called again before
            //the token expiration due to INVALID_AUTHORIZATION error,
            //so the timer may be already set
            if (this._refreshTimer != null) {
                clearTimeout(this._refreshTimer);
            }
            this._refreshTimer = setTimeout(
                () => this._refreshSignatureDetails(),
                this._refreshInterval);
        }
    }

    async _refreshSignatureDetails() {
        try {
            this._signatureDetails = await this._createSignatureDetails();
        } catch(err) {
            //This promise rejection will not be handled so we don't rethrow
            //but only log the error somehow and return without rescheduling.
            //The user will get the error when _createSignatureDetails() is
            //called again by getAuthorization().
            return;
        }
        this._scheduleRefresh();
    }

    /**
     * Gets authorization object for given database operation.
     * Authorization object contains required authorization properties.
     * A local cached value will be returned most of the time.
     * @implements {getAuthorization}
     * @see {@link getAuthorization}
     * @param {Operation} op Database operation
     * needing AT
     * @returns {Promise} Promise of authorization object
     */
    async getAuthorization(op) {
        const invalidAuth = op.lastError != null &&
            op.lastError.errorCode === ErrorCode.INVALID_AUTHORIZATION;
        if (this._signatureDetails == null || invalidAuth ||
            this._signatureDetails.time < Date.now() - this._duration) {
            this._signatureDetails =
                await this._createSignatureDetails(invalidAuth);
            this._scheduleRefresh();
        }
        const ret = {
            [HttpConstants.AUTHORIZATION]: this._signatureDetails.header,
            [HttpConstants.DATE]: this._signatureDetails.dateStr,
        };

        /*
         * If request doesn't have compartment id, set the tenant id as the
         * default compartment, which is the root compartment in IAM if
         * using user principal.
         */
        let compartment = op.opt.compartment;
        if (compartment == null) {
            compartment = this._signatureDetails.tenantId;
        } else if (typeof compartment !== 'string' || !compartment) {
            throw new NoSQLArgumentError(`Invalid value of \
                opt.compartment: ${compartment}`);
        }
        if (compartment != null) {
            ret[HttpConstants.COMPARTMENT_ID] = compartment;
        }
        return ret;
    }

    get region() {
        return this._region;
    }

    //used in unit tests
    clearCache() {
        this._signatureDetails = null;
    }

    /**
     * Releases resources associated with this provider.
     * @see {@link AuthorizationProvider}
     */
    close() {
        if (this._refreshTimer != null) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
    }
}

module.exports = IAMAuthorizationProvider;
