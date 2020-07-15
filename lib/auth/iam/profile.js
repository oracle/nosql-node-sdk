/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');
const os = require('os');
const path = require('path');

const clearData = require('../../utils').clearData;
const readProfileSync = require('../../utils').readProfileSync;
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const Utils = require('./utils');

class IAMProfileProvider {

    constructor(creds, cfg) {
        //creds contains required IAM credentials
        //req is user request to pass to exceptions, can be null if called
        //during refresh
        assert(creds != null);

        if (creds.tenantId == null) {
            throw new NoSQLArgumentError('Missing auth.iam.tenantId', cfg);
        }
        if (!Utils.isValidOcid(creds.tenantId)) {
            throw new NoSQLArgumentError(
                `auth.iam.tenantId ${creds.tenantId} is not a valid OCID`);
        }
        this._tenantId = creds.tenantId;

        if (creds.userId == null) {
            throw new NoSQLArgumentError('Missing auth.iam.userId', cfg);
        }
        if (!Utils.isValidOcid(creds.userId)) {
            throw new NoSQLArgumentError(
                `auth.iam.tenantId ${creds.userId} is not a valid OCID`, cfg);
        }
        this._userId = creds.userId;

        if (creds.fingerprint == null ||
            typeof creds.fingerprint !== 'string' ||
            !creds.fingerprint.length) {
            throw new NoSQLArgumentError(`Missing or invalid \
auth.iam.fingerprint: "${creds.fingerprint}"`, cfg);
        }
        this._fingerprint = creds.fingerprint;

        this._keyId =
            `${this._tenantId}/${this._userId}/${this._fingerprint}`;

        if (creds.privateKeyFile != null) {
            if (typeof creds.privateKeyFile !== 'string' &&
                !Buffer.isBuffer(creds.privateKeyFile)) {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.privateKeyFile: ${creds.privateKeyFile}`, cfg);
            }
            if (creds.privateKey != null) {
                throw new NoSQLArgumentError('May not specify both \
auth.iam.privateKeyFile and auth.iam.privateKey', cfg);
            }
            this._pkFile = creds.privateKeyFile;
        } else {
            assert(creds.privateKey != null);
            if (typeof creds.privateKey !== 'string' &&
                !Buffer.isBuffer(creds.privateKey)) {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.privateKey: ${creds.privateKey}`, cfg);
            }
            this._pkData = creds.privateKey;
        }
        if (creds.passphrase != null) {
            if (typeof creds.passphrase !== 'string' &&
                !Buffer.isBuffer(creds.passphrase)) {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.passphrase: ${creds.passphrase}`, cfg);
            }
            this._passphrase = creds.passphrase;
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

    clear() {
        //Ideally this._privateKey should be cleared as well, but cryto
        //module does not currently have such API
        clearData(this._passprase);
    }

}

const DEFAULT_PROFILE_NAME = 'DEFAULT';
const FINGERPRINT_PROP = 'fingerprint';
const TENANCY_PROP = 'tenancy';
const USER_PROP = 'user';
const KEY_FILE_PROP = 'key_file';
const PASSPHRASE_PROP = 'pass_phrase';
const REGION_PROP = 'region';

class OCIConfigFileProvider {

    constructor(cfg) {
        const opt = cfg.auth.iam;
        let configFile;
        let profileName;

        assert(opt != null);
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
        
        //Change to read oci config file only once in the constructor
        this._initProfileSync(configFile, profileName, cfg);
    }

    _initProfileSync(configFile, profileName, cfg) {
        try {
            this._profile = readProfileSync(configFile, profileName);
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg(`Error retrieving \
profile ${profileName} from config file ${configFile}`, err, cfg);
        }
        if (this._profile == null) {
            throw NoSQLAuthorizationError.invalidArg(`Cannot find profile \
${profileName} in config file ${configFile}`, null, cfg);
        }
    }

    async getProfile() {
        assert(this._profile != null);
        let provider;
        try {
            provider = new IAMProfileProvider({
                tenantId: this._profile[TENANCY_PROP],
                userId: this._profile[USER_PROP],
                fingerprint: this._profile[FINGERPRINT_PROP],
                privateKeyFile: this._profile[KEY_FILE_PROP],
                passphrase: this._profile[PASSPHRASE_PROP]
            });
            return provider.getProfile();
        } finally {
            if (provider != null) {
                provider.clear();
            }
        }
    }

    getRegion() {
        return this._profile[REGION_PROP];
    }

}

class UserProfileProvider {

    constructor(cfg) {
        assert(cfg.auth.iam != null);
        let credsProvider = cfg.auth.iam.credentialsProvider;
        assert(credsProvider != null);
        if (typeof credsProvider === 'string') {
            try {
                credsProvider = require(credsProvider);
            } catch(err) {
                throw new NoSQLArgumentError(`Error loading credentials \
provider from module ${credsProvider}`, cfg, err);
            }
        }
        if (typeof credsProvider === 'object') {
            if (credsProvider == null ||
                typeof credsProvider.loadCredentials !== 'function') {
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
        let provider;
        try {
            provider = new IAMProfileProvider(creds);
            return provider.getProfile();
        } finally {
            if (provider != null) {
                provider.clear();
            }
        }
    }

}

module.exports = {
    IAMProfileProvider,
    OCIConfigFileProvider,
    UserProfileProvider
};
