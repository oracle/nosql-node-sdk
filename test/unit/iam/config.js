/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const crypto = require('crypto');
const os = require('os');
const path = require('path');
const fs = require('fs');
const badStrings = require('../common').badStrings;
const badStringsOrFunctions = require('../common').badStringsOrFunctions;
const badStringsOrBinaries = require('../common').badStringsOrBinaries;
const badPosInt32NotNull = require('../common').badPosInt32NotNull;
const badMillisWithOverride = require('../common').badMillisWithOverride;
const Utils = require('../utils');

const TENANT_ID = 'ocid1.tenancy.oc1..tenancy';
const USER_ID = 'ocid1.user.oc1..user';
const FINGERPRINT = 'fingerprint';

const keyPair = crypto.generateKeyPairSync('rsa', { modulusLength : 2048});
const privateKeyData = keyPair.privateKey.export({
    type: 'pkcs8',
    format: 'pem'
});

const PASSPHRASE = 'oracle';

const privateKeyEncData = keyPair.privateKey.export({
    type: 'pkcs8',
    format: 'pem',
    cipher: 'aes-256-cbc',
    passphrase: PASSPHRASE
});

const badOCIDs = badStrings.concat(undefined, null, 'abcde');
const badFingerprints = badStrings.concat(undefined, null);
const badPKData = badStringsOrBinaries.concat('.....', Buffer.from('"""'),
    keyPair.privateKey.export({ type: 'pkcs8', format: 'der'}));
const badFilePaths = badStringsOrBinaries.concat('nosuchfile');

const TEST_DIR = path.join(os.tmpdir(), 'oracle-nosqldb-test-iam');
const privateKeyFile = path.join(TEST_DIR, 'key_private.pem');
const privateKeyEncFile = path.join(TEST_DIR, 'key_private_enc.pem');
const badPrivateKeyFile = path.join(TEST_DIR, 'key_private.der');
const badPrivateKeyEncFile = path.join(TEST_DIR, 'key_private_enc.der');

const keyIdObj = {
    tenantId: TENANT_ID,
    userId: USER_ID,
    fingerprint: FINGERPRINT
};

const creds = Object.assign({}, keyIdObj, {
    publicKey: keyPair.publicKey,
    serviceHost: 'test'
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
        privateKey: privateKeyData
    })),
    ...badOCIDs.map(userId => ({
        tenantId: TENANT_ID,
        userId,
        fingerprint: FINGERPRINT,
        privateKey: privateKeyData
    })),
    ...badFingerprints.map(fingerprint => ({
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint,
        privateKey: privateKeyData
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
        privateKey: privateKeyEncData,
        passphrase
    })),
    ...badFilePaths.map(privateKeyFile => ({
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKeyFile
    })),
    {
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKeyFile: badPrivateKeyFile,
    },
    {
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKeyFile: badPrivateKeyEncFile,
        passphrase: PASSPHRASE
    }
];

const goodDirectConfigs = [
    Object.assign({}, keyIdObj, {
        privateKey : privateKeyData
    }),
    Object.assign({}, keyIdObj, {
        privateKey : Buffer.from(privateKeyData)
    }),
    Object.assign({}, keyIdObj, {
        privateKey: privateKeyEncData,
        passphrase: PASSPHRASE
    }),
    Object.assign({}, keyIdObj, {
        privateKey: Buffer.from(privateKeyEncData),
        passphrase: Buffer.from(PASSPHRASE)
    }),
    Object.assign({}, keyIdObj, {
        privateKeyFile
    }),
    Object.assign({}, keyIdObj, {
        privateKeyFile: Buffer.from(privateKeyFile)
    }),
    Object.assign({}, keyIdObj, {
        privateKeyFile: privateKeyEncFile,
        passphrase: PASSPHRASE
    }),
    Object.assign({
        configFile: 'nosuchfile', //should be ignored
        privateKey: privateKeyData
    }, keyIdObj),
    Object.assign({
        profileName: 'nosuchprofile', //should be ignored
        privateKey: privateKeyData
    }, keyIdObj),
    Object.assign({
        credentialsProvider: 'nosuchprovider', //should be ignored
        privateKey: privateKeyData
    }, keyIdObj),
];

//OCI config file configs

const credsLines = [
    'tenancy=' + creds.tenantId,
    'user=' + creds.userId,
    'fingerprint=' + creds.fingerprint,
    'key_file=' + privateKeyFile
];

const credsLinesEncKey = [
    'tenancy=' + creds.tenantId,
    'user=' + creds.userId,
    'fingerprint=' + creds.fingerprint,
    'key_file=' + privateKeyEncFile,
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
        profile: 'John'
    },
    {
        //missing passphrase for encrypted key
        data: [ '[DEFAULT]', ...credsLinesEncKey.slice(0, -1), '' ]
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
        configFile: path.join(TEST_DIR, 'good_config0'),
        profileName
    })),
    ...Utils.range(0, badOCIConfigs.length).map(i => ({
        configFile: path.join(TEST_DIR, 'bad_config' + i),
        profileName: badOCIConfigs[i].profile ? badOCIConfigs[i].profile :
            undefined
    }))
];

const goodFileConfigs = Utils.range(0, goodOCIConfigs.length).map(i => ({
    configFile: path.join(TEST_DIR, 'good_config' + i),
    profileName: goodOCIConfigs[i].profile ? goodOCIConfigs[i].profile :
        undefined
}));


//user-defined credentials provider configs

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
        loadCredentials: async () => cfg
    })),
    () => { throw new Error('creds provider error'); },
    async () => {
        await Utils.sleep(10);
        throw new Error('async creds provider error');
    }
];

const badUserConfigs = badCredsProviders.map(credentialsProvider => ({
    credentialsProvider
}));

const goodCredsProviders = [
    ...goodDirectConfigs.map(cfg => function() { return cfg; }),
    ...goodDirectConfigs.map(cfg => ({
        loadCredentials: () => cfg
    })),
    ...goodDirectConfigs.map(cfg => async function() {
        await Utils.sleep(50);
        return cfg;
    }),
    ...goodDirectConfigs.map(cfg => ({
        loadCredentials: async () => {
            await Utils.sleep(50);
            return cfg;
        }
    }))
];

const goodUserConfigs = [
    ...goodCredsProviders.map(credentialsProvider => ({
        credentialsProvider
    })),
    {
        //should be ignored in presence of credentialsProvider
        profileName: 'nosuchprofile',
        credentialsProvider: goodCredsProviders[0]
    },
    {
        //should be ignored in presence of credentialsProvider
        configFile: 'nosuchfile',
        tenantId: 'blahblah',
        credentialsProvider: goodCredsProviders[0]
    }
];

const goodConfigs = goodDirectConfigs.concat(goodFileConfigs)
    .concat(goodUserConfigs);

badDirectConfigs.push(...badRefreshConfigs.map(cfg =>
    Object.assign({}, goodDirectConfigs[0], cfg)));
badFileConfigs.push(...badRefreshConfigs.map(cfg =>
    Object.assign({}, goodFileConfigs[0], cfg)));
badUserConfigs.push(...badRefreshConfigs.map(cfg =>
    Object.assign({}, goodUserConfigs[0], cfg)));

function writeFileLines(path, lines) {
    fs.writeFileSync(path, lines.join('\n'));
}

function makeTestFiles() {
    removeTestFiles();
    fs.mkdirSync(TEST_DIR);
    fs.writeFileSync(privateKeyFile, privateKeyData);
    fs.writeFileSync(privateKeyEncFile, privateKeyEncData);
    fs.writeFileSync(badPrivateKeyFile, keyPair.privateKey.export({
        type: 'pkcs8',
        format: 'der'
    }));
    fs.writeFileSync(badPrivateKeyEncFile, keyPair.privateKey.export({
        type: 'pkcs8',
        format: 'der',
        cipher: 'aes-256-cbc',
        passphrase: PASSPHRASE
    }));

    for(let i = 0; i < badOCIConfigs.length; i++) {
        writeFileLines(path.join(TEST_DIR, 'bad_config' + i),
            badOCIConfigs[i].data);
    }
    for(let i = 0; i < badOCIConfigs.length; i++) {
        writeFileLines(path.join(TEST_DIR, 'good_config' + i),
            goodOCIConfigs[i].data);
    }
}

function removeTestFiles() {
    Utils.rimrafSync(TEST_DIR);
}

module.exports = {
    TEST_DIR,
    creds,
    badDirectConfigsCons,
    badDirectConfigs,
    goodDirectConfigs,
    badFileConfigs,
    goodFileConfigs,
    badUserConfigs,
    goodUserConfigs,
    goodConfigs,
    makeTestFiles,
    removeTestFiles,
    privateKeyFile,
    privateKeyEncFile,
    PASSPHRASE
};
