/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

/**
 * ResourcePrincipalProvider
 * <p>
 * The authentication profile provider used to call service API from other OCI
 * resource such as function. It authenticates with resource principal and uses
 * security token issued by IAM to do the actual request signing.
 * <p>
 * It's constructed in accordance with the following environment variables:
 *  <ul>
 *
 * <li>OCI_RESOURCE_PRINCIPAL_VERSION: permitted values are "2.2"
 * </li>
 *
 * <li>OCI_RESOURCE_PRINCIPAL_RPST:
 * <p>
 * If this is an absolute path, then the filesystem-supplied resource
 * principal session token will be retrieved from that location. This mode
 * supports token refresh (if the environment replaces the RPST in the
 * filesystem). Otherwise, the environment variable is taken to hold the raw
 * value of an RPST. Under these circumstances, the RPST cannot be refreshed;
 * consequently, this mode is only usable for short-lived executables.
 * </li>
 * <li>OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM:
 * If this is an absolute path, then the filesystem-supplied private key will
 * be retrieved from that location. As with the OCI_RESOURCE_PRINCIPAL_RPST,
 * this mode supports token refresh if the environment can update the file
 * contents. Otherwise, the value is interpreted as the direct injection of a
 * private key. The same considerations as to the lifetime of this value apply
 * when directly injecting a key.
 * </li>
 * <li>OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM_PASSPHRASE:
 * <p>
 * This is optional. If set, it contains either the location (as an absolute
 * path) or the value of the passphrase associated with the private key.
 * </li>
 * <li>OCI_RESOURCE_PRINCIPAL_REGION:
 * <p>
 * If set, this holds the canonical form of the local region. This is intended
 * to enable executables to locate their "local" OCI service endpoints.</p>
 * </li>
 * </ul>
 */

const assert = require('assert');
const path = require('path');
const fs = require('fs');
const process = require('process');

const promisified = require('../../utils').promisified;
const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const Utils = require('./utils');

/* Environment variable names used to fetch artifacts */
const OCI_RESOURCE_PRINCIPAL_VERSION = 'OCI_RESOURCE_PRINCIPAL_VERSION';
const RP_VERSION_2_2 = '2.2';
const OCI_RESOURCE_PRINCIPAL_RPST = 'OCI_RESOURCE_PRINCIPAL_RPST';
const OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM =
    'OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM';
const OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM_PASSPHRASE =
    'OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM_PASSPHRASE';
const OCI_RESOURCE_PRINCIPAL_REGION = 'OCI_RESOURCE_PRINCIPAL_REGION';

/* Claim keys for compartment and tenant id in resource principal
 * security tokens.
 */
//const COMPARTMENT_ID_CLAIM_KEY = 'res_compartment';
//const TENANT_ID_CLAIM_KEY = 'res_tenant';

class ResourcePrincipalProvider {

    constructor(cfg) {
        const ver = process.env[OCI_RESOURCE_PRINCIPAL_VERSION];
        if (ver == null) {
            throw NoSQLAuthorizationError.invalidArg(`Missing environment \
variable ${OCI_RESOURCE_PRINCIPAL_VERSION}`, null, cfg);
        }
        if (ver !== RP_VERSION_2_2) {
            throw NoSQLAuthorizationError.invalidArg(`Unknown value for \
environment variable ${OCI_RESOURCE_PRINCIPAL_VERSION}`, null, cfg);
        }

        this._pk = process.env[OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM];
        this._pkPass =
            process.env[OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM_PASSPHRASE];
        if (this._pk == null) {
            throw NoSQLAuthorizationError.invalidArg(`Missing environment \
variable ${OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM}`, null, cfg);
        }
        if (path.isAbsolute(this._pk)) {
            if (this._pkPass != null && !path.isAbsolute(this._pkPass)) {
                throw NoSQLAuthorizationError.invalidArg(`Cannot mix path \
and constant settings for ${OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM} and \
${OCI_RESOURCE_PRINCIPAL_PRIVATE_PEM_PASSPHRASE}`, null, cfg);
            }
            this._pkInFile = true;
        } else {
            this._privateKey = Utils.privateKeyFromPEM(this._pk,
                this._pkPass);
        }

        this._rpst = process.env[OCI_RESOURCE_PRINCIPAL_RPST];
        if (this._rpst == null) {
            throw NoSQLAuthorizationError.invalidArg(`Missing environment \
variable ${OCI_RESOURCE_PRINCIPAL_RPST}`, null, cfg);
        }
        if (path.isAbsolute(this._rpst)) {
            this._rpstInFile = true;
        } else {
            this._token = Utils.parseSecurityToken(this._rpst);
        }

        this._region = process.env[OCI_RESOURCE_PRINCIPAL_REGION];
        if (this._region == null) {
            throw NoSQLAuthorizationError.invalidArg(`Missing environment \
variable ${OCI_RESOURCE_PRINCIPAL_REGION}`, null, cfg);
        }
    }

    async _rpstFromFile() {
        let rpst;
        try {
            rpst = await promisified(null, fs.readFile, this._rpst, 'utf8');
        } catch(err) {
            throw NoSQLAuthorizationError.invalidArg(`Error reading security \
token from file ${this._rpst}`, err);
        }
        return Utils.parseSecurityToken(rpst);
    }

    async getProfile(needRefresh) {
        const refreshRPST = needRefresh ||
            (this._rpstInFile && (this._token == null ||
                !Utils.isSecurityTokenValid(this._token)));
        const refreshPK = this._pkInFile && (refreshRPST ||
            this._privateKey == null);
        
        if (refreshRPST) {
            this._token = await this._rpstFromFile();
        }
        if (refreshPK) {
            this._privateKey = await Utils.privateKeyFromPEMFile(this._pk,
                this._pkPass, true);
        }

        assert(this._token != null);
        assert(this._privateKey != null);

        return {
            keyId: 'ST$' + this._token.value,
            privateKey: this._privateKey
        };
    }

    getRegion() {
        return this._region;
    }
}

module.exports = ResourcePrincipalProvider;
