/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');

const HttpConstants = require('../../constants').HttpConstants;
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const isPosInt32 = require('../../utils').isPosInt32;
const HttpClient = require('../http_client');
const InstanceMetadataClient = require('./instance_metadata');
const Utils = require('./utils');
const RefreshableTokenProvider =
    require('./cached_profile').RefreshableTokenProvider;

/* The default purpose value in federation requests against IAM */
const DEFAULT_PURPOSE = 'DEFAULT';

/* signing headers used to obtain security token */
const SIGNING_HEADERS =
    'date (request-target) content-length content-type x-content-sha256';

class X509FederationClient {

    constructor(federationEndpoint, tenantId, purpose, timeout) {
        this._httpClient = new HttpClient();
        this._url = new URL('/v1/x509', federationEndpoint);
        this._tenantId = tenantId;
        this._purpose = purpose;
        this._timeout = timeout;
    }

    _requestPayload(publicKey, instCert, intermediateCerts) {
        const pubKeyEnc = Utils.publicKey2B64(publicKey);
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
${HttpConstants.CONTENT_LENGTH_LWR}: ${payload.length}\n\
${HttpConstants.CONTENT_TYPE_LWR}: ${HttpConstants.APPLICATION_JSON}\n\
${HttpConstants.CONTENT_SHA256}: ${digest}`;
    }

    async _authHeader(instCert, instPrivateKey, dateStr, payload, digest) {
        const signature = await Utils.sign(
            this._signingContent(dateStr, payload, digest),
            instPrivateKey,
            'instance principal federation request');
        const fingerprint = Utils.fingerprintFromPemCert(instCert);
        let keyId = `${this._tenantId}/fed-x509/${fingerprint}`;
        return Utils.signatureHeader(SIGNING_HEADERS, keyId, signature);
    }

    async _requestHeaders(instCert, instPrivateKey, payload) {
        const dateStr = new Date().toUTCString();
        const digest = Utils.sha256digest(payload);
        const auth = await this._authHeader(instCert, instPrivateKey, dateStr,
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
        const requestHeaders = await this._requestHeaders(instCert,
            instPrivateKey, payload);

        const req = {
            url: this._url,
            method: HttpConstants.POST,
            headers: requestHeaders,
            timeout: this._timeout,
            payload
        };

        let res;
        try {
            res = await this._httpClient.request(req);
        } catch(err) {
            throw NoSQLAuthorizationError._httpError('Error getting security \
token from authorization server: ' + err.message, err);
        }

        return Utils.parseTokenResponse(res);
    }

    close() {
        this._httpClient.shutdown();
    }

}

class InstancePrincipalProvider extends RefreshableTokenProvider {

    constructor(opt, cfg) {
        super(opt);
        assert (opt != null);
        if (opt.federationEndpoint != null) {
            this._initUserFederationEndpoint(opt.federationEndpoint, cfg);
        }
        if (!isPosInt32(opt.timeout)) {
            throw new NoSQLArgumentError('Invalid auth.iam.timeout value',
                cfg);
        }
        this._timeout = opt.timeout;
        this._imdsClient = new InstanceMetadataClient(this._timeout);
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

    /*
    * Auto detects the endpoint that should be used when talking to
    * IAM, if no endpoint has been configured already.
    */
    async _initFederationEndpoint() {
        if (this._federationEndpoint != null) {
            return;
        }
        const reg = await this._imdsClient.getRegion();
        assert(reg);
        this._federationEndpoint =
            `https://auth.${reg.regionId}.${reg.secondLevelDomain}`;
    }

    async _refreshInstanceCerts() {
        this._instCert = await this._imdsClient.getValue('identity/cert.pem',
            'instance leaf certificate');
        const tenantId = Utils.getTenantIdFromInstanceCert(
            Utils.parseCert(this._instCert));
        if (this._tenantId == null) {
            this._tenantId = tenantId;
        } else if (this._tenantId != tenantId) {
            throw NoSQLAuthorizationError.illegalState(`Tenant id in \
instance leaf certificate ${tenantId} is different from previously retrieved \
or set tenant id ${this._tenantId}`);
        }

        const pk = await this._imdsClient.getValue('identity/key.pem',
            'instance private key');
        this._instPrivateKey = Utils.privateKeyFromPEM(pk);

        const intermediateCert = await this._imdsClient.getValue(
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

    _getPrivateKey() {
        assert(this._keyPair);
        return this._keyPair.privateKey;
    }

    getRegionFromIMDS() {
        return this._imdsClient.getRegion(true);
    }

    close() {
        super.close();
        if (this._federationClient) {
            this._federationClient.close();
        }
        this._imdsClient.close();
    }
}

module.exports = InstancePrincipalProvider;
