/*-
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

let TestConfig = require('./config');

//This is to allow to run internal tests with more extensive configuration
function initTestConfig() {
    let cfg;
    try {
        cfg = require('../../test/config'); // eslint-disable-line
    } catch(err) {
        return;
    }
    if (typeof cfg === 'function' &&
        cfg.name === 'IntTestConfig' &&
        typeof cfg.getConfigObj === 'function' &&
        typeof cfg.createNoSQLClientNoInit === 'function' &&
        typeof cfg.createNoSQLClient === 'function') {
        TestConfig = cfg;
    }
}

initTestConfig();

module.exports = {
    TestConfig
};
