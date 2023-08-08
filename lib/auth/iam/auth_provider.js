/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');
const fsPromises = require('fs').promises;

const isPosInt32 = require('../../utils').isPosInt32;
const HttpConstants = require('../../constants').HttpConstants;
const Config = require('../../config');
const ErrorCode = require('../../error_code');
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const AuthError = require('../../error').NoSQLAuthorizationError;
const Utils = require('./utils');
const IAMProfileProvider = require('./profile').IAMProfileProvider;
const UserProfileProvider = require('./profile').UserProfileProvider;
const OCIConfigFileProvider = require('./profile').OCIConfigFileProvider;
const ResourcePrincipalProvider = require('./resource_principal');
const InstancePrincipalProvider = require('./instance_principal');
const { SessTokenProfileProvider } = require('./profile');

/* Maximum lifetime of signature 300 seconds */
const MAX_ENTRY_LIFE_TIME = 300;

const DATE_HEADER = Utils.isInBrowser ?
    HttpConstants.X_DATE : HttpConstants.DATE;

const SIGNING_HEADERS = `(request-target) host ${DATE_HEADER}`;

const OBO_TOKEN_HEADER = 'opc-obo-token';

const SIGNING_HEADERS_WITH_OBO = SIGNING_HEADERS + ' ' + OBO_TOKEN_HEADER;

const PROFILE_PROPS = [ 'tenantId', 'userId', 'fingerprint', 'privateKey',
    'privateKeyFile', 'passphrase' ];

const OCI_CONFIG_PROPS = [ 'configFile', 'profileName' ];

const CREDS_PROVIDER_PROP = 'credentialsProvider';

const INST_PRINCIPAL_PROP = 'useInstancePrincipal';

const RES_PRINCIPAL_PROP = 'useResourcePrincipal';

const SESS_TOKEN_PROP = 'useSessionToken';

const USER_IDEN_PROPS = [ ...PROFILE_PROPS, ...OCI_CONFIG_PROPS,
    CREDS_PROVIDER_PROP ];

function _chkExclProps(cfg, opt, prop, props, truthyProps) {
    let val;
    if ((val = props.find(item => opt[item] != null)) ||
        (truthyProps && (val = truthyProps.find(item => opt[item])))) {
        if (Array.isArray(prop)) {
            prop = 'any of ' + prop.join(', ');
        }
        throw new NoSQLArgumentError(`Cannot specify property ${val} \
together with ${prop}`, cfg);
    }
}

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
            _chkExclProps(cfg, opt, RES_PRINCIPAL_PROP, USER_IDEN_PROPS,
                [ INST_PRINCIPAL_PROP, SESS_TOKEN_PROP ]);
            this._provider = new ResourcePrincipalProvider(cfg);
        } else if (opt.useInstancePrincipal) {
            _chkExclProps(cfg, opt, INST_PRINCIPAL_PROP, USER_IDEN_PROPS,
                [ SESS_TOKEN_PROP ]);
            this._provider = new InstancePrincipalProvider(cfg);
        } else if (opt.useSessionToken) {
            _chkExclProps(cfg, opt, SESS_TOKEN_PROP,
                [ ...PROFILE_PROPS, CREDS_PROVIDER_PROP ]);
            this._provider = new OCIConfigFileProvider(cfg,
                SessTokenProfileProvider);
        }
        else if (PROFILE_PROPS.some(prop => opt[prop] != null)) {
            _chkExclProps(cfg, opt, PROFILE_PROPS,
                [ ...OCI_CONFIG_PROPS, CREDS_PROVIDER_PROP ]);
            this._provider = new IAMProfileProvider(opt, cfg);
        } else if (opt[CREDS_PROVIDER_PROP] != null) {
            _chkExclProps(cfg, opt, CREDS_PROVIDER_PROP, OCI_CONFIG_PROPS);
            this._provider = new UserProfileProvider(cfg);
        } else if (opt.profileProvider != null) {
            //profileProvider is only used internally now, so not included in
            //exclusivity checks above
            if (typeof opt.profileProvider !== 'object') {
                throw new NoSQLArgumentError(
                    'Custom profile provider must be an object', cfg);
            }
            this._provider = opt.profileProvider;
        } else {
            this._provider = new OCIConfigFileProvider(cfg);
        }

        this._initDelegationToken(opt, cfg);

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

    _initDelegationToken(opt, cfg) {
        if (opt.delegationToken != null) {
            if (!opt.useInstancePrincipal) {
                throw new NoSQLArgumentError('Cannot specify \
auth.iam.delegationToken if not using instance principal', cfg);
            }
            if (opt.delegationTokenProvider != null) {
                throw new NoSQLArgumentError('Cannot specify \
auth.iam.delegationToken together with auth.iam.delegationTokenProvider',
                cfg);
            }
            if (typeof opt.delegationToken !== 'string' ||
                !opt.delegationToken) {
                throw new NoSQLArgumentError('Invalid value for \
auth.iam.delegationToken, must be non-empty string', cfg);
            }
            this._delegationToken = opt.delegationToken;
        } else if (opt.delegationTokenProvider != null) {
            if (!opt.useInstancePrincipal) {
                throw new NoSQLArgumentError('Cannot specify \
auth.iam.delegationTokenProvider if not using instance principal', cfg);
            }
            if (typeof opt.delegationTokenProvider === 'string') {
                if (!opt.delegationTokenProvider) {
                    throw new NoSQLArgumentError('Invalid value of \
auth.iam.delegationTokenProvider, cannot be empty string', cfg);
                }
                this._delegationTokenFile = opt.delegationTokenProvider;
                this._delegationTokenProvider = {
                    loadDelegationToken: async () => {
                        const data = await fsPromises.readFile(
                            this._delegationTokenFile, 'utf8');
                        return data.replace(/\r?\n/g, '');
                    }
                };
            } else if (typeof opt.delegationTokenProvider === 'object') {
                if (typeof opt.delegationTokenProvider.loadDelegationToken !==
                    'function') {
                    throw new NoSQLArgumentError('Invalid value of \
auth.iam.delegationTokenProvider: does not contain loadDelegationToken \
method', cfg);
                }
                this._delegationTokenProvider = opt.delegationTokenProvider;
            } else if (typeof opt.delegationTokenProvider === 'function') {
                this._delegationTokenProvider = {
                    loadDelegationToken: opt.delegationTokenProvider
                };
            } else {
                throw new NoSQLArgumentError(`Invalid type of \
auth.iam.delegationTokenProvider: ${typeof opt.delegationTokenProvider}`,
                cfg);
            }
        }
    }

    async _loadDelegationToken()
    {
        let delegationToken;
        try {
            delegationToken = await this._delegationTokenProvider
                .loadDelegationToken();
        } catch(err) {
            throw AuthError.invalidArg('Error retrieving delegation token' +
                this._delegationTokenFile ?
                ` from file ${this._delegationTokenFile}` : '', err);
        }
        if (typeof delegationToken !== 'string' || !delegationToken) {
            throw AuthError.invalidArg('Retrieved delegation token \
is invalid or empty');
        }
        return delegationToken;
    }

    _signingContent(dateStr) {
        let content = `${HttpConstants.REQUEST_TARGET}: post /\
${HttpConstants.NOSQL_DATA_PATH}\n\
${HttpConstants.HOST}: ${this._serviceHost}\n\
${DATE_HEADER}: ${dateStr}`;
        if (this._delegationToken != null) {
            content += `\n${OBO_TOKEN_HEADER}: ${this._delegationToken}`;
        }
        return content;
    }

    async _createSignatureDetails(needProfileRefresh) {
        this._profile = await this._provider.getProfile(needProfileRefresh);
        if (this._delegationTokenProvider != null) {
            this._delegationToken = await this._loadDelegationToken();
        }
        const date = new Date();
        const dateStr = date.toUTCString();
        let signature = await Utils.sign(this._signingContent(dateStr),
            this._profile.privateKey, 'request');
        return {
            time: date.getTime(),
            dateStr,
            header: Utils.signatureHeader(
                this._delegationToken == null ?
                    SIGNING_HEADERS : SIGNING_HEADERS_WITH_OBO,
                this._profile.keyId, signature),
            tenantId: this._profile.tenantId
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
        const invalidProfile = invalidAuth || this._profile == null ||
            (this._provider.isProfileValid != null &&
            !this._provider.isProfileValid(this._profile));
        assert(this._signatureDetails != null || invalidProfile);
        if (invalidAuth || invalidProfile ||
            this._signatureDetails.time < Date.now() - this._duration) {
            this._signatureDetails =
                await this._createSignatureDetails(invalidAuth);
            this._scheduleRefresh();
        }
        const ret = {
            [HttpConstants.AUTHORIZATION]: this._signatureDetails.header,
            [DATE_HEADER]: this._signatureDetails.dateStr,
        };

        //It is possible that if _createSignatureDetails() is called
        //concurrently and there is a new delegation token, at some moment we
        //could have new delegation token and old signature.  However, this
        //would be very rare and if happens the request will fail with an auth
        //error and be retried, at which time a new signature will be created.
        if (this._delegationToken != null) {
            ret[OBO_TOKEN_HEADER] = this._delegationToken;
        }

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

        //Currently proxy uses the presence of this header to identify
        //requests from the browser and thus enable CORS (by sending back
        //Access-Control-Allow-Origin header).  The value of this header is
        //not currently used.  
        if (Utils.isInBrowser) {
            ret[HttpConstants.OPC_REQUEST_ID] = 1;
        }

        return ret;
    }

    get region() {
        return this._region;
    }

    //used in unit tests
    clearCache() {
        this._profile = null;
        this._signatureDetails = null;
    }

    /**
     * Releases resources associated with this provider.
     * @see {@link AuthorizationProvider}
     */
    close() {
        if (this._provider.close != null) {
            this._provider.close();
        }
        if (this._refreshTimer != null) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
    }
}

module.exports = IAMAuthorizationProvider;
