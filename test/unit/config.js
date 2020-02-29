/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const util = require('util');
const expect = require('chai').expect;
const NoSQLClient = require('../../index').NoSQLClient;
const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const ServiceType = require('../../index').ServiceType;
const Utils = require('./utils');

//Data for negative testing

const badStrings = require('./common').badStrings;
const badStringsOrFunctions = require('./common').badStringsOrFunctions;
const badEndpoints = require('./common').badEndpoints;
const badNonNegInt32 = require('./common').badNonNegInt32;
const badPosInt32 = require('./common').badPosInt32;
const badMillis = require('./common').badMillis;
const badMillisWithOverride = require('./common').badMillisWithOverride;
const badConsistencies = require('./common').badConsistencies;
const badPasswords = require('./common').badPasswords;

const badRetryHandlers = [
    0, //must be object
    'a', //must be object
    {
        doRetry: () => true //missing delay function
    },
    {
        delay: () => 1000 //missing doRetry function
    },
    {
        doRetry: 1, //doRetry must be boolean or function
        delay: () => 1000
    },
    {
        doRetry: () => true,
        delay: true //delay must be number or function
    },
    ...badMillis.map(delay => ({
        doRetry: () => true,
        delay //if number, must be valid millisecond value
    }))
];

const badRetryConfigs = [
    0, //must be object
    'a', //must be object
    ...badRetryHandlers.map(handler => ({
        handler,
        maxRetries: 5
    })),
    ...badPosInt32.map(maxRetries => ({
        maxRetries
    })),
    ...badMillis.map(baseDelay => ({
        baseDelay
    })),
    ...badMillisWithOverride.map(controlOpBaseDelay => ({
        controlOpBaseDelay
    })),
    ...badMillis.map(secInfoBaseDelay => ({
        secInfoBaseDelay
    })),
    ...badNonNegInt32.map(secInfoNumBackoff => ({
        secInfoNumBackoff
    }))
];

//bad (KVStoreCredentialsProvider or string representing credentials file)
//null or undefined are ok (using default credentials file)
const badCredsProviders = [
    ...badStringsOrFunctions,
    0,
    1,  //must be string, function or object
    {}, //missing loadCredentials
    {
        loadCredentails: () => {} //loadCredentials wrong spelling
    },
    {
        loadCredentials: null //loadCredentials must be function
    },
    {
        loadCredentials: 'abcde', //loadCredentials must be function
    }
];

//only configs that will throw in the constructor of IAMAuthorizationProvider
const badIAMConfigs = require('./iam/config').badDirectConfigsCons;

const badKVStoreAuthConfigs = [
    0, //must be object
    'abc', //must be object
    function() { return ''; }, //must be object
    { user: 'John' }, //missing password
    { password: '12345' }, //missing user
    { //cannot specify credentials together with user or password
        user: 'John',
        password: '12345',
        credentials: () => {}
    },
    { //cannot specify credentials together with user or password
        user: 'John',
        credentials: () => {}
    },
    { //cannot specify credentials together with user or password
        password: '12345',
        credentials: () => {}
    },
    ...badStrings.map(user => ({
        user,
        password: '123'
    })),
    ...badPasswords.map(password => ({
        user: 'Jack',
        password
    })),
    ...badMillis.map(timeout => ({
        credentials: 'mycreds.json',
        timeout
    })),
    ...badCredsProviders.map(credentials => ({
        credentials
    }))
];

const badAuthProviders = [
    'a', //must be function or object
    0,  //must be function or object
    {}, //missing getAuthorization
    {
        getAuthorization: null //getAuthorization must be function
    },
    {
        getAuthorization: 'abcde', //getAuthorization must be function
    }
];

const badAuthConfigs = [
    1, //must be string or object
    function() { return ''; }, //must be string or object
    ...badIAMConfigs.map(iam => ({ iam })),
    ...badKVStoreAuthConfigs.map(kvstore => ({ kvstore })),
    ...badAuthProviders.map(provider => ({ provider }))
];

const badServiceTypes = [
    ...badStrings, //not a string or instance of ServiceType
    'INVALID' //such service type doesn't exist
];

const badRegions = [
    ...badStrings, //will contain non-string values
    'NO_SUCH_REGION' //invalid region name
];

const badConfigs = [
    undefined,
    null,
    '/path/to/non-existent/file.json',
    1, //must be object
    Buffer.alloc(16), //must be object, url must be present
    {}, //endpoint must be present
    ...badServiceTypes.map(serviceType => ({
        endpoint: 'http://localhost:8080',
        serviceType
    })),
    ...badEndpoints.map(endpoint => ({
        endpoint //invalid endpoint
    })),
    ...badRegions.map(region => ({
        region //invalid region
    })),
    ...badMillis.map(timeout => ({
        endpoint: 'http://localhost:8080',
        timeout //invalid timeout
    })),
    ...badMillis.map(ddlTimeout => ({
        endpoint: 'http://localhost:8080',
        timeout: 8000,
        ddlTimeout //invalid ddlTimeout
    })),
    ...badMillis.map(securityInfoTimeout => ({
        endpoint: 'http://localhost:8080',
        ddlTimeout: 8000,
        securityInfoTimeout //invalid securityInfoTimeout
    })),
    ...badMillis.map(tablePollTimeout => ({
        endpoint: 'http://localhost:8080',
        ddlTimeout: 8000,
        securityInfoTimeout: 10000,
        tablePollTimeout //invalid tablePollTimeout
    })),
    ...badMillis.map(tablePollDelay => ({
        endpoint: 'http://localhost:8080',
        ddlTimeout: 8000,
        securityInfoTimeout: 10000,
        tablePollDelay //invalid tablePollDelay
    })),
    {
        endpoint: 'http://localhost:8080',
        tablePollTimeout: 10000,
        tablePollDelay: 10001 //tablePollDelay must be <= tablePollTimeout
    },
    ...badConsistencies.map(consistency => ({
        endpoint: 'http://localhost:8080',
        consistency
    })),
    ...badRetryConfigs.map(retry => ({
        endpoint: 'http://localhost:8080',
        retry //invalid retry config
    })),
    ...badAuthConfigs.map(auth => ({
        endpoint: 'https://nosql.us-phoenix-1.oci.oraclecloud.com',
        auth //invalid auth config
    })),
    ...['localhost:8080', 'http://myhost:8888'].map(endpoint => ({
        endpoint, //non-https endpoints with secure kvstore
        auth: {
            kvstore: {
                user: 'John',
                password: '123'
            }
        }
    })),
    { //both iam and kvstore present without specifying serviceType
        endpoint: 'https://localhost:443',
        auth: {
            iam: {
                profileName: 'John'
            },
            kvstore: {
                credentials: 'mycreds.json'
            }
        }
    },
    {   //Service type CLOUD, iam info not present, auth=null
        endpoint: 'nosql.us-phoenix-1.oci.oraclecloud.com',
        serviceType: ServiceType.CLOUD,
        auth: null
    },
    {   //Service type CLOUD, auth.iam is null
        endpoint: 'nosql.us-phoenix-1.oci.oraclecloud.com',
        serviceType: ServiceType.CLOUD,
        auth: {
            iam: null
        }
    }
];

//Functions for positive tests

const URL = require('url').URL;
const Region = require('../../lib/region');
const defCfg = require('../../lib/config').defaults;
const Consistency = require('../../lib/constants').Consistency;
const IAMAuthorizationProvider = require('../../lib/auth/iam/auth_provider');
const KVStoreAuthorizationProvider = require(
    '../../lib/auth/kvstore/auth_provider');

function verifyProps(cfg, req, def, props) {
    expect(cfg).to.exist;
    if (!req) {
        req = {};
    }
    for(let prop of props) {
        expect(cfg[prop]).to.equal(prop in req ? req[prop] : def[prop]);
    }
}

function getServiceType(cfg) {
    if (cfg.serviceType instanceof ServiceType) {
        return cfg.serviceType;
    }
    if (typeof cfg.serviceType === 'string') {
        const svType = ServiceType[cfg.serviceType.toUpperCase()];
        expect(svType).to.exist; //test self-check
        return svType;
    }
    expect(cfg.serviceType).to.not.exist; //test self-check
    if (cfg.auth == null) {
        return cfg.region != null ? ServiceType.CLOUD : ServiceType.CLOUDSIM;
    }
    if (cfg.auth.iam != null) {
        expect(cfg.auth.kvstore).to.not.exist; //test self-check
        return ServiceType.CLOUD;
    }
    if (cfg.auth.kvstore != null) {
        return ServiceType.KVSTORE;
    }
    return ServiceType.CLOUDSIM;
}

function verifyIAM(cfg, reqCfg) {
    expect(cfg.auth.provider).to.be.instanceof(IAMAuthorizationProvider);
    expect(cfg.auth.iam).to.be.an('object');
    verifyProps(cfg.auth.iam, reqCfg.auth.iam, defCfg.auth.iam, [
        'timeout', 'refreshAheadMs']);
}

function verifyKVStoreAuth(cfg, reqCfg) {
    expect(cfg.auth.kvstore).to.be.an('object');
    if (reqCfg.auth.kvstore) {
        verifyProps(cfg.auth.kvstore, reqCfg.auth.kvstore,
            defCfg.auth.kvstore, [ 'timeout' ]);
        if (reqCfg.auth.kvstore.user || reqCfg.auth.kvstore.credentials) {
            expect(cfg.auth.provider).to.be.instanceof(
                KVStoreAuthorizationProvider);
            if (reqCfg.auth.kvstore.credentials) {
                expect(cfg.auth.provider.credentialsProvider).to.be.an(
                    'object');
                expect(cfg.auth.provider.credentialsProvider.loadCredentials)
                    .to.be.a('function');
            }
        }
    }
}

//Verify resulting configuration in NoSQLClient instance (cfg) against
//requested (and valid) configuration provided to NoSQLClient constructor
//(reqCfg)
function verifyConfig(cfg, reqCfg) {
    verifyProps(cfg, reqCfg, defCfg, [ 'timeout', 'ddlTimeout',
        'securityInfoTimeout', 'tablePollTimeout', 'tablePollDelay',
        'consistency' ]);
    expect(cfg.retry).to.be.an('object');
    expect(cfg.retry.handler).to.be.an('object');
    expect(cfg.retry.handler.doRetry).to.be.a('function');
    //Check the following properties if we didn't overrride retry handler
    if (!('retry' in reqCfg) || (reqCfg.retry && !('handler' in
        reqCfg.retry))) {
        verifyProps(cfg.retry, reqCfg.retry, defCfg.retry, [ 'maxRetries',
            'baseDelay', 'controlOpBaseDelay', 'secInfoBaseDelay',
            'secInfoNumBackoff' ]);
        verifyProps(cfg.retry.handler, 'retry' in reqCfg ?
            reqCfg.retry.handler : null, defCfg.retry.handler, [ 'doRetry',
            'delay' ]);
    }
    expect(cfg.serviceType).to.equal(getServiceType(reqCfg));
    expect(cfg.auth).to.be.an('object');
    expect(cfg.auth.provider).to.be.an('object');
    expect(cfg.auth.provider.getAuthorization).to.be.a('function');
    //Check the following properties if we didn't override auth provider
    //Auth itself must be set (may also be null) in valid configuration
    if (reqCfg.auth && !('provider' in reqCfg.auth)) {
        if (cfg.serviceType === ServiceType.CLOUD) {
            verifyIAM(cfg, reqCfg);
        } else if (cfg.serviceType === ServiceType.KVSTORE) {
            verifyKVStoreAuth(cfg, reqCfg);
        }
    }
}

//To test that any changes to the provided config object after NoSQLClient
//instance is created should not affect that instance.
function eraseConfig(cfg) {
    if (!cfg) {
        return;
    }
    for(let [key, val] of Object.entries(cfg)) {
        if (val != null && typeof val === 'object' &&
            Object.getPrototypeOf(val) === Object.prototype) {
            eraseConfig(val);
        }
        cfg[key] = '_erased_';
    }
}

function verifyRegion(region) {
    if (typeof region === 'string') {
        region = Region._fromRegionId(region);
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

//Data for positive tests

const goodEndpoints = [
    'localhost:8080',
    'http://localhost',
    'https://hostname',
    'hostname:80',
    'hostname',
    'hostname:443',
    'http://localhost:8080',
    'http://localhost:80',
    'https://hostname:443',
    'https://hostname:8181',
    'HTTP://localhost',
    'hTTps://hostname:8181',
    'HtTpS://hostname'
];

const goodIAMConfigs = require('./iam/config').goodConfigs;

const goodKVStoreCreds = [
    'mycredentials.json',
    () => {}, //loadCredentials function
    {
        async loadCredentials() {}
    }
];

const goodConfigs = [
    ...goodEndpoints.map(endpoint => ({
        endpoint
    })),
    ...goodEndpoints.filter(v => v.includes('://')).map(ep => ({
        endpoint: new URL(ep)
    })),
    ...Region.values.map(region => ({
        region
    })),
    ...Region.values.map(region => ({
        region: region.regionId
    })),
    ...Region.names.map(region => ({
        region
    })),
    {
        endpoint: 'http://localhost:8080',
        timeout: 20000,
        securityInfoTimeout: 40000,
        retry: {
            baseDelay: 20000
        },
        auth: null
    },
    {
        endpoint: 'localhost:8080',
        ddlTimeout: 5000,
        tablePollDelay: 500,
        consistency: Consistency.ABSOLUTE,
        auth: null
    },
    {
        endpoint: 'http://localhost:8080',
        tablePollTimeout: 30000,
        retry: {
            maxRetries: 5,
            controlOpBaseDelay: 120000,
            handler: {
                doRetry: true,
                delay: (req) => {
                    return req.api === NoSQLClient.prototype.tableDDL ?
                        10000: 5000;
                }
            }
        },
        auth: null
    },
    {
        endpoint: 'localhost:8080',
        retry: {
            secInfoBaseDelay: 1000,
            secInfoNumBackoff: 100,
            handler: {
                doRetry: (req, numRetries) => numRetries < 5,
                delay: 3000
            }
        },
        auth: null
    },
    {
        endpoint: 'localhost:8080',
        retry: null,
        auth: null
    },
    //deepCopy() so that eraseConfig() does not affect original iam configs
    //imported from different module (and because some are reused here)
    ...goodIAMConfigs.map(iam => ({
        endpoint: 'nosql.us-phoenix-1.oci.oraclecloud.com',
        auth: { iam: Utils.deepCopy(iam) }
    })),
    {
        endpoint: 'https://nosql.us-phoenix-1.oci.oraclecloud.com',
        auth: {
            iam: Utils.deepCopy(goodIAMConfigs[0])
        }
    },
    { //specify serivce type for the cloud
        serviceType: 'CloUd', //should be case-insensitive
        endpoint: 'https://nosql.us-phoenix-1.oci.oraclecloud.com',
        auth: {
            iam: Utils.deepCopy(goodIAMConfigs[1])
        }
    },
    {
        //specify different HTTPS service port
        endpoint: 'https://nosql.us-phoenix-1.oci.oraclecloud.com:8181',
        auth: {
            iam: Utils.deepCopy(goodIAMConfigs[2])
        }
    },
    {   //Service type CLOUD, iam info not present
        //(using default OCI config file)
        endpoint: 'nosql.us-phoenix-1.oci.oraclecloud.com',
        serviceType: ServiceType.CLOUD
    },
    {   //Service type CLOUD, auth.iam not present
        //(using default OCI config file)
        endpoint: 'nosql.us-phoenix-1.oci.oraclecloud.com',
        serviceType: ServiceType.CLOUD,
        auth: {
            kvstore: { credentials: 'blahblah' }
        }
    },
    {   //Service type CLOUD, auth.iam is empty
        //(using default OCI config file)
        endpoint: 'nosql.us-phoenix-1.oci.oraclecloud.com',
        serviceType: ServiceType.CLOUD,
        auth: {
            kvstore: { credentials: 'blahblah' },
            iam: {}
        }
    },
    {   //auth.iam is empty, serviceType should default to CLOUD
        //(and using default OCI config file)
        endpoint: 'nosql.us-phoenix-1.oci.oraclecloud.com',
        auth: {
            iam: {}
        }
    },
    { //non-secure kvstore
        serviceType: ServiceType.KVSTORE,
        endpoint: 'localhost:8080'
    },
    { //non-secure kvstore
        serviceType: ServiceType.KVSTORE,
        endpoint: 'localhost:8080',
        auth: null
    },
    { //non-secure kvstore
        serviceType: ServiceType.KVSTORE,
        endpoint: 'localhost:8080',
        auth: {
            kvstore: {}
        }
    },
    { //non-secure kvstore w/o service type
        endpoint: 'localhost:8080',
        auth: {
            kvstore: {}
        }
    },
    { //secure kvstore
        serviceType: ServiceType.KVSTORE,
        endpoint: 'localhost:443', //should default to https for port 443
        auth: {
            kvstore: {
                user: 'John',
                password: '123'
            }
        }
    },
    { //secure kvstore w/o service type
        endpoint: 'https://localhost:8181',
        auth: {
            kvstore: {
                user: 'John',
                password: '123'
            }
        }
    },
    ...goodKVStoreCreds.map(credentials => ({ //valid credentials for kvstore
        serviceType: ServiceType.KVSTORE,
        endpoint: 'https://localhost:8181',
        auth: {
            kvstore: { credentials }
        }
    }))
];

//Negative tests

//When there are too many testcases, having seqNo helps to keep track of 
//them and debug failed testcases.

describe('Negative config tests', function() {
    let testId = 0;
    for(let badConfig of badConfigs) {
        it(`Testing invalid config (id=${testId}): \
${util.inspect(badConfig)}`, function() {
            //Can break here on this.test._testId
            expect(() => new NoSQLClient(badConfig)).to.throw(
                NoSQLArgumentError);
        })._testId = testId++;
    }
});

//Positive tests

describe('Positive config tests', function() {
    for(let goodConfig of goodConfigs) {
        it('Testing valid config: ' + util.inspect(goodConfig),
            function() {
                let client;
                const goodConfig0 = Utils.deepCopy(goodConfig);
                // eslint-disable-next-line no-useless-catch
                try {
                    client = new NoSQLClient(goodConfig); 
                } catch(err) {
                    throw err; //to put breakpoint
                }
                //Verify that creation of NoSQLClient instance did not affect
                //provided configuration object
                expect(goodConfig).to.deep.equal(goodConfig0);
                expect(client._client).to.exist;
                verifyEndpoint(client._client._url, goodConfig.endpoint,
                    goodConfig.region);
                verifyConfig(client._config, goodConfig);
                //verify that changes to goodConfig did not affect
                //NoSQLClient instance
                const config0 = Utils.deepCopy(client._config);
                eraseConfig(goodConfig);
                expect(client._config).to.deep.equal(config0);
            });
    }
});