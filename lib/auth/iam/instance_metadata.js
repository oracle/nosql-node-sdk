/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const HttpConstants = require('../../constants').HttpConstants;
const NoSQLServiceError = require('../../error').NoSQLServiceError;
const NoSQLAuthorizationError =
    require('../../error').NoSQLAuthorizationError;
const Region = require('../../region');
const HttpClient = require('../http_client');

/* Instance metadata service base URL */
const METADATA_SERVICE_BASE_URL = 'http://169.254.169.254/opc/v2/';
const FALLBACK_METADATA_SERVICE_URL = 'http://169.254.169.254/opc/v1/';

/* The authorization header need to send to metadata service since V2 */
const AUTHORIZATION_HEADER_VALUE = 'Bearer Oracle';

class InstanceMetadataClient {

    constructor(timeout) {
        this._timeout = timeout;
        this._httpClient = new HttpClient(null, false);
    }

    async getValue(path, desc) {
        let chkFallback;
        if (this._metadataUrl == null) {
            this._metadataUrl = METADATA_SERVICE_BASE_URL;
            chkFallback = true;
        }

        const req = {
            url: this._metadataUrl + path,
            method: HttpConstants.GET,
            headers: {
                [HttpConstants.AUTHORIZATION]: AUTHORIZATION_HEADER_VALUE
            },
            timeout: this._timeout
        };

        try {
            return await this._httpClient.request(req);
        } catch(err) {
            if (chkFallback && err instanceof NoSQLServiceError &&
                err.statusCode === HttpConstants.HTTP_NOT_FOUND) {
                this._metadataUrl = FALLBACK_METADATA_SERVICE_URL;
                req.url = this._metadataUrl + path;
                try {
                    return await this._httpClient.request(req);
                } catch(err2) {
                    throw NoSQLAuthorizationError._httpError(
                        `Unable to get ${desc} from instance metadata \
${METADATA_SERVICE_BASE_URL}, error: ${err2.message}`, err2);
                }
            } else {
                throw NoSQLAuthorizationError._httpError(
                    `Unable to get ${desc} from instance metadata \
${METADATA_SERVICE_BASE_URL} or fall back to \
${FALLBACK_METADATA_SERVICE_URL}, error: ${err.message}`, err);
            }
        }
    }

    //Get region from IMDS and cache it.
    async getRegion(ignoreNotFound) {
        if (this._region != null) {
            return this._region;
        }
        const res = await this.getValue('instance/region', 'region');
        this._region = Region.fromRegionCodeOrId(res);
        
        if (this._region == null && !ignoreNotFound) {
            throw NoSQLAuthorizationError.illegalState(`Missing or unknown \
instance region: ${res}`);
        }

        return this._region;
    }

    close() {
        this._httpClient.shutdown();
    }

}

module.exports = InstanceMetadataClient;
