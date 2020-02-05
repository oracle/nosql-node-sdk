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

const crypto = require('crypto');

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

    static sign(signingContent, privateKey) {
        const sign = crypto.createSign(ALG_SIGN);
        sign.update(signingContent);
        return sign.sign(privateKey, 'base64');
    }

    static isValidOcid(ocid) {
        return typeof ocid === 'string' && ocid.match(OCID_PATTERN);
    }

}

module.exports = Utils;
