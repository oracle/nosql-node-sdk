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
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const promisified = require('../../utils').promisified;
const clearData = require('../../utils').clearData;
const readProfile = require('../../utils').readProfile;
const NoSQLArgumentError = require('../../error').NoSQLArgumentError;
const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const Utils = require('./utils');

class IAMProfileProvider {

    constructor(creds, req) {
        //creds contains required IAM credentials
        //req is user request to pass to exceptions, can be null if called
        //during refresh
        assert(creds != null);

        if (creds.tenantId == null) {
            throw new NoSQLArgumentError('Missing auth.iam.tenantId', req);
        }
        if (!Utils.isValidOcid(creds.tenantId)) {
            throw new NoSQLArgumentError(
                `auth.iam.tenantId ${creds.tenantId} is not a valid OCID`);
        }
        this._tenantId = creds.tenantId;

        if (creds.userId == null) {
            throw new NoSQLArgumentError('Missing auth.iam.userId', req);
        }
        if (!Utils.isValidOcid(creds.userId)) {
            throw new NoSQLArgumentError(
                `auth.iam.tenantId ${creds.userId} is not a valid OCID`, req);
        }
        this._userId = creds.userId;

        if (creds.fingerprint == null ||
            typeof creds.fingerprint !== 'string' ||
            !creds.fingerprint.length) {
            throw new NoSQLArgumentError(`Missing or invalid \
auth.iam.fingerprint: "${creds.fingerprint}"`, req);
        }
        this._fingerprint = creds.fingerprint;

        this._keyId =
            `${this._tenantId}/${this._userId}/${this._fingerprint}`;

        if (creds.privateKeyFile != null) {
            if (typeof creds.privateKeyFile !== 'string' &&
                !Buffer.isBuffer(creds.privateKeyFile)) {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.privateKeyFile: ${creds.privateKeyFile}`, req);
            }
            if (creds.privateKey != null) {
                throw new NoSQLArgumentError('May not specify both \
auth.iam.privateKeyFile and auth.iam.privateKey', req);
            }
            this._pkFile = creds.privateKeyFile;
        } else {
            assert(creds.privateKey != null);
            if (typeof creds.privateKey !== 'string' &&
                !Buffer.isBuffer(creds.privateKey)) {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.privateKey: ${creds.privateKey}`, req);
            }
            this._pkData = creds.privateKey;
        }
        if (creds.passphrase != null) {
            if (typeof creds.passphrase !== 'string' &&
                !Buffer.isBuffer(creds.passphrase)) {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.passphrase: ${creds.passphrase}`, req);
            }
            this._passphrase = creds.passphrase;
        }
    }

    async _initPrivateKey() {
        let key;
        try {
            if (this._pkFile != null) {
                key = await promisified(null, fs.readFile, this._pkFile);
            } else {
                key = this._pkData;
            }
            this._privateKey = crypto.createPrivateKey({
                key,
                format: 'pem',
                passphrase: this._passphrase ? this._passphrase : undefined
            });
        } finally {
            if (this._pkFile != null) {
                clearData(key);
            }
        }
    }

    async getProfile(req) {
        if (this._privateKey == null) {
            try {
                await this._initPrivateKey();
            } catch(err) {
                throw NoSQLAuthorizationError.invalidArg('Error creating \
private key' + this._pkFile ? ` from file ${this._pkFile}` : '', err, req);
            }
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

class OCIConfigFileProvider {

    constructor(cfg) {
        const opt = cfg.auth.iam;
        assert(opt != null);
        if (opt.configFile != null) {
            if (typeof opt.configFile !== 'string' &&
                !Buffer.isBuffer(opt.configFile)) {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.configFile: ${opt.configFile}`, cfg);
            }
            this._configFile = opt.configFile;
        } else {
            this._configFile = path.join(os.homedir(), '.oci', 'config');
        }
        if (opt.profileName != null) {
            if (typeof opt.profileName !== 'string') {
                throw new NoSQLArgumentError(`Invalid value for \
auth.iam.profileName: ${opt.profileName}`, cfg);
            }
            this._profileName = opt.profileName;
        } else {
            this._profileName = DEFAULT_PROFILE_NAME;
        }
    }

    async getProfile(req) {
        let profile;
        try {
            profile = await readProfile(this._configFile, this._profileName);
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg(`Error retrieving \
profile ${this._profileName} from config file ${this._configFile}`, err, req);
        }
        if (profile == null) {
            throw NoSQLAuthorizationError.invalidArg(`Cannot find profile \
${this._profileName} in config file ${this._configFile}`, null, req);
        }
        let provider;
        try {
            provider = new IAMProfileProvider({
                tenantId: profile[TENANCY_PROP],
                userId: profile[USER_PROP],
                fingerprint: profile[FINGERPRINT_PROP],
                privateKeyFile: profile[KEY_FILE_PROP],
                passphrase: profile[PASSPHRASE_PROP]
            }, req);
            return provider.getProfile(req);
        } finally {
            if (provider != null) {
                provider.clear();
            }
        }
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

    async getProfile(req) {
        let creds;
        try {
            creds = await this._credsProvider.loadCredentials();
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg('Error retrieving \
credentials', err, req);
        }
        if (creds == null || typeof creds !== 'object') {
            throw NoSQLAuthorizationError.invalidArg('Retrieved credentials \
are missing or invalid', req);
        }
        let provider;
        try {
            provider = new IAMProfileProvider(creds, req);
            return provider.getProfile(req);
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
