/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));
const expect = chai.expect;

const util = require('util');
const crypto = require('crypto');
const fs = require('fs');
const Utils = require('../utils');
const HttpConstants = require('../../../lib/constants').HttpConstants;
const AuthConfig = require('../../../lib/auth/config');
const SERVICE_HOST = require('./constants').SERVICE_HOST;
const PASSPHRASE = require('./constants').PASSPHRASE;
const ST_HEADER = require('./constants').ST_HEADER;
const ST_SIG = require('./constants').ST_SIG;

const OBO_TOKEN_HEADER = 'opc-obo-token';

const AUTH_HEADER_PATTERN = new RegExp('^Signature headers=".+?",\
keyId="(.+?)",algorithm="(.+?)",signature="(.+?)",version="(.+?)"$');

const KEY_ID_PATTERN_IDEN = '^(.+?)\\/(.+?)\\/(.+?)$';
const KEY_ID_PATTERN_ST = '^ST\\$(.+?)$';

const MAX_INSPECT_LENGTH = 80;

function isSimpleProperty(obj, prop) {
    do {
        const desc = Object.getOwnPropertyDescriptor(obj, prop);
        if (desc && desc.value) {
            return true;
        }
        obj = obj.__proto__;
    } while(obj);
    return false;
}

//This will limit the length of long strings such as PEM in Mocha
//description of testcases.
function _prepareInspect(obj) {
    for(let k in obj) {
        if (!isSimpleProperty(obj, k)) {
            continue;
        }
        const v = obj[k];
        if (typeof v === 'string') {
            obj[k] = new String(v);
            obj[k][util.inspect.custom] = function() {
                return this.length <= MAX_INSPECT_LENGTH ? this.valueOf() :
                    this.slice(0, MAX_INSPECT_LENGTH) + '...';
            };
        } else if (v && typeof v === 'object') {
            _prepareInspect(v);
        }
    }
}

function inspect(obj) {
    if (!obj || typeof obj !== 'object') {
        return obj;
    }
    obj = Utils.deepCopy(obj);
    _prepareInspect(obj);
    return util.inspect(obj);
}

function iam2cfg(cfg, compartment, excludeURL) {
    const res = {
        endpoint: new URL('https://' + SERVICE_HOST),
        compartment,
        auth: {
            //simulate inheritance from config defaults in source code
            iam: cfg && typeof cfg === 'object' ? Object.assign({
                __proto__: Object.assign({}, AuthConfig.defaults.iam)
            }, cfg) : cfg
        }
    };
    //We have to ensure that the provider will use the same service host
    //SERVICE_HOST for auth verification to work in the tests.
    //We use url property to ensure the code in IAMAuthorizationProvider
    //constructor will not perform extra url initialization (calling
    //Config.initURL(), auth_provider.js, line 121).  This is needed if
    //instantiating the provider directly.  When instantiating NoSQLClient,
    //endpoint property can be used instead with the host SERVICE_HOST,
    //because the url will be initialized from the endpoint in
    //Config.InitURL().
    if (!excludeURL) {
        res.url = res.endpoint;
    }
    return res;
}

function makeReq(cfg) {
    const req = {
        opt: {}
    };
    if (cfg != null) {
        req.opt.__proto__ = cfg;
    }
    return req;
}

//We use data === null to indicate non-existent file for negative testing.
//If data === undefined, then the file is irrelevant for the given testcase.
function writeOrRemove(file, data) {
    if (data != null) {
        expect(file).to.exist; //test self-check
        fs.writeFileSync(file, data);
    } else if (data === null && file != null && fs.existsSync(file)) {
        fs.unlinkSync(file);
    }
}

function createKeys() {
    let keys = crypto.generateKeyPairSync('rsa', { modulusLength : 2048});
    keys.privatePEM = keys.privateKey.export({
        type: 'pkcs8',
        format: 'pem'
    });
    keys.privateEncPEM = keys.privateKey.export({
        type: 'pkcs8',
        format: 'pem',
        cipher: 'aes-256-cbc',
        passphrase: PASSPHRASE
    });
    return keys;
}

function base64UrlEncode(data) {
    const enc = Buffer.from(data).toString('base64');
    return enc.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

let stSeqNo = 0;

function makeSTPayload(ttlMs) {
    return JSON.stringify({
        exp: Math.round((Date.now() + ttlMs)/1000),
        //these might be useful for resource principal, ignored otherwise
        res_tenant: 'tenantId',
        res_compartment: 'compartmentId',
        _seqNo: stSeqNo++ //this will make the token unique
    });
}

function makeST(ttlMs) {
    return base64UrlEncode(ST_HEADER) + '.' +
        base64UrlEncode(makeSTPayload(ttlMs)) + '.' +
        base64UrlEncode(ST_SIG);
}

function signingContent(dateStr, delegationToken) {
    let content = `${HttpConstants.REQUEST_TARGET}: post /\
${HttpConstants.NOSQL_DATA_PATH}\n\
${HttpConstants.HOST}: ${SERVICE_HOST}\n\
${HttpConstants.DATE}: ${dateStr}`;
    if (delegationToken != null) {
        content += `\n${OBO_TOKEN_HEADER}: ${delegationToken}`;
    }
    return content;
}

function verifyAuthHeader(header, profile, dateStr, delegationToken) {
    const match = header.match(AUTH_HEADER_PATTERN);
    expect(match).to.be.an('array');
    expect(match.length).to.equal(5);
    if (profile.token != null) {
        const match1 = match[1].match(KEY_ID_PATTERN_ST);
        expect(match1).to.be.an('array');
        expect(match1.length).to.equal(2);
        expect(match1[1]).to.equal(profile.token);
    } else {
        const match1 = match[1].match(KEY_ID_PATTERN_IDEN);
        expect(match1).to.be.an('array');
        expect(match1.length).to.equal(4);
        expect(match1[1]).to.equal(profile.tenantId);
        expect(match1[2]).to.equal(profile.userId);
        expect(match1[3]).to.equal(profile.fingerprint);    
    }
    const signature = match[3];
    expect(profile.publicKey).to.exist; //test self-check
    //verify signature
    const verify = crypto.createVerify('sha256WithRSAEncryption');
    verify.update(signingContent(dateStr, delegationToken));
    expect(verify.verify(profile.publicKey, signature, 'base64'))
        .to.equal(true);
}

function verifyAuth(auth, profile, expectedCompartmentId,
    expectedDelegationToken) {
    expect(auth).to.be.an('object');
    expect(auth).to.haveOwnProperty(HttpConstants.AUTHORIZATION);
    expect(auth).to.haveOwnProperty(HttpConstants.DATE);
    expect(auth).to.haveOwnProperty(HttpConstants.COMPARTMENT_ID);
    const header = auth[HttpConstants.AUTHORIZATION];
    expect(header).to.be.a('string').that.is.not.empty;
    const dateStr = auth[HttpConstants.DATE];
    expect(dateStr).to.be.a('string');
    expect(new Date(dateStr).getTime()).to.be.finite;
    const compartment = auth[HttpConstants.COMPARTMENT_ID];
    expect(compartment).to.be.a('string').that.is.not.empty;
    if (expectedCompartmentId != null) {
        expect(compartment).to.equal(expectedCompartmentId);
    } else if (profile.tenantId != null) {
        expect(compartment).to.equal(profile.tenantId);
    }
    if (expectedDelegationToken != null) {
        expect(auth[OBO_TOKEN_HEADER]).to.equal(expectedDelegationToken);
    }
    verifyAuthHeader(header, profile, dateStr, expectedDelegationToken);
}

function verifyAuthEqual(auth, auth0, profile, compartment, delegationToken) {
    verifyAuth(auth0, profile, compartment, delegationToken);
    verifyAuth(auth, profile, compartment, delegationToken);
    const header = auth[HttpConstants.AUTHORIZATION];
    const header0 = auth0[HttpConstants.AUTHORIZATION];
    const dateStr = auth[HttpConstants.DATE];
    const dateStr0 = auth0[HttpConstants.DATE];
    expect(header).to.equal(header0);
    expect(dateStr).to.equal(dateStr0);
}

function verifyAuthLaterDate(auth, auth0, profile, profile0, compartment,
    delegationToken, delegationToken0) {
    if (profile0 == null) {
        profile0 = profile;
    }
    if (delegationToken0 == null) {
        delegationToken0 = delegationToken;
    }
    verifyAuth(auth0, profile0, compartment, delegationToken0);
    verifyAuth(auth, profile, compartment, delegationToken);
    const header = auth[HttpConstants.AUTHORIZATION];
    const header0 = auth0[HttpConstants.AUTHORIZATION];
    const dateStr = auth[HttpConstants.DATE];
    const dateStr0 = auth0[HttpConstants.DATE];
    expect(header).to.not.equal(header0);
    expect(dateStr).to.not.equal(dateStr0);
    expect(new Date(dateStr).getTime()).to.be.greaterThan(
        new Date(dateStr0).getTime());
}

function writeFileLines(file, lines) {
    fs.writeFileSync(file, lines.join('\n'));
}

module.exports = {
    inspect,
    iam2cfg,
    makeReq,
    writeOrRemove,
    createKeys,
    base64UrlEncode,
    makeSTPayload,
    makeST,
    verifyAuth,
    verifyAuthEqual,
    verifyAuthLaterDate,
    writeFileLines
};
