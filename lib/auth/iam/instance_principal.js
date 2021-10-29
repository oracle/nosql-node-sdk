/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');
const util = require('util');

const Region = require('../../region');
const HttpConstants = require('../../constants').HttpConstants;
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const NoSQLServiceError = require('../../error').NoSQLServiceError;
const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const isPosInt32 = require('../../utils').isPosInt32;
const isPosInt32OrZero = require('../../utils').isPosInt32OrZero;
const HttpClient = require('../http_client');
const Utils = require('./utils');

/* Instance metadata service base URL */
const METADATA_SERVICE_BASE_URL = 'http://169.254.169.254/opc/v2/';
const FALLBACK_METADATA_SERVICE_URL = 'http://169.254.169.254/opc/v1/';

/* The authorization header need to send to metadata service since V2 */
const AUTHORIZATION_HEADER_VALUE = 'Bearer Oracle';

/* The default purpose value in federation requests against IAM */
const DEFAULT_PURPOSE = 'DEFAULT';

/* signing headers used to obtain security token */
const SIGNING_HEADERS =
    'date (request-target) content-length content-type x-content-sha256';

function authHttpError(msg, cause) {
    return cause instanceof NoSQLServiceError ?
        NoSQLAuthorizationError.service(msg, cause) :
        NoSQLAuthorizationError.network(msg, cause);
}

class X509FederationClient {

    constructor(federationEndpoint, tenantId, purpose, timeout) {
        this._httpClient = new HttpClient();
        this._url = new URL('/v1/x509', federationEndpoint);
        this._tenantId = tenantId;
        this._purpose = purpose;
        this._timeout = timeout;
    }

    _requestPayload(publicKey, instCert, intermediateCerts) {
        const pubKeyEnc = publicKey.export({
            type: 'spki',
            format: 'der',
        }).toString('base64');
        const instCertEnc = Utils.pemCert2derB64(instCert);
        const intermediateCertsEnc = intermediateCerts.map(
            cert => Utils.pemCert2derB64(cert));
        return JSON.stringify({
            publicKey: pubKeyEnc,
            certificate: instCertEnc,
            purpose: this._purpose,
            intermediateCertificates: intermediateCertsEnc
        });
    }

    _signingContent(dateStr, payload, digest) {
        return `${HttpConstants.DATE}: ${dateStr}\n\
${HttpConstants.REQUEST_TARGET}: post ${this._url.pathname}\n\
${HttpConstants.CONTENT_LENGTH.toLowerCase()}: ${payload.length}\n\
${HttpConstants.CONTENT_TYPE.toLowerCase()}: \
${HttpConstants.APPLICATION_JSON}\n\
${HttpConstants.CONTENT_SHA256}: ${digest}`;
    }

    _authHeader(instCert, instPrivateKey, dateStr, payload, digest) {
        const signature = Utils.sign(
            this._signingContent(dateStr, payload, digest),
            instPrivateKey,
            'instance principal federation request');
        const fingerprint = Utils.fingerprintFromPemCert(instCert);
        let keyId = `${this._tenantId}/fed-x509/${fingerprint}`;
        return Utils.signatureHeader(SIGNING_HEADERS, keyId, signature);
    }

    _requestHeaders(instCert, instPrivateKey, payload) {
        const dateStr = new Date().toUTCString();
        const digest = Utils.sha256digest(payload);
        const auth = this._authHeader(instCert, instPrivateKey, dateStr,
            payload, digest);
        return {
            [HttpConstants.CONTENT_TYPE]: HttpConstants.APPLICATION_JSON,
            [HttpConstants.CONTENT_SHA256]: digest,
            [HttpConstants.DATE]: dateStr,
            [HttpConstants.AUTHORIZATION]: auth
        };
    }

    async getSecurityToken(publicKey, instCert, instPrivateKey,
        intermediateCerts) {
        const payload = this._requestPayload(publicKey, instCert,
            intermediateCerts);
        
        const req = {
            url: this._url,
            method: HttpConstants.POST,
            headers: this._requestHeaders(instCert, instPrivateKey, payload),
            timeout: this._timeout,
            payload
        };

        let res;
        try {
            res = await this._httpClient.request(req);
        } catch(err) {
            throw authHttpError('Error getting security token from \
authorization server: ' + err.message, err);
        }

        try {
            res = JSON.parse(res);
        } catch(err) {
            throw NoSQLAuthorizationError.badProto(`Error parsing security \
token response "${res}" from authorization server: ${err.message}`, err);
        }

        if (typeof res.token !== 'string') {
            throw NoSQLAuthorizationError.badProto('Missing or invalid \
security token in authorization server response ' + util.inspect(res));
        }

        return res.token;
    }

}

class InstancePrincipalProvider {

    constructor(cfg) {
        assert(cfg.auth != null && cfg.auth.iam != null);
        const opt = cfg.auth.iam;
        if (opt.federationEndpoint != null) {
            this._initUserFederationEndpoint(opt.federationEndpoint, cfg);
        }
        if (!isPosInt32(opt.timeout)) {
            throw new NoSQLArgumentError('Invalid auth.iam.timeout value',
                cfg);
        }
        this._timeout = opt.timeout;
        this._refreshAheadMs = opt.securityTokenRefreshAheadMs;
        assert(isPosInt32OrZero(this._refreshAheadMs));
        this._expireBeforeMs = opt.securityTokenExpireBeforeMs;
        assert(isPosInt32OrZero(this._expireBeforeMs));

        this._httpClient = new HttpClient(null, false);
    }

    _initUserFederationEndpoint(ep, cfg) {
        let url;
        if (typeof ep === 'string') {
            try {
                url = new URL(ep);
            } catch(err) {
                throw new NoSQLArgumentError(
                    'Invalid auth.iam.federationEndpoint URL', cfg, err);
            }
        } else if (ep instanceof URL) {
            url = ep;
        } else {
            throw new NoSQLArgumentError(
                'Invalid auth.iam.federationEndpoint value', cfg);
        }
        if (!url.href.startsWith('https://auth.') || url.port ||
            (url.pathname && url.pathname !== '/') || url.search) {
            throw new NoSQLArgumentError('Invalid format of \
auth.iam.federationEndpoint, the valid format is \
https://auth.{region-identifier}.{second-level-domain}', cfg);
        }
        this._federationEndpoint = url;
    }

    async _getInstanceMetadata(path, desc) {
        let chkFallback;
        if (this._metadataUrl == null) {
            this._metadataUrl = METADATA_SERVICE_BASE_URL;
            chkFallback = true;
        }

        const req = {
            url: this._metadataUrl + path,
            method: HttpConstants.GET,
            headers: {
                [HttpConstants.AUTHORIZATION]: AUTHORIZATION_HEADER_VALUE
            },
            timeout: this._timeout
        };

        try {
            return await this._httpClient.request(req);
        } catch(err) {
            if (chkFallback && err instanceof NoSQLServiceError &&
                err.statusCode === HttpConstants.HTTP_NOT_FOUND) {
                this._metadataUrl = FALLBACK_METADATA_SERVICE_URL;
                req.url = this._metadataUrl + path;
                try {
                    return await this._httpClient.request(req);
                } catch(err2) {
                    throw authHttpError(`Unable to get ${desc} from instance \
metadata ${METADATA_SERVICE_BASE_URL}, error: ${err2.message}`, err2);
                }
            } else {
                throw authHttpError(`Unable to get ${desc} from instance \
metadata ${METADATA_SERVICE_BASE_URL} or fall back to \
${FALLBACK_METADATA_SERVICE_URL}, error: ${err.message}`, err);
            }
        }
    }

    /*
    * Auto detects the endpoint that should be used when talking to
    * IAM, if no endpoint has been configured already.
    */
    async _initFederationEndpoint() {
        if (this._federationEndpoint != null) {
            return;
        }
        const res = await this._getInstanceMetadata('instance/region',
            'federation endpoint');
        const reg = Region.fromRegionCodeOrId(res);
        if (reg == null) {
            throw NoSQLAuthorizationError.illegalState(`Missing or unknown \
instance region: ${res}`);
        }
        this._federationEndpoint =
            `https://auth.${reg.regionId}.${reg.secondLevelDomain}`;
    }

    async _refreshInstanceCerts() {
        this._instCert = await this._getInstanceMetadata(
            'identity/cert.pem', 'instance leaf certificate');
        const tenantId = Utils.getTenantIdFromInstanceCert(
            Utils.parseCert(this._instCert));
        if (this._tenantId == null) {
            this._tenantId = tenantId;
        } else if (this._tenantId != tenantId) {
            throw NoSQLAuthorizationError.illegalState(`Tenant id in \
instance leaf certificate ${tenantId} is different from previously retrieved \
or set tenant id ${this._tenantId}`);
        }

        const pk = await this._getInstanceMetadata('identity/key.pem',
            'instance private key');
        this._instPrivateKey = Utils.privateKeyFromPEM(pk);

        const intermediateCert = await this._getInstanceMetadata(
            'identity/intermediate.pem', 'instance intermediate certificate');
        this._intermediateCerts = [ intermediateCert ];
    }

    async _getSecurityToken() {
        await this._initFederationEndpoint();
        await this._refreshInstanceCerts();
        this._keyPair = await Utils.generateRSAKeyPair();
        
        if (this._federationClient == null) {
            this._federationClient = new X509FederationClient(
                this._federationEndpoint, this._tenantId, DEFAULT_PURPOSE,
                this._timeout);
        }

        return this._federationClient.getSecurityToken(
            this._keyPair.publicKey, this._instCert, this._instPrivateKey,
            this._intermediateCerts);
    }

    async _refreshProfileInt() {
        const val = await this._getSecurityToken();
        this._token = Utils.parseSecurityToken(val);
        this._profile = {
            keyId: 'ST$' + this._token.value,
            privateKey: this._keyPair.privateKey
        };
    }

    async _refreshProfile(toThrow) {
        //Avoid multiple concurrent requests for security token.
        if (this._profilePromise == null) {
            this._profilePromise = this._refreshProfileInt();
        }
        try {
            await this._profilePromise;
        } catch(err) {
            if (toThrow) {
                throw err;
            } else {
                //If error occurred during background refresh, we don't throw
                //and don't reschedule next refresh.
                return;
            }
        } finally {
            if (this._refreshTimer != null) {
                clearTimeout(this._refreshTimer);
            }
            this._profilePromise = null;
        }

        if (!this._refreshAheadMs) { //only for tests
            return;
        }

        const exp = Utils.getSecurityTokenExpiration(this._token,
            this._expireBeforeMs);
        if (!Number.isFinite(exp)) {
            return;
        }
        
        const refreshInterval = exp - this._refreshAheadMs - Date.now();
        if (refreshInterval <= 0) {
            return;
        }

        this._refreshTimer = setTimeout(
            () => this._refreshProfile(), refreshInterval);
    }

    isProfileValid(profile) {
        assert(profile != null);
        return profile == this._profile &&
            Utils.isSecurityTokenValid(this._token, this._expireBeforeMs);
    }

    async getProfile(needRefresh) {
        if (needRefresh || this._token == null ||
            !Utils.isSecurityTokenValid(this._token, this._expireBeforeMs)) {
            await this._refreshProfile(true);
        }

        return this._profile;
    }

    close() {
        if (this._refreshTimer != null) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
    }

}

module.exports = InstancePrincipalProvider;
