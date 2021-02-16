/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const util = require('util');
const fs = require('fs');
const crypto = require('crypto');
const tls = require('tls');
const net = require('net');

const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const promisified = require('../../utils').promisified;
const clearData = require('../../utils').clearData;

/* Signing algorithm only rsa-sha256 is allowed */
const ALG_RSA = 'rsa-sha256';

/* Signature algorithm */
const ALG_SIGN = 'sha256WithRSAEncryption';

/* OCI signature version only version 1 is allowed*/
const SIGNATURE_VERSION = 1;

/*
 * <ocid>.<resource-type>.<realm>. <region>(.future-extensibility)
 * .<resource-type-specific-id>
 * pattern is relaxed other than the required <ocid> and
 * <resource-type-specific-id>
 */
const OCID_PATTERN =
    /^([0-9a-zA-Z-_]+[.:])([0-9a-zA-Z-_]*[.:]){3,}([0-9a-zA-Z-_]+)$/;

class Utils {

    static signatureHeader(signingHeaders, keyId, signature) {
        return `Signature headers="${signingHeaders}",keyId="${keyId}",\
algorithm="${ALG_RSA}",signature="${signature}",\
version="${SIGNATURE_VERSION}"`;
    }

    static sign(signingContent, privateKey, desc) {
        try {
            const sign = crypto.createSign(ALG_SIGN);
            sign.update(signingContent);
            return sign.sign(privateKey, 'base64');
        } catch(err) {
            throw NoSQLAuthorizationError.illegalState(
                `Error signing ${desc}: ${err.message}`, err);
        }
    }

    static isValidOcid(ocid) {
        return typeof ocid === 'string' && ocid.match(OCID_PATTERN);
    }

    static privateKeyFromPEM(key, passphrase, fileName) {
        try {
            return crypto.createPrivateKey({
                key,
                format: 'pem',
                passphrase: passphrase ? passphrase : undefined
            });
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg('Error creating \
private key' + (this._pkFile ? ` from file ${fileName}` : ''), err);
        }
    }

    static async privateKeyFromPEMFile(keyFile, pass, passIsFile) {
        let key;
        try {
            key = await promisified(null, fs.readFile, keyFile);
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg(`Error reading private \
key from file ${keyFile}: ${err.message}`, err);
        }
        let pkPass;
        if (pass != null) {
            if (passIsFile) {
                try {
                    pkPass = await promisified(null, fs.readFile, pass);
                } catch(err) {
                    clearData(key);
                    throw NoSQLAuthorizationError.invalidArg(`Error reading \
    private key passphrase from file ${pass}: ${err.message}`, err);
                }
            } else {
                pkPass = pass;
            }
        }
        try {
            return Utils.privateKeyFromPEM(key, pkPass, keyFile);
        } finally {
            clearData(key);
            if (pkPass != null && passIsFile) {
                clearData(pass);
            }
        }
    }

    static parseSecurityToken(value, fileName) {
        const token = { value };
        const parts = value.split('.');
        if (parts.length < 3) {
            throw NoSQLAuthorizationError.invalidArg('Invalid security token \
value' + (fileName ? ` from file ${fileName}` : '') + `, number of parts: \
${parts.length} (should be >= 3)`);
        }
        try {
            const claimsStr = Buffer.from(parts[1], 'base64').toString();
            token.claims = JSON.parse(claimsStr);
            return token;
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg('Error parsing security \
token' + (fileName ? ` from file ${fileName}` : ''), err);
        }
    }

    //We don't currently do the check done in OCI SDK SecurityTokenAdapter
    //that compares public key in jwt's jwk with current public key because
    //no easy way to create public key from jwk in Node.js currently.  If
    //such mismatch occurs, the driver request will fail with
    //INVALID_AUTHORIZATION and we will retry it after refreshing the token.
    static isSecurityTokenValid(token) {
        const exp = Number(token.claims.exp);
        return Number.isFinite(exp) && Date.now() < exp * 1000;
    }

    static parseCert(pemCert) {
        const secureContext = tls.createSecureContext({
            cert: pemCert
        });
        const sock = new tls.TLSSocket(new net.Socket(), { secureContext });
        const cert = sock.getCertificate();
        sock.destroy();
        return cert;
    }

    static getSubjRDNValue(rdn, key) {
        if (rdn == null) {
            return null;
        }
        const prefix = key + ':';
        if (!Array.isArray(rdn)) {
            rdn = [ rdn ];
        }
        for(let kv of rdn) {
            if (typeof kv !== 'string') {
                throw NoSQLAuthorizationError.illegalState('Invalid RDN \
value in instance certificate subject name: ' + util.inspect(kv));
            }
            if (kv.startsWith(prefix)) {
                return kv.substring(prefix.length);
            }
        }
        return null;
    }

    static getTenantIdFromInstanceCert(cert) {
        if (cert.subject == null) {
            throw NoSQLAuthorizationError.illegalState('Invalid instance \
certificate, missing subject');
        }
        let tenantId = this.getSubjRDNValue(cert.subject.OU, 'opc-tenant');
        if (tenantId == null) {
            tenantId = this.getSubjRDNValue(cert.subject.O, 'opc-identity');
        }
        if (tenantId == null) {
            throw NoSQLAuthorizationError.illegalState('Instance certificate \
does not contain tenant id');
        }
        return tenantId;
    }

    static generateRSAKeyPair() {
        return new Promise((resolve, reject) => {
            crypto.generateKeyPair('rsa', { modulusLength: 2048 },
                (err, publicKey, privateKey) => {
                    if (err) {
                        return reject(err);
                    }
                    return resolve({ publicKey, privateKey });
                });
        });
    }

    static pemCert2derB64(pem) {
        //remove header and footer
        return pem.replace('-----BEGIN CERTIFICATE-----', '')
            .replace('-----END CERTIFICATE-----', '');
    }

    static pemCert2der(pem) {
        return Buffer.from(Utils.pemCert2derB64(pem), 'base64');
    }

    static sha256digest(data) {
        const hash = crypto.createHash('sha256');
        hash.update(data);
        return hash.digest('base64');
    }

    static fingerprintFromPemCert(pemCert) {
        const derCert = Utils.pemCert2der(pemCert);
        const hash = crypto.createHash('sha1');
        hash.update(derCert);
        const raw = hash.digest('hex');
        return raw.match(/.{2}/g).join(':');
    }
}

module.exports = Utils;
