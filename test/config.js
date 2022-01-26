/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const path = require('path');
const NoSQLClient = require('../index').NoSQLClient;
const ServiceType = require('../index').ServiceType;
const NoSQLArgumentError = require('../index').NoSQLArgumentError;
const AuthConfig = require('../lib/auth/config');

class TestConfig {

    static _initServiceType(cfg) {
        if (cfg.serviceType != null) {
            if (typeof cfg.serviceType === 'string') {
                cfg.serviceType = ServiceType[cfg.serviceType.toUpperCase()];
            }
            if (!(cfg.serviceType instanceof ServiceType)) {
                throw new NoSQLArgumentError('Invalid service type', cfg);
            }
            return;
        }
        AuthConfig._chkInitProvider(cfg);
        AuthConfig._initServiceType(cfg);
    }

    static getConfigObj(cfg) {
        if (typeof cfg === 'string') {
            //config file must be .json or .js
            if (cfg.includes('.')) {
                cfg = require(path.resolve(cfg));
            } else {
                if (cfg === 'no-config') {
                    return;
                }
                //otherwise we use deployment type with value of cfg
                //and default config
                cfg = { serviceType: cfg };
            }
        }
        if (!cfg) {
            cfg = {};
        }
        this._initServiceType(cfg);
        if (!cfg.serviceType) {
            return cfg;
        }
        const stProp = cfg.serviceType.name.toLowerCase();
        return Object.assign({}, this.defaults[stProp], cfg);
    }

    static createNoSQLClientNoInit(cfg) {
        cfg = this.getConfigObj(cfg);
        return new NoSQLClient(cfg);
    }

    //For compatibility with internal tests that may require async
    //initialization
    static async createNoSQLClient(cfg) {
        return this.createNoSQLClientNoInit(cfg);
    }

}

TestConfig.defaults = {
    cloudsim: {
        endpoint: 'localhost:8080'
    },
    cloud: {},
    kvstore: {}
};

module.exports = TestConfig;
