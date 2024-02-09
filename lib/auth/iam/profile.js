/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');
const os = require('os');
const path = require('path');
const fsPromises = require('fs').promises;

const clearData = require('../../utils').clearData;
const readProfileSync = require('../../utils').readProfileSync;
const requireNoWP = require('../../utils').requireNoWP;
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const Utils = require('./utils');

const DEFAULT_PROFILE_NAME = 'DEFAULT';
const FINGERPRINT_PROP = 'fingerprint';
const TENANCY_PROP = 'tenancy';
const USER_PROP = 'user';
const KEY_FILE_PROP = 'key_file';
const PASSPHRASE_PROP = 'pass_phrase';
const REGION_PROP = 'region';
const SESS_TOKEN_FILE_PROP = 'security_token_file';

//Credentials sources, only for error reporing.
const AUTH_IAM_CONFIG = 'auth.iam section of the configuration';
const CREDS_PROVIDER_CREDS = 'credentials from credentials provider';

class IAMProfileProvider {

    //creds contains required IAM credentials
    //cfg and credsSource are only for error reporing
    _initFromCreds(creds, cfg, credsSource) {
        assert(creds != null);

        if (creds.tenantId == null) {
            throw new NoSQLArgumentError(
                `Missing required property "tenantId" in ${credsSource}`,
                cfg);
        }
        if (!Utils.isValidOcid(creds.tenantId)) {
            throw new NoSQLArgumentError(
                `Property "tenantId" in ${credsSource} is not a valid OCID: \
${creds.tenantId}`);
        }
        this._tenantId = creds.tenantId;

        if (creds.userId == null) {
            throw new NoSQLArgumentError(
                `Missing required property "userId" in ${credsSource}`, cfg);
        }
        if (!Utils.isValidOcid(creds.userId)) {
            throw new NoSQLArgumentError(
                `Property "userId" in ${credsSource} is not a valid OCID: \
${creds.userId}`, cfg);
        }
        this._userId = creds.userId;

        if (creds.fingerprint == null) {
            throw new NoSQLArgumentError(
                `Missing required property "fingerprint" in ${credsSource}`,
                cfg);
        }
        if (typeof creds.fingerprint !== 'string' ||
            !creds.fingerprint.length) {
            throw new NoSQLArgumentError(
                `Invalid value for property "fingerprint" in ${credsSource}: \
${creds.fingerprint}`, cfg);
        }
        this._fingerprint = creds.fingerprint;

        this._keyId =
            `${this._tenantId}/${this._userId}/${this._fingerprint}`;

        if (creds.privateKeyFile != null) {
            if (typeof creds.privateKeyFile !== 'string' &&
                !Buffer.isBuffer(creds.privateKeyFile)) {
                throw new NoSQLArgumentError(
                    `Invalid value for property "privateKeyFile" in \
${credsSource}: ${creds.privateKeyFile}`, cfg);
            }
            if (creds.privateKey != null) {
                throw new NoSQLArgumentError(
                    `May not specify both properties "privateKeyFile" and \
"privateKey" in ${credsSource}`, cfg);
            }
            this._pkFile = creds.privateKeyFile;
        } else {
            if (creds.privateKey == null) {
                throw new NoSQLArgumentError(
                    `Missing both properties "privateKeyFile" and \
"privateKey" in ${credsSource}`, cfg);
            }
            if (typeof creds.privateKey !== 'string' &&
                !Buffer.isBuffer(creds.privateKey)) {
                throw new NoSQLArgumentError(`Invalid value for property \
"privateKey" in ${credsSource}: ${creds.privateKey}`, cfg);
            }
            this._pkData = creds.privateKey;
        }
        if (creds.passphrase != null) {
            if (typeof creds.passphrase !== 'string' &&
                !Buffer.isBuffer(creds.passphrase)) {
                throw new NoSQLArgumentError(
                    `Invalid value for property "passphrase" in \
${credsSource}: ${creds.passphrase}`, cfg);
            }
            this._passphrase = creds.passphrase;
        }
    }

    _initFromOCIConfig(profile, cfg) {
        assert(profile != null && profile._ociConfigSrc);
        
        if (!profile[TENANCY_PROP]) {
            throw new NoSQLArgumentError(
                `Missing required property "${TENANCY_PROP}" in \
${profile._ociConfigSrc}`, cfg);
        }
        if (!Utils.isValidOcid(profile[TENANCY_PROP])) {
            throw new NoSQLArgumentError(
                `Property "${TENANCY_PROP}" in ${profile._ociConfigSrc} is \
not a valid OCID: ${profile[TENANCY_PROP]}`, cfg);
        }
        this._tenantId = profile[TENANCY_PROP];

        if (!profile[USER_PROP]) {
            throw new NoSQLArgumentError(
                `Missing required property "${USER_PROP}" in \
${profile._ociConfigSrc}`, cfg);
        }
        if (!Utils.isValidOcid(profile[USER_PROP])) {
            throw new NoSQLArgumentError(
                `Property "${USER_PROP}" in "${profile._ociConfigSrc}" is \
not a valid OCID: ${profile[USER_PROP]}`, cfg);
        }
        this._userId = profile[USER_PROP];

        if (!profile[FINGERPRINT_PROP]) {
            throw new NoSQLArgumentError(
                `Missing required property "${KEY_FILE_PROP}" in \
${profile._ociConfigSrc}`, cfg);
        }
        this._fingerprint = profile[FINGERPRINT_PROP];

        this._keyId =
            `${this._tenantId}/${this._userId}/${this._fingerprint}`;
            
        if (!profile[KEY_FILE_PROP]) {
            throw new NoSQLArgumentError(
                `Missing required property "${KEY_FILE_PROP}" in \
${profile._ociConfigSrc}`, cfg);
        }
        this._pkFile = profile[KEY_FILE_PROP];

        if (profile[PASSPHRASE_PROP]) {
            this._passphrase = profile[PASSPHRASE_PROP];
        }
    }

    constructor(creds, cfg) {
        if (creds._ociConfigSrc) {
            this._initFromOCIConfig(creds, cfg);
        } else {
            this._initFromCreds(creds, cfg, creds._fromCredsProvider ?
                CREDS_PROVIDER_CREDS : AUTH_IAM_CONFIG);
        }
    }

    async _initPrivateKey() {
        if (this._pkFile != null) {
            this._privateKey = await Utils.privateKeyFromPEMFile(this._pkFile,
                this._passphrase);
        } else {
            this._privateKey = Utils.privateKeyFromPEM(this._pkData,
                this._passphrase);
        }
    }

    async getProfile() {
        if (this._privateKey == null) {
            await this._initPrivateKey();
        }
        return {
            keyId: this._keyId,
            privateKey: this._privateKey,
            tenantId: this._tenantId
        };
    }

    close() {
        //Ideally this._privateKey should be cleared as well, but cryto
        //module does not currently have such API
        clearData(this._passprase);
    }

}

class SessTokenProfileProvider {

    constructor(profile, cfg) {
        assert(profile != null && profile._ociConfigSrc);

        if (!profile[TENANCY_PROP]) {
            throw new NoSQLArgumentError(
                `Missing required property "${TENANCY_PROP}" in \
${profile._ociConfigSrc}`, cfg);
        }
        if (!Utils.isValidOcid(profile[TENANCY_PROP])) {
            throw new NoSQLArgumentError(
                `Property "${TENANCY_PROP}" in ${profile._ociConfigSrc} is \
not a valid OCID: ${profile[TENANCY_PROP]}`, cfg);
        }
        this._tenantId = profile[TENANCY_PROP];

        if (!profile[KEY_FILE_PROP]) {
            throw new NoSQLArgumentError(
                `Missing required property "${KEY_FILE_PROP}" in \
${profile._ociConfigSrc}`, cfg);
        }
        this._pkFile = profile[KEY_FILE_PROP];

        if (profile[PASSPHRASE_PROP]) {
            this._passphrase = profile[PASSPHRASE_PROP];
        }

        if (!profile[SESS_TOKEN_FILE_PROP]) {
            throw new NoSQLArgumentError(
                `Missing required property "${SESS_TOKEN_FILE_PROP}" in \
${profile._ociConfigSrc}`, cfg);
        }
        this._sessTokenFile = profile[SESS_TOKEN_FILE_PROP];
    }

    async _initPrivateKey() {
        if (this._pkFile != null) {
            this._privateKey = await Utils.privateKeyFromPEMFile(this._pkFile,
                this._passphrase);
        } else {
            this._privateKey = Utils.privateKeyFromPEM(this._pkData,
                this._passphrase);
        }
    }

    async _readSessToken() {
        let data;
        try {
            data = await fsPromises.readFile(this._sessTokenFile, 'utf8');
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg(
                `Error retrieving security token from file \
${this._sessTokenFile}: ${err.message}`, err);
        }
        data = data.replace(/\r?\n/g, '');
        if (!data) {
            throw NoSQLAuthorizationError.invalidArg(
                `Security token from file ${this._sessTokenFile} is empty`);
        }
        return data;
    }

    async getProfile() {
        if (this._privateKey == null) {
            await this._initPrivateKey();
        }
        const token = await this._readSessToken();
        return {
            keyId: 'ST$' + token,
            privateKey: this._privateKey,
            tenantId: this._tenantId
        };
    }

    close() {
        clearData(this._passprase);
    }

}

class OCIConfigFileProvider {

    constructor(opt, cfg, providerCons = IAMProfileProvider) {
        assert(opt != null);
        let configFile;
        let profileName;

        if (opt.configFile != null) {
            if (typeof opt.configFile !== 'string' &&
                !Buffer.isBuffer(opt.configFile)) {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.configFile: ${opt.configFile}`, cfg);
            }
            configFile = opt.configFile;
        } else {
            configFile = path.join(os.homedir(), '.oci', 'config');
        }
        if (opt.profileName != null) {
            if (typeof opt.profileName !== 'string') {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.profileName: ${opt.profileName}`, cfg);
            }
            profileName = opt.profileName;
        } else {
            profileName = DEFAULT_PROFILE_NAME;
        }

        assert(providerCons != null);
        this._providerCons = providerCons;
        
        //Change to read oci config file only once in the constructor
        const profile = this._getProfileSync(configFile, profileName, cfg);
        this._provider = new providerCons(profile, cfg);
        if (profile[REGION_PROP]) {
            this._region = profile[REGION_PROP];
        }
    }

    _getProfileSync(configFile, profileName, cfg) {
        let profile;
        try {
            profile = readProfileSync(configFile, profileName);
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg(`Error retrieving \
profile ${profileName} from config file ${configFile}`, err, cfg);
        }
        if (profile == null) {
            throw NoSQLAuthorizationError.invalidArg(`Cannot find profile \
"${profileName}" in config file ${configFile}`, null, cfg);
        }

        profile._ociConfigSrc = `OCI config file "${configFile}", \
profile "${profileName}"`;
        return profile;
    }

    getProfile() {
        assert(this._provider != null);
        return this._provider.getProfile();
    }

    getRegion() {
        return this._region;
    }

    close() {
        if (this._provider != null) {
            this._provider.close();
        }
    }
}

class UserProfileProvider {

    constructor(opt, cfg) {
        assert (opt != null && 'credentialsProvider' in opt);
        let credsProvider = opt.credentialsProvider;
        if (typeof credsProvider === 'string') {
            try {
                credsProvider = requireNoWP(credsProvider);
            } catch(err) {
                throw new NoSQLArgumentError(`Error loading credentials \
provider from module "${credsProvider}"`, cfg, err);
            }
        }
        if (typeof credsProvider === 'object' && credsProvider != null) {
            if (typeof credsProvider.loadCredentials !== 'function') {
                throw new NoSQLArgumentError('Invalid value of \
auth.iam.credentialsProvider: does not contain loadCredentials method', cfg);
            }
            this._credsProvider = credsProvider;
        } else if (typeof credsProvider === 'function') {
            this._credsProvider = { loadCredentials: credsProvider };
        } else {
            throw new NoSQLArgumentError(`Invalid value of \
auth.iam.credentialsProvider: ${credsProvider}`, cfg);
        }
    }

    async getProfile() {
        let creds;
        try {
            creds = await this._credsProvider.loadCredentials();
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg('Error retrieving \
credentials', err);
        }
        if (creds == null || typeof creds !== 'object') {
            throw NoSQLAuthorizationError.invalidArg('Retrieved credentials \
are missing or invalid');
        }
        creds._fromCredsProvider = true;

        let provider;
        try {
            provider = new IAMProfileProvider(creds);
            return provider.getProfile();
        } finally {
            if (provider != null) {
                provider.close();
            }
        }
    }

}

module.exports = {
    IAMProfileProvider,
    SessTokenProfileProvider,
    OCIConfigFileProvider,
    UserProfileProvider
};
