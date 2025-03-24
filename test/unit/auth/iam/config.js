/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const path = require('path');

const badStrings = require('../../common').badStrings;
const badStringsOrFunctions = require('../../common').badStringsOrFunctions;
const badStringsOrBinaries = require('../../common').badStringsOrBinaries;
const badFilePaths = require('../../common').badFilePaths;
const badPosInt32NotNull = require('../../common').badPosInt32NotNull;
const badMillisWithOverride = require('../../common').badMillisWithOverride;
const Utils = require('../../utils');
const IAMAuthorizationProvider =
    require('../../../../lib/auth/iam/auth_provider');
const DELEGATION_TOKEN = require('./constants').DELEGATION_TOKEN;
const DELEGATION_TOKEN_FILE = require('./constants').DELEGATION_TOKEN_FILE;
const TENANT_ID = require('./constants').TENANT_ID;
const USER_ID = require('./constants').USER_ID;
const FINGERPRINT = require('./constants').FINGERPRINT;
const PASSPHRASE = require('./constants').PASSPHRASE;
const PRIVATE_KEY_FILE = require('./constants').PRIVATE_KEY_FILE;
const OCI_CONFIG_FILE = require('./constants').OCI_CONFIG_FILE;
const SESSION_TOKEN_FILE = require('./constants').SESSION_TOKEN_FILE;
const SESSION_TOKEN = require('./constants').SESSION_TOKEN;
const createKeys = require('./utils').createKeys;

const keys = createKeys();

const badOCIDs = badStrings.concat(undefined, null, 'abcde');
const badFingerprints = badStrings.concat(undefined, null);

const badPrivateKeyPEMs = [
    '', '.....',
    path.resolve('nosuchfile'), //used for resource principal
    keys.privatePEM.slice(1, -1), //corrupted PEM key
    keys.privateKey.export({ type: 'pkcs8', format: 'der'}) //wrong format
];

const badPKData = badStringsOrBinaries.concat(undefined, null,
    badPrivateKeyPEMs, Buffer.from('"""'));

const keyIdObj = {
    tenantId: TENANT_ID,
    userId: USER_ID,
    fingerprint: FINGERPRINT
};

const creds = Object.assign({}, keyIdObj, {
    publicKey: keys.publicKey
});

const sessTokenCreds = {
    token: SESSION_TOKEN,
    publicKey: keys.publicKey
};

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

// These are only to construct bad exclusive configs.
const userCredsProps = {
    ...keyIdObj,
    privateKey : keys.privatePEM,
    privateKeyFile: PRIVATE_KEY_FILE,
    passphrase: PASSPHRASE
};

const ociConfigProps = {
    configFile: OCI_CONFIG_FILE,
    profileName: 'DEFAULT'
};

const credsProviderProps = {
    credentialsProvider: async () => ({
        ...keyIdObj,
        privateKeyFile: PRIVATE_KEY_FILE,
    })
};

const ipExtras = {
    federationEndpoint: 'https://auth.ap-tokyo-1.oraclecloud.com',
    delegationToken: DELEGATION_TOKEN,
    delegationTokenProvider: async() => DELEGATION_TOKEN,
    delegationTokenFile: DELEGATION_TOKEN_FILE,
};

const rpExtras = {
    useResourcePrincipalCompartment: true
};

//Configs that have multiple properties that cannot be used together.
const badExclPropsConfigsCons = [
    {
        useResourcePrincipal: true,
        useInstancePrincipal: true
    },
    {
        useResourcePrincipal: true,
        useSessionToken: true
    },
    ...Object.entries({
        ...userCredsProps,
        ...ociConfigProps,
        ...credsProviderProps
    }).map(ent => ({
        useResourcePrincipal: true,
        [ent[0]]: ent[1]
    })),
    {
        useInstancePrincipal: true,
        useSessionToken: true
    },
    ...Object.entries({
        ...userCredsProps,
        ...ociConfigProps,
        ...credsProviderProps
    }).map(ent => ({
        useInstancePrincipal: true,
        [ent[0]]: ent[1]
    })),
    ...Object.entries({
        ...userCredsProps,
        ...credsProviderProps
    }).map(ent => ({
        useSessionToken: true,
        [ent[0]]: ent[1]
    })),
    ...Object.entries({
        ...ociConfigProps,
        ...credsProviderProps
    }).map(ent => ({
        ...keyIdObj,
        privateKeyFile: PRIVATE_KEY_FILE,
        passphrase: PASSPHRASE,
        [ent[0]]: ent[1]
    })),
    ...Object.entries({
        ...userCredsProps,
        ...ociConfigProps
    }).map(ent => ({
        ...credsProviderProps,
        [ent[0]]: ent[1]
    })),
    ...Object.entries({
        ...userCredsProps,
        ...credsProviderProps
    }).map(ent => ({
        ...ociConfigProps,
        [ent[0]]: ent[1]
    })),
    //Instance principal extra properties without useInstancePrincipal set.
    ...Object.entries(ipExtras).map(ent => ({
        ...keyIdObj,
        privateKeyFile: PRIVATE_KEY_FILE,
        [ent[0]]: ent[1]
    })),
    //Resource principal extra properties without useResourcePrincipal set.
    ...Object.entries(rpExtras).map(ent => ({
        useInstancePrincipal: true,
        [ent[0]]: ent[1]
    }))
];

//direct configs

//configs that should throw in the constructor of IAMAuthorizationProvider
//for inclusion in ../config.js test, not all included for simplicity
//(some are still part of badDirectConfigs)
const badDirectConfigsCons = [
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
    })),
    {
        //missing tenantId
        userId: USER_ID,
        fingerprint: FINGERPRINT,
        privateKey: keys.privatePEM
    },
    {
        //missing userId
        tenantId: TENANT_ID,
        fingerprint: FINGERPRINT,
        privateKey: keys.privatePEM
    },
    {
        //missing fingerprint
        tenantId: TENANT_ID,
        userId: USER_ID,
        privateKey: keys.privatePEM
    },
    {
        //missing privateKey and privateKeyFile
        tenantId: TENANT_ID,
        userId: USER_ID,
        fingerprint: FINGERPRINT
    }
];

const badConfigsCons = badDirectConfigsCons.concat(badExclPropsConfigsCons);

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
        privateKeyFile: Buffer.from(PRIVATE_KEY_FILE),
        _privateKeyData: keys.privatePEM
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

const credsLinesSessToken = [
    'tenancy=' + creds.tenantId,
    'security_token_file=' + SESSION_TOKEN_FILE,
    'key_file=' + PRIVATE_KEY_FILE
];

const credsLinesEncKey = credsLines.concat('pass_phrase=' + PASSPHRASE);
const credsLinesEncKeySessToken = credsLinesSessToken.concat(
    'pass_phrase=' + PASSPHRASE);

const defaultOCIFileLines = [ '# comment', '[DEFAULT]', ...credsLines ];

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
    },
    //missing one of the required properties in the profile
    ...Utils.range(credsLines.length).map(idx => ({
        data: [ '[DEFAULT]', ...credsLines.toSpliced(idx, 1)]
    })),
    //same as above for session token auth
    ...Utils.range(credsLinesSessToken.length).map(idx => ({
        data: [ '[DEFAULT]', ...credsLinesSessToken.toSpliced(idx, 1) ],
        useSessToken: true
    })),
    {
        //invalid tenant id
        data: [ '[DEFAULT]', ...credsLines.toSpliced(0, 1,
            'tenancy=nosuchtenant') ]
    },
    {
        //invalid user id
        data: [ '[DEFAULT]', ...credsLines.toSpliced(1, 1,
            'user=nosuchuser') ]
    },
    {
        //empty fingerprint
        data: [ '[DEFAULT]', ...credsLines.toSpliced(2, 1,
            'fingerprint=') ]
    },
    //bad private key data
    ...badPrivateKeyPEMs.map(pem => ({
        data: [ '[DEFAULT]', ...credsLines ],
        pkData: pem
    })),
    //same for session token auth
    ...badPrivateKeyPEMs.map(pem => ({
        data: [ '[DEFAULT]', ...credsLinesSessToken ],
        pkData: pem,
        useSessToken: true
    })),
    {
        //invalid session token file
        data: [ 'test_profile', ...credsLinesSessToken.toSpliced(1, 1,
            'security_token_file=nosuchfile') ],
        profile: 'test_profile',
        useSessToken: true
    },
    {
        //invalid tenant id for session token auth
        data: [ '[DEFAULT]', ...credsLinesSessToken.toSpliced(0, 1,
            'tenancy=nosuchtenant') ],
        useSessToken: true
    },
    {
        data: [ '[DEFAULT]', ...credsLinesSessToken ],
        useSessToken: true,
        //empty session token
        sessToken: ''
    }
];

const goodOCIConfigs = [
    {
        data: [ '[DEFAULT]', ...credsLines ],
        useDefaultOCIFile: true
    },
    {
        data: [ '[DEFAULT]', ...credsLinesEncKey ],
        useDefaultOCIFile: true,
        noArgsCons: true,
        pkData: keys.privateEncPEM
    },
    {
        data: [ '[test_profile]', ...credsLines, '# comment comment' ],
        useDefaultOCIFile: true,
        profile: 'test_profile'
    },
    {
        data: [ '[test_profile]', ...credsLines, '# comment comment' ],
        profile: 'test_profile'
    },
    {
        data: [ '[DEFAULT]', '', ...credsLinesEncKey, '', '', '\n' ],
        pkData: keys.privateEncPEM
    },
    {
        data: [ '[sample1]', 'property 1 = 2', '[DEFAULT]', ...credsLines,
            `       fingerprint     = ${creds.fingerprint}      ` ]
    },
    {
        data: [].concat(...Utils.range(100).map(i => [ `[profile${i}]`,
            ...credsLinesEncKey ])),
        profile: 'profile70'
    },
    {
        data: [ '[DEFAULT]', ...credsLinesSessToken ],
        useSessToken: true
    },
    {
        data: [ '[DEFAULT]', ...credsLinesSessToken ],
        useSessToken: true,
        createFunc: () => IAMAuthorizationProvider.withSessionToken(
            OCI_CONFIG_FILE, 'DEFAULT')
    },
    {
        data: [ '[test_profile]', ...credsLinesSessToken,
            //extra properties not needed for sess token auth
            'user=' + creds.userId, 'fingerprint=' + creds.fingerprint ],
        profile: 'test_profile',
        useSessToken: true
    },
    {
        data: [ '[DEFAULT]', ...credsLinesEncKeySessToken ],
        pkData: keys.privateEncPEM,
        useSessToken: true
    },
    {
        data: [ '[DEFAULT]', ...credsLinesEncKeySessToken ],
        pkData: keys.privateEncPEM,
        useSessToken: true,
        useDefaultOCIFile: true,
        createFunc: () => IAMAuthorizationProvider.withSessionToken()
    },
    {
        data: [ '[test_profile]', ...credsLinesSessToken ],
        profile: 'test_profile',
        useSessToken: true,
        useDefaultOCIFile: true,
        createFunc: () => IAMAuthorizationProvider.withSessionToken(
            'test_profile')
    },
];

const badFileConfigs = [
    ...badFilePaths.map(configFile => ({ configFile })),
    ...badStrings.concat(undefined, null).map(profileName => ({
        configFile: OCI_CONFIG_FILE,
        profileName
    })),
    ...badOCIConfigs.map(cfg => ({
        _useDefaultOCIFile: cfg.useDefaultOCIFile,
        configFile: cfg.useDefaultOCIFile ? undefined : OCI_CONFIG_FILE,
        profileName: cfg.profile != null ? cfg.profile : undefined,
        useSessionToken: cfg.useSessToken,
        _ociConfigData: cfg.data.join('\n'),
        _privateKeyData: cfg.pkData != null ? cfg.pkData : keys.privatePEM,
        _sessTokenData: cfg.sessToken,
        _createFunc: cfg.createFunc
    }))
];

const goodFileConfigs = goodOCIConfigs.map(cfg => Object.assign({
    _useDefaultOCIFile: cfg.useDefaultOCIFile,
    _ociConfigData: cfg.data.join('\n'),
    _privateKeyData: cfg.pkData != null ? cfg.pkData : keys.privatePEM,
    _sessTokenData: cfg.sessToken,
    _createFunc: cfg.createFunc,
    _noArgsCons: cfg.noArgsCons
},
cfg.useDefaultOCIFile ? {} : { configFile: OCI_CONFIG_FILE },
cfg.profile != null ? { profileName: cfg.profile } : {},
cfg.useSessToken ? { useSessionToken: true } : {}));

//user-defined credentials provider configs

//Note that we have to pass _privateKeyData if any to the configuration in
//order to prepare testcase.

const badCredsProviders = [
    ...badStringsOrFunctions,
    undefined,
    null,
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
    _privateKeyData: credentialsProvider != null ?
        credentialsProvider._privateKeyData : null
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
    PRIVATE_KEY_FILE,
    creds,
    sessTokenCreds,
    badConfigsCons,
    badDirectConfigs,
    badExclPropsConfigsCons,
    goodDirectConfigs,
    credsLines,
    credsLinesEncKey,
    defaultOCIFileLines,
    badFileConfigs,
    goodFileConfigs,
    badUserConfigs,
    goodUserConfigs,
    goodConfigs,
    keys,
    badPrivateKeyPEMs
};
