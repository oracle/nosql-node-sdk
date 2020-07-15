/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const path = require('path');
const badStrings = require('../common').badStrings;
const badStringsOrFunctions = require('../common').badStringsOrFunctions;
const badStringsOrBinaries = require('../common').badStringsOrBinaries;
const badPosInt32NotNull = require('../common').badPosInt32NotNull;
const badMillisWithOverride = require('../common').badMillisWithOverride;
const Utils = require('../utils');
const TENANT_ID = require('./constants').TENANT_ID;
const USER_ID = require('./constants').USER_ID;
const FINGERPRINT = require('./constants').FINGERPRINT;
const PASSPHRASE = require('./constants').PASSPHRASE;
const TEST_DIR = require('./constants').TEST_DIR;
const PRIVATE_KEY_FILE = require('./constants').PRIVATE_KEY_FILE;
const OCI_CONFIG_FILE = require('./constants').OCI_CONFIG_FILE;
const createKeys = require('./utils').createKeys;

const keys = createKeys();

const badOCIDs = badStrings.concat(undefined, null, 'abcde');
const badFingerprints = badStrings.concat(undefined, null);
const badFilePaths = badStringsOrBinaries.concat('nosuchfile');

const badPrivateKeyPEMs = [
    '', '.....',
    path.join(TEST_DIR, 'nosuchfile'), //used for resource principal
    keys.privatePEM.slice(1, -1), //corrupted PEM key
    keys.privateKey.export({ type: 'pkcs8', format: 'der'}) //wrong format
];

const badPKData = badStringsOrBinaries.concat(badPrivateKeyPEMs,
    Buffer.from('"""'));

const keyIdObj = {
    tenantId: TENANT_ID,
    userId: USER_ID,
    fingerprint: FINGERPRINT
};

const creds = Object.assign({}, keyIdObj, {
    publicKey: keys.publicKey
});

const badRefreshConfigs = [
    ...badPosInt32NotNull.map(durationSeconds => ({
        durationSeconds
    })),
    {
        //exceeds maximum allowed of 300
        durationSeconds: 999
    },
    ...badMillisWithOverride.map(refreshAheadMs => ({
        durationSeconds: 200,
        refreshAheadMs
    }))
];

//direct configs

//configs that should throw in the constructor of IAMAuthorizationProvider
//for inclusion in ../config.js test, not all included for simplicity
//(some are still part of badDirectConfigs)
const badDirectConfigsCons = [
    undefined,
    null,
    10, //must be object
    'abc', //must be object
    function() { return ''; }, //must be object
    ...badOCIDs.map(tenantId => ({
        tenantId,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKey: keys.privatePEM
    })),
    ...badOCIDs.map(userId => ({
        tenantId: TENANT_ID,
        userId,
        fingerprint: FINGERPRINT,
        privateKey: keys.privatePEM
    })),
    ...badFingerprints.map(fingerprint => ({
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint,
        privateKey: keys.privatePEM
    }))
];

const badDirectConfigs = [
    ...badDirectConfigsCons,
    ...badPKData.map(privateKey => ({
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKey
    })),
    ...badStringsOrBinaries.map(passphrase => ({
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKey: keys.privateEncPEM,
        passphrase
    })),
    ...badFilePaths.map(privateKeyFile => ({
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKeyFile
    })),
    ...badPrivateKeyPEMs.map(_privateKeyData => ({
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKeyFile: PRIVATE_KEY_FILE,
        _privateKeyData
    })),
    {
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKeyFile: PRIVATE_KEY_FILE,
        _privateKeyData: keys.privateEncPEM,
        passphrase: 'oracle1' //wrong passphrase
    }
];

const goodDirectConfigs = [
    Object.assign({}, keyIdObj, {
        privateKey : keys.privatePEM
    }),
    Object.assign({}, keyIdObj, {
        privateKey : Buffer.from(keys.privatePEM)
    }),
    Object.assign({}, keyIdObj, {
        privateKey: keys.privateEncPEM,
        passphrase: PASSPHRASE
    }),
    Object.assign({}, keyIdObj, {
        privateKey: Buffer.from(keys.privateEncPEM),
        passphrase: Buffer.from(PASSPHRASE)
    }),
    Object.assign({}, keyIdObj, {
        privateKeyFile: PRIVATE_KEY_FILE,
        _privateKeyData: keys.privatePEM
    }),
    Object.assign({}, keyIdObj, {
        privateKeyFile: Buffer.from(PRIVATE_KEY_FILE)
    }),
    Object.assign({}, keyIdObj, {
        privateKeyFile: PRIVATE_KEY_FILE,
        _privateKeyData: keys.privateEncPEM,
        passphrase: PASSPHRASE
    })
];

//OCI config file configs

const credsLines = [
    'tenancy=' + creds.tenantId,
    'user=' + creds.userId,
    'fingerprint=' + creds.fingerprint,
    'key_file=' + PRIVATE_KEY_FILE
];

const credsLinesEncKey = [
    'tenancy=' + creds.tenantId,
    'user=' + creds.userId,
    'fingerprint=' + creds.fingerprint,
    'key_file=' + PRIVATE_KEY_FILE,
    'pass_phrase=' + PASSPHRASE
];

const badOCIConfigs = [
    {
        data: [] //empty file
    },
    {
        //invalid string in profile
        data: [ '[DEFAULT]', 'blablah', ...credsLines ]
    },
    {   //missing profile John
        data: [ '[DEFAULT]', '#comment', ...credsLinesEncKey, '', '',
            '#comment2' ],
        profile: 'John',
        pkData: keys.privateEncPEM
    },
    {
        //missing passphrase for encrypted key
        data: [ '[DEFAULT]', ...credsLinesEncKey.slice(0, -1), '' ],
        pkData: keys.privateEncPEM
    }
];

const goodOCIConfigs = [
    {
        data: [ '[test_profile]', ...credsLines, '# comment comment' ],
        profile: 'test_profile'
    },
    {
        data: [ '[DEFAULT]', '', ...credsLinesEncKey, '', '', '\n' ]
    },
    {
        data: [ '[sample1]', 'property 1 = 2', '[DEFAULT]', ...credsLines,
            `       fingerprint     = ${creds.fingerprint}      ` ]
    },
    {
        data: [].concat(...Utils.range(100).map(i => [ `[profile${i}]`,
            ...credsLinesEncKey ])),
        profile: 'profile70'
    }
];

const badFileConfigs = [
    ...badFilePaths.map(configFile => ({ configFile })),
    ...badStrings.map(profileName => ({
        configFile: OCI_CONFIG_FILE,
        profileName
    })),
    ...badOCIConfigs.map(cfg => ({
        configFile: OCI_CONFIG_FILE,
        profileName: cfg.profile != null ? cfg.profile : undefined,
        _ociConfigData: cfg.data.join('\n'),

        _privateKeyData: cfg.pkData != null ? cfg.pkData : keys.privatePEM
    }))
];

const goodFileConfigs = goodOCIConfigs.map(cfg => ({
    configFile: OCI_CONFIG_FILE,
    profileName: cfg.profile != null ? cfg.profile : undefined,
    _ociConfigData: cfg.data.join('\n'),
    _privateKeyData: cfg.pkData != null ? cfg.pkData : keys.privatePEM
}));

//user-defined credentials provider configs

//Note that we have to pass _privateKeyData if any to the configuration in
//order to prepare testcase.

const badCredsProviders = [
    ...badStringsOrFunctions,
    0,
    1,  //must be string, function or object
    {}, //missing loadCredentials
    {
        //loadCredentials wrong spelling
        loadCredentails: () => goodDirectConfigs[0]
    },
    {
        loadCredentials: null //loadCredentials must be function
    },
    {
        loadCredentials: 'abcde', //loadCredentials must be function
    },
    ...badDirectConfigs.map(cfg => ({
        loadCredentials: async () => cfg,
        _privateKeyData: cfg ? cfg._privateKeyData : null
    })),
    () => { throw new Error('creds provider error'); },
    async () => {
        await Utils.sleep(10);
        throw new Error('async creds provider error');
    }
];

const badUserConfigs = badCredsProviders.map(credentialsProvider => ({
    credentialsProvider,
    _privateKeyData: credentialsProvider._privateKeyData
}));

const goodCredsProviders = [
    ...goodDirectConfigs.map(cfg => Object.assign(
        function() { return cfg; },
        { _privateKeyData : cfg._privateKeyData })),
    ...goodDirectConfigs.map(cfg => ({
        loadCredentials: () => cfg,
        _privateKeyData: cfg._privateKeyData
    })),
    ...goodDirectConfigs.map(cfg => Object.assign(
        async function() {
            await Utils.sleep(50);
            return cfg;
        },
        { _privateKeyData : cfg._privateKeyData })),
    ...goodDirectConfigs.map(cfg => ({
        loadCredentials: async () => {
            await Utils.sleep(50);
            return cfg;
        },
        _privateKeyData: cfg._privateKeyData
    }))
];

const goodUserConfigs = goodCredsProviders.map(credentialsProvider => ({
    credentialsProvider,
    _privateKeyData: credentialsProvider._privateKeyData
}));

const goodConfigs = goodDirectConfigs.concat(goodFileConfigs)
    .concat(goodUserConfigs);

badDirectConfigs.push(...badRefreshConfigs.map(cfg =>
    Object.assign({}, goodDirectConfigs[0], cfg)));
badFileConfigs.push(...badRefreshConfigs.map(cfg =>
    Object.assign({}, goodFileConfigs[0], cfg)));
badUserConfigs.push(...badRefreshConfigs.map(cfg =>
    Object.assign({}, goodUserConfigs[0], cfg)));

module.exports = {
    TEST_DIR,
    PRIVATE_KEY_FILE,
    creds,
    badDirectConfigsCons,
    badDirectConfigs,
    goodDirectConfigs,
    credsLines,
    credsLinesEncKey,
    badFileConfigs,
    goodFileConfigs,
    badUserConfigs,
    goodUserConfigs,
    goodConfigs,
    keys,
    badPrivateKeyPEMs
};
