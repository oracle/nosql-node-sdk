/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const URL = require('url').URL;
const expect = require('chai').expect;
const Region = require('../../index').Region;
const Utils = require('./utils');

if (!Object.fromEntries) {
    Object.fromEntries = ents =>
        Object.assign({}, ...Array.from(ents, ([k, v]) => ({[k]: v})));

}

const TABLE_NAME_PFX = 'YevTest';

const DEF_TABLE_LIMITS = {
    readUnits: 1000,
    writeUnits: 500,
    storageGB: 100
};

const enumColValues = [ 'enumVal1', 'enumVal2', 'enumVal3', 'enumVal4',
    'enumVal5'];

//Data for negative testing

const badStringsOrBinariesNoEmpty = [
    0,
    [],
    { key: '' },
    new Date()
];

const badStringsOrBinaries = [
    ...badStringsOrBinariesNoEmpty,
    '' //cannot be empty string
];

const badStringsNoEmpty = [
    ...badStringsOrBinariesNoEmpty,
    Buffer.alloc(16),
];

const badStrings = [
    ...badStringsOrBinaries,
    Buffer.alloc(16),
];

const badStringsOrFunctions = badStrings;

const badEndpoints = [
    null, //cannot be null,
    ...badStrings, //must be string or URL
    '', //cannot be empty string
    'a:x', //invalid port
    'a:0', //invalid port
    'a:/abcde', //no path allowed
    'https://a:/abcde', //no path allowed
    'https://a:443/abcde',
    'locahost/', //no / at the end allowed
    'https://a:-1', //invalid port
    'http://a:12.123', //invalid port
    'ftp://foo', //protocol must be http or https,
    new URL('ftp://a') //protocol must be http or https
];

const badURLs = [
    ...badEndpoints,
    'a' //missing protocol
];

const badNonNegInt32NotNull = [
    NaN, //must be regular number
    Infinity, //must be regular number
    '1', //must be number
    12.123, //must be integer
    -1, //must be positive
    0x80000000 //must be 32 bit signed integer
];

const badNonNegInt32 = [
    null, //cannot be null
    ...badNonNegInt32NotNull
];

const badPosInt32NotNull = [
    ...badNonNegInt32NotNull,
    0 //must be positive
];

const badPosInt32 = [
    ...badNonNegInt32,
    0 //must be positive
];

const badMillis = badPosInt32;

//For parameters that can be disabled by setting to null
const badMillisWithOverride = badPosInt32NotNull;

//anything that is not instance of Consistency
const badConsistencies = [
    undefined,
    null,
    0,
    '',
    new Date()
];

//Invalid options common to all NoSQLClient APIs
const badOptions = [
    '', //must be an object
    0, //must be an object
    {
        retry: {} //may not override retry from config
    },
    {
        auth: {} //may not override auth from config
    }
];

if (Utils.isCloud) {
    badOptions.push(...badStrings.map(compartment => ({
        compartment
    })));
}

const badTblNames = [ undefined, null, '', ...badStrings ];

//Time must be represented as Date, string (passed to Date.parse) or
//number of milliseconds
const badDateTimes = [
    {},
    [ 1 ],
    Buffer.alloc(16),
    NaN,
    Infinity,
    Number.MAX_SAFE_INTEGER, //out of range
    Number.MIN_SAFE_INTEGER, //out of range
    new Date('hahaha'), //must be valid date
    new Date('2014-01-01 12:78:01'), //must be valid date/time
    '', //string must represent valid date/time
    '2014-01-01 12:61:00' //string must represent valid date/time
];

const badBinaries = [
    '',
    false,
    0,
    [ 1, 2, 3 ],
    new Date()
];

//password must be string or Buffer
const badPasswords = [
    0,
    [],
    [ 1, 2, 3 ],
    { key: '' },
    new Date(),
    '', //cannot be empty string
    false,
    1000
];

const badDDLStatusOpts = [
    ...badOptions,
    ...badMillis.map(timeout => ({ timeout }))
];

const badDDLPollOpts = [
    ...badMillis.map(delay => ({ delay })),
    {
        timeout: 1000, //timeout cannot be < delay
        delay: 2000
    }
];

const badDDLCompleteOpts = badDDLPollOpts.map(opt =>
    Object.assign( { complete: true }, opt));

const badDDLForCompletionOpts = [
    ...badDDLStatusOpts,
    ...badDDLPollOpts
];

const badMatchVers = badBinaries;

const sampleVer = Buffer.alloc(32);

const badTTLs = [
    true,
    'aaaaa',
    -1,
    12.345,
    {},
    { days:12.5 },
    { hours: -10 },
    { days: 1, hours: 1}, //Can't specify both days and hours
    { nosuchfield: 10 }
];

//Bad options for all put operations, specific APIs will add more bad options
const badOptsBasePutNoTimeout = [
    ...badOptions,
    ...badTTLs.map(ttl => ({ ttl })),
    {
        ttl: 1,
        updateTTLToDefault: true //can't have these together
    },
    {
        ifAbsent: true,
        ifPresent: true
    },
    {
        ifAbsent: true,
        matchVersion: sampleVer
    }
];

const badOptsBasePut = [
    ...badMillis.map(timeout => ({ timeout })),
    ...badOptsBasePutNoTimeout
];

const badOptsMatchVer = badMatchVers.map(matchVersion => ({ matchVersion }));

//Bad options for "put" API
const badOptsPut = badOptsBasePut.concat(badOptsMatchVer);

//In sub-operations of writeMany, the timeout is ignored, so it is not
//considered bad option
const badOptsPutNoTimeout = badOptsBasePutNoTimeout.concat(badOptsMatchVer);

//Bad options for "delete" and "deleteIfVersion"
const badOptsBaseDelete = [
    ...badOptions,
    ...badMillis.map(timeout => ({ timeout }))
];

//Bad options for "delete".
//We provide matchVersion to delete options but not to deleteIfVersion
//options, since it will be ignored in the latter
const badOptsDelete = badOptsBaseDelete.concat(badOptsMatchVer);

//In sub-operations of writeMany, the timeout is ignored, so it is not
//considered bad option
const badOptsDeleteNoTimeout = badOptions.concat(badOptsMatchVer);

const badPlainObjects = [
    undefined,
    null,
    1,
    '',
    new Date(),
    Buffer.alloc(16)
];

//Keys that should be rejected by the driver
const badDriverKeys = [
    ...badPlainObjects,
    {
        //It's ok to specify field value as function, but it has to return
        //a real value
        id: () => function foo() {}
    }
];

//Keys that should be rejected by the server
function getBadServerKeys(tbl, key, allowPartial) {
    const badKeys = [
        {},
        {
            nosuchfield: 1
        },
        //Invalid extra field: currently disabled since currently proxy
        //allows extra fields, will reenable with next protocol version.
        //Object.assign({}, key, { nosuchfield: 'aaaaa' }),
        //invalid types for primary key
        Object.assign({}, ...tbl.primaryKey.map(v => ({ [v]: null }))),
        Object.assign({}, ...tbl.primaryKey.map(v => ({ [v]: () => {} }))),
        Object.assign({}, ...tbl.primaryKey.map(v => ({ [v]: {} }))),
        Object.assign({}, ...tbl.primaryKey.map(v => ({ [v]: [1, 2, 3] })))
    ];
    if (tbl.primaryKey.length > 1) {
        //missing primary key fields, first or last fields specified
        const k1 = tbl.primaryKey[0];
        const k2 = tbl.primaryKey[tbl.primaryKey.length - 1];
        expect(key[k1]).to.exist;
        expect(key[k2]).to.exist;
        if (!allowPartial) {
            badKeys.push({ k1: key[k1] });
        }
        badKeys.push({ k2: key[k2] });
    }
    return badKeys;
}

const badMapKeys = [
    undefined,
    null,
    0,
    [],
    { key: '' },
    Buffer.alloc(16),
    new Date()
];

//Rows that should be rejected by the driver
const badDriverRows = [
    ...badPlainObjects,
    {
        //It's ok to specify field value as function, but it has to return
        //a real value
        id: () => function foo() {}
    },
    {
        id: { id: () => function foo() {} }
    },
    ...badMapKeys.map(mapKey => ({
        mapCol: new Map([ [ mapKey, 1 ] ])
    }))
];

function getBadServerRows(tbl, row) {
    const ret =  [
        {}, //empty row
        { //row with non-existing fields
            nosuchfield1: 1,
            nosuchfield2: 'a'
        },
        //Invalid extra field: currently disabled since currently proxy
        //allows extra fields, will reenable with next protocol version.
        //Object.assign({}, row, { nosuchfield: new Date() }),
        //missing primary key field (rows start with primary key)
        Object.fromEntries(Object.entries(row).slice(1)),
        //wrong types
        Object.fromEntries(tbl.fields.map(v => [ v, null ])),
        Object.fromEntries(tbl.fields.map(v => [ v, {} ])),
        Object.fromEntries(tbl.fields.map(v => [ v, [1, 2, 3] ])),
        Object.fromEntries(tbl.fields.map((v, i) => [ v,
            Buffer.allocUnsafe(i + 8)]))
    ];
    if (tbl.idFld) {
        //Here we assume that identity column is "generated always", so
        //supplying a value for for it is an error.
        //Also assume that 1 is in allowed range for this identity column
        ret.push(Object.assign({}, row, { [tbl.idFld.name]: 1 }));
    }
    return ret;
}

const badDriverFieldRanges = [
    0,
    '',
    [],
    Buffer.alloc(16),
    {},
    { fieldName: 'id' }, //missing both bounds
    ...badStrings.map(fieldName => ({ //bad fieldName
        fieldName,
        startWith: 1
    })),
    {   //missing fieldName
        startsWith: 1,
        endsWith: 2
    },
    {
        fieldName: 'id',
        startWith: 1, //cannot specify both startWith and startAfter
        startAfter: 0
    },
    {
        fieldName: 'id',
        endWith: 10, //cannot specify both endWith and endBefore
        endBefore: 11
    },
];

//These field ranges should be rejected on the server side
function getBadServerFieldRanges(tbl) {
    const pkLast = tbl.primaryKey[tbl.primaryKey.length - 1];
    return [
        {
            fieldName: 'nosuchfield',
            startWith: 1
        },
        {
            fieldName: pkLast,
            startWith: 1, //different types for lower and upper bounds
            endWith: 'aaaaa'
        },
        {
            fieldName: pkLast,
            startAfter: [ 1 ], //unsupported types for primary key
            endBefore: [ 1, 2, 3 ]
        },
        {
            fieldName: pkLast,
            startWith: {}, //unsupported types for primary key
            endBefore: { id: 1 }
        }
    ];
}

//for compatibility re-export from common
const _id = Utils._id;
const _version = Utils._version;
const _putTime = Utils._putTime;
const _ttl = Utils._ttl;
const _originalTTL = Utils._originalTTL;

function verifyRegion(region) {
    if (typeof region === 'string') {
        region = Region.fromRegionId(region);
    }
    expect(region).to.be.an.instanceOf(Region);
    expect(region.regionId).to.be.a('string');
    expect(region.secondLevelDomain).to.be.a('string');
    expect(region.secondLevelDomain).to.contain('.');
    expect(region.name).to.equal(
        region.regionId.replace(/-/g, '_').toUpperCase());
    const endpoint = region.endpoint;
    expect(endpoint).to.equal(
        `https://nosql.${region.regionId}.oci.${region.secondLevelDomain}`);
    return endpoint;
}

function verifyEndpoint(url, endpoint, region) {
    if (region != null) {
        endpoint = verifyRegion(region);
    }
    expect(url).to.be.instanceOf(URL);
    if (endpoint instanceof URL) {
        endpoint = endpoint.href;
        if (endpoint.endsWith('/')) {
            endpoint = endpoint.slice(0, - 1);
        }
    }
    let proto;
    let host;
    let port;
    let i = endpoint.indexOf('://');
    if (i !== -1) {
        proto = endpoint.substring(0, i).toLowerCase();
        host = endpoint.substring(i + 3);
    } else {
        host = endpoint;
    }
    i = host.indexOf(':');
    if (i !== -1) {
        port = host.substring(i + 1);
        host = host.substring(0, i);
    }
    //slightly different logig than in http_client.js to cross-check
    if (!port) {
        if (!proto) {
            proto = 'https';
        }
        port = proto === 'https' ? '443' : '8080';
    } else if (!proto) {
        proto = port === '443' ? 'https' : 'http';
    }
    //URL specify default port becomes empty string
    if ((proto === 'https' && port === '443') ||
        (proto === 'http' && port === '80')) {
        port = '';
    }
    proto += ':'; //to conform to URL specification
    expect(url.protocol).to.equal(proto);
    expect(url.hostname).to.equal(host.toLowerCase());
    expect(url.port).to.equal(port);
}

let pre20_1;
let pre20_2;

const compareVersions = require('compare-versions');
const kvVer = Utils.getArgVal('--kv');
if (kvVer) {
    pre20_1 = compareVersions(kvVer, '20.1') < 0;
    pre20_2 = compareVersions(kvVer, '20.2') < 0;
}

module.exports = {
    TABLE_NAME_PFX,
    DEF_TABLE_LIMITS,
    enumColValues,
    badEndpoints,
    badURLs,
    badMillis,
    badMillisWithOverride,
    badStringsOrBinaries,
    badStringsNoEmpty,
    badStrings,
    badStringsOrFunctions,
    badNonNegInt32NotNull,
    badNonNegInt32,
    badPosInt32NotNull,
    badPosInt32,
    badConsistencies,
    badOptions,
    badTblNames,
    badDDLStatusOpts,
    badDDLPollOpts,
    badDDLCompleteOpts,
    badDDLForCompletionOpts,
    badDateTimes,
    badBinaries,
    badPasswords,
    badMatchVers,
    sampleVer,
    badTTLs,
    badOptsBasePut,
    badOptsPut,
    badOptsPutNoTimeout,
    badOptsBaseDelete,
    badOptsDeleteNoTimeout,
    badOptsDelete,
    badPlainObjects,
    badDriverKeys,
    getBadServerKeys,
    badDriverRows,
    getBadServerRows,
    badDriverFieldRanges,
    getBadServerFieldRanges,
    _id,
    _version,
    _putTime,
    _ttl,
    _originalTTL,
    verifyEndpoint,
    pre20_1,
    pre20_2
};
