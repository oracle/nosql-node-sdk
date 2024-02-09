/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');
const Utils = require('./utils_node');

assert(global.crypto);

const SubtleCrypto = global.crypto.subtle;
assert(SubtleCrypto);

const CryptoKey = global.CryptoKey;
assert(CryptoKey);

const SIGN_ALG =  {
    name: 'RSASSA-PKCS1-v1_5',
    modulusLength: 2048,
    publicExponent: new Uint8Array([0x01, 0x00, 0x01]), // 65537
    hash: { name: 'SHA-256' }
};

class WebUtils extends Utils {

    static get isInBrowser() { return true; }

    static async _sign(signingContent, privateKey) {
        if (!(privateKey instanceof CryptoKey)) {
            return super._sign(signingContent, privateKey);
        }
        const data = typeof signingContent === 'string' ?
            Buffer.from(signingContent, 'utf8') : signingContent;
        const sign = await SubtleCrypto.sign(SIGN_ALG, privateKey, data);
        return Buffer.from(sign).toString('base64');
    }
}

module.exports = WebUtils;
