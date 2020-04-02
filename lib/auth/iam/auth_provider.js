/*-
 * Copyright (C) 2011, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * This file was distributed by Oracle as part of a version of Oracle NoSQL
 * Database made available at:
 *
 * http://www.oracle.com/technetwork/database/database-technologies/nosqldb/downloads/index.html
 *
 * Please see the LICENSE file included in the top-level directory of the
 * appropriate version of Oracle NoSQL Database for a copy of the license and
 * additional information.
 */

const assert = require('assert');
const isPosInt32 = require('../../utils').isPosInt32;
const HttpConstants = require('../../utils').HttpConstants;
const Config = require('../../config');
const ErrorCode = require('../../error').ErrorCode;
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const Utils = require('./utils');
const IAMProfileProvider = require('./profile').IAMProfileProvider;
const UserProfileProvider = require('./profile').UserProfileProvider;
const OCIConfigFileProvider = require('./profile').OCIConfigFileProvider;

/* Maximum lifetime of signature 300 seconds */
const MAX_ENTRY_LIFE_TIME = 300;

const SIGNING_HEADERS = '(request-target) host date';

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
        if (opt.useInstancePrincipal) {
            //this._provider = new InstancePrincipalProvider(cfg);
            throw new NoSQLArgumentError('Instance Principal not supported',
                cfg);
        } else if (opt.privateKey != null || opt.privateKeyFile != null) {
            this._provider = new IAMProfileProvider(opt, cfg);
        } else if (opt.credentialsProvider != null) {
            this._provider = new UserProfileProvider(cfg);
        } else {
            this._provider = new OCIConfigFileProvider(cfg);
            //Special case for cloud where the region may be specified in OCI
            //config file.  In this case we try to get the region from the
            //auth provider and retry getting the url from this region.
            if (cfg.url == null) {
                cfg.region = this._provider.getRegion();
                Config.initUrl(cfg, true);
            }
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

    async _createSignatureDetails(req) {
        const profile = await this._provider.getProfile(req);
        const date = new Date();
        const dateStr = date.toUTCString();
        let signature;
        try {
            signature = Utils.sign(this._signingContent(dateStr),
                profile.privateKey);
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg(`Error signing request \
on ${dateStr}`, err, req);
        }
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
        if (this._signatureDetails == null ||
            this._signatureDetails.time < Date.now() - this._duration ||
            (op.lastError != null && op.lastError.errorCode ===
                ErrorCode.INVALID_AUTHORIZATION)) {
            this._signatureDetails = await this._createSignatureDetails(op);
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
                opt.compartment: ${compartment}`, op);
        }
        if (compartment != null) {
            ret[HttpConstants.COMPARTMENT_ID] = compartment;
        }
        return ret;
    }

    get region() {
        return this._region;
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
