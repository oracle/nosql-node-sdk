/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');
const NoSQLClient = require('../../../index').NoSQLClient;
const NoSQLArgumentError = require('../../../index').NoSQLArgumentError;
const defaultOCIFileLines = require('./config').defaultOCIFileLines;
const Utils = require('../utils');
const verifyEndpoint = require('../common').verifyEndpoint;
const writeFileLines = require('./utils').writeFileLines;
const backupDefaultOCIFile = require('./utils').backupDefaultOCIFile;
const restoreDefaultOCIFile = require('./utils').restoreDefaultOCIFile;
const DEFAULT_OCI_FILE = require('./constants').DEFAULT_OCI_FILE;

const configNoRegion = {
    serviceType: 'CLOUD',
    auth: {
        iam: {
            configFile: DEFAULT_OCI_FILE,
            profileName: 'DEFAULT'
        }
    }
};

const configs = [ undefined, null, configNoRegion ];

function verifyOCIRegion(client, region) {
    verifyEndpoint(client._client._url, null, region);
}

function testNegative() {
    describe('Missing region in OCI config negative test', function() {
        before(function() {
            writeFileLines(DEFAULT_OCI_FILE, defaultOCIFileLines);
        });
        it('NoSQLClient(), OCI config without region', function() {
            expect(() => new NoSQLClient()).to.throw(
                NoSQLArgumentError);
        });
        for(let cfg of configs) {
            it(`NoSQLClient(${util.inspect(cfg)}), OCI config without region`,
                function() {
                    expect(() => new NoSQLClient(cfg)).to.throw(
                        NoSQLArgumentError);
                });
        }
    });
    describe('Invalid region in OCI config negative test', function() {
        before(function() {
            writeFileLines(DEFAULT_OCI_FILE, [ ...defaultOCIFileLines,
                'region=nosuchregion']);
        });
        it('NoSQLClient(), OCI config with invalid region', function() {
            expect(() => new NoSQLClient()).to.throw(
                NoSQLArgumentError);
        });
        for(let cfg of configs) {
            it(`NoSQLClient(${util.inspect(cfg)}), OCI config with invalid \
region`, function() {
                expect(() => new NoSQLClient(cfg)).to.throw(
                    NoSQLArgumentError);
            });
        }
    });
}

const ociRegion1 = 'ap-mumbai-1';
const ociRegion2 = 'us-ashburn-1';

function testPositive() {
    describe('Region in OCI config positive test', function() {
        before(function() {
            writeFileLines(DEFAULT_OCI_FILE, [ ...defaultOCIFileLines,
                `region=${ociRegion1}`]);
        });
        it('NoSQLClient(), OCI config with valid region', function() {
            const client = new NoSQLClient();
            verifyOCIRegion(client, ociRegion1);
        });
        for(let cfg of configs) {
            it(`NoSQLClient(${util.inspect(cfg)}), OCI config with valid \
region`, function() {
                const client = new NoSQLClient(cfg);
                verifyOCIRegion(client, ociRegion1);
            });
        }
        it('NoSQLClient config and OCI config with different regions',
            function() {
                const client = new NoSQLClient(
                    Object.assign({}, configNoRegion,
                        { region: ociRegion2 }));
                verifyOCIRegion(client, ociRegion2);
            });
    });
}

if (!Utils.isOnPrem) {
    describe('Test region in OCI config file', function() {
        before(backupDefaultOCIFile);
        after(restoreDefaultOCIFile);
        testNegative();
        testPositive();
    });
}
