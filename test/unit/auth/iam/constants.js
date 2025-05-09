/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const path = require('path');
const os = require('os');

const COMPARTMENT_ID = 'ocid1.compartment.oc1..compartment';
const SERVICE_HOST = 'localhost';
const SERVICE_ENDPOINT = new URL('https://' + SERVICE_HOST);
const TENANT_ID = 'ocid1.tenancy.oc1..tenancy';
const USER_ID = 'ocid1.user.oc1..user';
const FINGERPRINT = 'fingerprint';
const PASSPHRASE = 'oracle';
const ST_HEADER = 'pseudo-header';
const ST_SIG = 'pseudo-signature';
const PRIVATE_KEY_FILE = path.resolve('key_private.pem');
const OCI_CONFIG_FILE = path.resolve('config');
const DELEGATION_TOKEN_FILE = path.resolve('delegation_token');
const DELEGATION_TOKEN = 'token-header.token-payload.token-sig';
const DELEGATION_TOKEN2 = 'token-header2.token-payload2.token-sig2';
const SESSION_TOKEN_FILE = path.resolve('security_token');
const SESSION_TOKEN = 'token-header.token-payload.token-sig';
const RES_COMPARTMENT = 'ocid1.compartment.oc1..resource';
const RES_TENANT = 'ocid1.tenancy.oc1..resource';

//default OCI config file
const DEFAULT_OCI_DIR = path.join(os.homedir(), '.oci');
const DEFAULT_OCI_FILE = path.join(DEFAULT_OCI_DIR, 'config');

//instance certificates together with tenantId and fingerprint

const CERT_INFO = [
    {
        cert: `-----BEGIN CERTIFICATE-----
MIIEATCCAumgAwIBAgIJAMOCcAhW4IYTMA0GCSqGSIb3DQEBCwUAMIGVMQswCQYD
VQQGEwJVUzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNUmVkd29vZHMg
Q2l0eTEPMA0GA1UECgwGT3JhY2xlMR4wHAYDVQQLDBVvcGMtdGVuYW50OlRlc3RU
ZW5hbnQxKDAmBgNVBAMMH29jaWQxLmluc3RhbmNlLm9jMS5waHguaW5zdGFuY2Uw
IBcNMTkwNzAxMjIwODE0WhgPMjExOTA2MDcyMjA4MTRaMIGVMQswCQYDVQQGEwJV
UzETMBEGA1UECAwKQ2FsaWZvcm5pYTEWMBQGA1UEBwwNUmVkd29vZHMgQ2l0eTEP
MA0GA1UECgwGT3JhY2xlMR4wHAYDVQQLDBVvcGMtdGVuYW50OlRlc3RUZW5hbnQx
KDAmBgNVBAMMH29jaWQxLmluc3RhbmNlLm9jMS5waHguaW5zdGFuY2UwggEiMA0G
CSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDYZPrL8qgK+1y+1fbrKs454eAg7h18
4smtcemd8eVvwX7oxIHM5Zq1cqVd8VFoiSpyXZB7Y2jZGhkIUPiXKXAsMcI8qCJX
sJqrbmsGj/QQiuGpcO+3UFxUOWIqWHciYrPKOzPB1C74ECYRnH/CoZy9gIkKQ37q
zuHIHa/EMNQEOEiSm2qopoUqCpbGXiTqtQxSBz+4AbFvAN7RHgi5gh6WJXs/Mxr9
ZuHhusEgZJFaxAy6mOMwIZMStMN1F22pJnHEwllKtGq2kMVVkVA/oXGVXbHYxl5z
MLSwZIbktAUhTc4nS490z27YCGoRGCQ173mUcsr/OtzW809sA3Q/i03tAgMBAAGj
UDBOMB0GA1UdDgQWBBQLjyVU4YIwisrYp5P/yEn8xAN+QzAfBgNVHSMEGDAWgBQL
jyVU4YIwisrYp5P/yEn8xAN+QzAMBgNVHRMEBTADAQH/MA0GCSqGSIb3DQEBCwUA
A4IBAQAZ6UOwrlzVCTsP7QybBeKXHZU9/Vw2DTEcJ/MdTEPYtQFLaOKTb1SmY27y
3BgZIQkofLq0ptaa99ceMHZiDzZRr4LKxIfk2mD7IDcpnrg+i+u6EX57TLtnfleY
DwZcCWYZKSC0kC9C8YitTAJC8ydGjIbFtvp6S2XJOMRXQfNiYP4eXNeScs47Ja9f
5L9cb/g85F3Rg5Q9JaMgiPnhqKpXnHWo0dN54xY9qbI09IA3oVG6sK359/RIkyRl
ARAYsZOahLRGGNB0sqFK80Bstkk22bI8VZXYtw6G6dp1EOdzZUZRoOHrEzAo+7Un
4HJ5KkzwNwuDhiF6CSthP+TBknWf
-----END CERTIFICATE-----`,
        tenantId: 'TestTenant',
        fingerprint:
            '1E:7B:E4:0B:4E:50:C1:20:A8:2A:57:6C:95:10:F6:90:66:66:5A:AA',
        privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQDYZPrL8qgK+1y+
1fbrKs454eAg7h184smtcemd8eVvwX7oxIHM5Zq1cqVd8VFoiSpyXZB7Y2jZGhkI
UPiXKXAsMcI8qCJXsJqrbmsGj/QQiuGpcO+3UFxUOWIqWHciYrPKOzPB1C74ECYR
nH/CoZy9gIkKQ37qzuHIHa/EMNQEOEiSm2qopoUqCpbGXiTqtQxSBz+4AbFvAN7R
Hgi5gh6WJXs/Mxr9ZuHhusEgZJFaxAy6mOMwIZMStMN1F22pJnHEwllKtGq2kMVV
kVA/oXGVXbHYxl5zMLSwZIbktAUhTc4nS490z27YCGoRGCQ173mUcsr/OtzW809s
A3Q/i03tAgMBAAECggEAORvtVIXl84ADKhot4EKbyoriK86r2ZnAwBWgIh8E/kmC
xMuXtguimOB45CIb6grJOQWYa/gAY8uPb7Ju6PX2tLMtH/T/m0TwjO3HMSQstXDx
vVYg7bA3rcK3NZXDWz/RUz3smur0umMIqP00eplMVHbns928URvoWnf7OzvnuHTl
8INq7T+CbtlEslQndeL3FlFoKITSVuEzifw4H7VGXB1W86PfXiTig4GQgwGjO+Nb
Oe6hIXa5dPQcYQx7M9cXUI77UKqJsPMPYAtPVLUm7hGyDNDcHF/R3g/lSb70NjU7
IZph1LXnYVeqsVMXpCaD0HzQNG5fuXwK10gWJ+7YAQKBgQDv+2R1gJMUw+RMgk6G
9GblDhvOnoaXPRuEVQuH6K6dDlzQ6zY3kt/onYM6siExxqhygqLNMgKk++4GGuDK
rbP5ndZh3E9/bztJDBH/HFsSYF4+3oAEQWIKUKB/OZmmwlHQ7TTYUCAA6azFQBX9
jQ2uB9SaQyYpDVbUsGFhF5AIIQKBgQDm1osYbrrfukiTgfnr9p/megZ2KaERu6vj
rGL9cTC47NmrvAcG6LArlZ8xG9GbxFIzt3XNwwl0bbl1SI7J0Mk3YzeSjVSpgpYh
xtpDo5BS2EZBgTfGOXIYhpPoB2YuOHrnVql92MoCyD6S7AnVUvHH5LRw5NWlsvB8
V2p16K1cTQKBgQDVwo+ROp3IeVT58XgRLdIZZZ/PQ9WPEZdZIIfM363pp8l1Lo50
ohdgFC24MsLum42fsk1hiZJhcyZpubdR0bfmOHmlYaBOWr3sKxw8qP1WORC532cY
Y0T4+yh7Kst6hsxp1WCk7XoUVhDXAmaUGvh8c+0kG3v6RS969EFJQrvBAQKBgQCY
QayPWgICraFPQizxecNwRs5aRA0MYEf5LOxCFNW5M+hDAQt1gCcrKE5PGvU/k9dQ
a1LVfC6RUApClLAx53fBA71U+cl84ThbYQj4EjuQmTyF2lBKe/uIt8N5COBZ3kEa
s6up6UMdYKz9RZkaztHRMkXeLOHKoGNE8He0+9rVBQKBgEAM6FaNoBlUVjoZF8Y1
KkMQWubYt6j3/G7WlIdqI6JW3rEZVJ57lD/9X8SzysIOh2QO41OVU7900rQwLmBW
vWqUa2kXq7WgjkI4xt6nVEJIKxUfQpx7RQ4ygBJs1c0oEWlCwtKLwMvG4IcZNVBa
JnTJyeO3vhWjdW9RI7+ms4h1
-----END PRIVATE KEY-----`,
        get intermediateCert() { return this.cert; }
    },
];

module.exports = {
    COMPARTMENT_ID,
    SERVICE_HOST,
    SERVICE_ENDPOINT,
    TENANT_ID,
    USER_ID,
    FINGERPRINT,
    PASSPHRASE,
    ST_HEADER,
    ST_SIG,
    PRIVATE_KEY_FILE,
    OCI_CONFIG_FILE,
    DELEGATION_TOKEN_FILE,
    DELEGATION_TOKEN,
    DELEGATION_TOKEN2,
    SESSION_TOKEN_FILE,
    SESSION_TOKEN,
    DEFAULT_OCI_DIR,
    DEFAULT_OCI_FILE,
    RES_COMPARTMENT,
    RES_TENANT,
    CERT_INFO
};
