/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');
const fsPromises = require('fs').promises;

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

/* Default path for reading Kubernetes service account cert */
const DEFAULT_KUBERNETES_SERVICE_ACCOUNT_CERT_PATH =
    '/var/run/secrets/kubernetes.io/serviceaccount/ca.crt';

/* Environment variable of the path for Kubernetes service account cert */
const KUBERNETES_SERVICE_ACCOUNT_CERT_PATH_ENV =
    'OCI_KUBERNETES_SERVICE_ACCOUNT_CERT_PATH';

/* Environment variable of Kubernetes service proxymux host */
const KUBERNETES_SERVICE_HOST_ENV = 'KUBERNETES_SERVICE_HOST';

/* Kubernetes proxymux port */
const KUBERNETES_SERVER_PORT = 12250;

/* Default path for service account token */
const KUBERNETES_SERVICE_ACCOUNT_TOKEN_PATH =
    '/var/run/secrets/kubernetes.io/serviceaccount/token';

const SA_TOKEN_NAME = 'Kubernetes service account token';

const TOKEN_PATH = '/resourcePrincipalSessionTokens';

class OKEWorkloadIdentityProvider extends RefreshableTokenProvider {

    constructor(opt, cfg) {
        super(opt);
        assert (opt != null);
        
        this._initServiceAccountToken(opt, cfg);

        const host = process.env[KUBERNETES_SERVICE_HOST_ENV];
        if (host == null) {
            throw NoSQLAuthorizationError.invalidArg(`Missing environment \
variable ${KUBERNETES_SERVICE_HOST_ENV}, please contact OKE Foundation team \
for help.`, null, cfg);
        }

        this._tokenURL = new URL(
            `https://${host}:${KUBERNETES_SERVER_PORT}${TOKEN_PATH}`);

        if (!isPosInt32(opt.timeout)) {
            throw new NoSQLArgumentError('Invalid auth.iam.timeout value',
                cfg);
        }

        this._caCertFile =
            process.env[KUBERNETES_SERVICE_ACCOUNT_CERT_PATH_ENV] ||
            DEFAULT_KUBERNETES_SERVICE_ACCOUNT_CERT_PATH;

        this._timeout = opt.timeout;
        this._imdsClient = new InstanceMetadataClient(this._timeout);
    }

    _initServiceAccountToken(opt, cfg) {
        if (opt.serviceAccountToken != null) {
            assert(opt.useOKEWorkloadIdentity);
            if (opt.serviceAccountTokenProvider != null ||
                opt.serviceAccountTokenFile != null) {
                throw new NoSQLArgumentError('Cannot specify \
auth.iam.serviceAccountToken together with \
auth.iam.serviceAccountTokenProvider or auth.iam.serviceAccountTokenFile',
                cfg);
            }
            if (typeof opt.serviceAccountToken !== 'string' ||
                !opt.serviceAccountToken) {
                throw new NoSQLArgumentError('Invalid value for \
auth.iam.serviceAccountToken, must be non-empty string', cfg);
            }
            this._saToken = opt.serviceAccountToken;
        } else if (opt.serviceAccountTokenProvider != null) {
            assert(opt.useOKEWorkloadIdentity);
            if (opt.serviceAccountTokenFile != null) {
                throw new NoSQLArgumentError('Cannot specify \
auth.iam.serviceAccountTokenProvider together with \
auth.iam.serviceAccountTokenFile',
                cfg);
            }
            if (typeof opt.serviceAccountTokenProvider === 'object') {
                if (typeof opt.serviceAccountTokenProvider
                    .loadServiceAccountToken !== 'function') {
                    throw new NoSQLArgumentError('Invalid value of \
auth.iam.serviceAccountTokenProvider: does not contain \
loadServiceAccountToken method', cfg);
                }
                this._saTokenProvider = opt.serviceAccountTokenProvider;
            } else if (typeof opt.serviceAccountTokenProvider ===
                'function') {
                this._saTokenProvider = {
                    loadServiceAccountToken: opt.serviceAccountTokenProvider
                };
            } else {
                throw new NoSQLArgumentError(`Invalid type of \
auth.iam.serviceAccountTokenProvider: ${typeof opt.delegationTokenProvider}`,
                cfg);
            }
        } else if (opt.serviceAccountTokenFile != null) {
            assert(opt.useOKEWorkloadIdentity);
            if (typeof opt.serviceAccountTokenFile !== 'string' ||
                !opt.serviceAccountTokenFile) {
                throw new NoSQLArgumentError('Invalid value for \
auth.iam.serviceAccountTokenFile, must be non-empty string', cfg);
            }
            this._saTokenFile = opt.serviceAccountTokenFile;
        } else {
            //default file path to service account token
            this._saTokenFile = KUBERNETES_SERVICE_ACCOUNT_TOKEN_PATH;
        }
        if (this._saTokenFile) {
            this._saTokenProvider = {
                loadServiceAccountToken: () => {
                    return fsPromises.readFile(this._saTokenFile, 'utf8');
                }
            };
        }
    }

    async _initHttpClient() {
        if (this._httpClient != null) {
            return;
        }

        assert(this._caCertFile);
        let caCert;
        try {
            caCert = await fsPromises.readFile(this._caCertFile);
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg(`Error retrieving \
Kubernetes service account CA certificate: ${err.message}`, err);
        }

        this._httpClient = new HttpClient({
            ca: caCert,
            checkServerIdentity: () => undefined
        });
    }

    async _getServiceAccountToken() {
        let token = this._saToken;
        if (token == null) {
            try {
                assert(this._saTokenProvider);
                token = await this._saTokenProvider.loadServiceAccountToken();
            } catch (err) {
                throw NoSQLAuthorizationError.invalidArg(`Error retrieving \
${SA_TOKEN_NAME}: ${err.message}`, err);
            }
        }

        if (typeof token !== 'string' || !token) {
            throw NoSQLAuthorizationError.invalidArg('Retrieved service \
account token is missing or invalid');
        }

        const exp = Utils.getSecurityTokenExpiration(Utils.parseSecurityToken(
            token, this._saTokenFile, SA_TOKEN_NAME));

        //Validate expiration time.
        if (!Number.isFinite(exp) || exp < 0) {
            throw NoSQLAuthorizationError.invalidArg(
                'Missing or invalid expration in ' + SA_TOKEN_NAME);
        }
        if (exp < Date.now()) {
            throw NoSQLAuthorizationError.invalidArg(SA_TOKEN_NAME +
                ' has expired');
        }

        return token;
    }

    async _getSecurityToken() {
        await this._initHttpClient();
        this._keyPair = await Utils.generateRSAKeyPair();
        const saToken = await this._getServiceAccountToken();

        const requestId = await Utils.generateOpcRequestId();
        const headers = {
            [HttpConstants.CONTENT_TYPE]: HttpConstants.APPLICATION_JSON,
            [HttpConstants.OPC_REQUEST_ID]: requestId,
            [HttpConstants.AUTHORIZATION]: 'Bearer ' + saToken
        };

        const payload = JSON.stringify({
            podKey: Utils.publicKey2B64(this._keyPair.publicKey)
        });

        let res;
        try {
            res = await this._httpClient.request({
                url: this._tokenURL,
                method: HttpConstants.POST,
                headers,
                payload,
                timeout: this._timeout
            });
        } catch(err) {
            throw NoSQLAuthorizationError._httpError(`Error getting security \
token from Kubernetes: ${err.message}\nopc-request-id: ${requestId}`, err);
        }

        //The encoded response is returned with quotation marks.
        res = res.replace(/"/g, '');
        res = Buffer.from(res, 'base64').toString('utf8');
        res = Utils.parseTokenResponse(res, 'Kubernetes');

        //Kubernetes token has duplicated key id prefix "ST$".
        return res.substring(3);
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
        if (this._httpClient) {
            this._httpClient.shutdown();
        }
        this._imdsClient.close();
    }

}

module.exports = OKEWorkloadIdentityProvider;
