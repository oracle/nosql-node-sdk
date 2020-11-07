/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/**
 * Defines types used for NoSQL driver configuration for on-premise kvstore.
 */

/**
 * This configuration is required to authenticate against secure On-Premise
 * Oracle NoSQL Database.  It should be set as {@link AuthConfig}#kvstore.
 * To authenticate against secure kvstore the driver needs user name and
 * password of existing store user that has required permissions to perform
 * needed database operations (see {@tutorial connect-on-prem} on how to set
 * up access to secure On-Premise Oracle NoSQL database).  The are 3 ways in
 * which these credentials may be specified.  In order of increased security,
 * they are:
 * <ul>
 * <li>You may set user name and password explicitly as
 * {@link KVStoreAuthConfig}#user and {@link KVStoreAuthConfig}#password (see
 * example). This is not very secure since password will be in memory in
 * plain text.  If password is specified as {@link Buffer}, it will
 * be copied when {@link NoSQLClient} is created and erased when
 * {@link NoSQLClient} is closed.</li>
 * <li>You may store user name and password in separate JSON file and set
 * the path to this file as {@link KVStoreAuthConfig}#credentials property.
 * This file should contain credentials in the form of
 * {@link KVStoreCredentials}.  It is more secure to store these credentials
 * in a separate file instead of main config file as access to this file may
 * be further restricted by appropriate permissions.  In addition, the
 * credentials will not be stored in memory but loaded from the file every
 * time when login is required.</li>
 * <li>You may implement and use your own {@link KVStoreCredentialsProvider}
 * to access credentials in secure way (e.g. by storing them in a keystore or
 * in encrypted form).  Set the provider instance as
 * {@link KVStoreAuthConfig}#credentials property.  The credentials should
 * be returned in the form of {@link KVStoreCredentials}.</li>
 * </ul>
 * 
 * See {@tutorial connect-on-prem} tutorial on how to set up the driver to
 * access secure on-premise NoSQL store via proxy.  Note that secure
 * on-premise NoSQL store uses the same <em>endpoint</em> for authentication
 * and to perform database operations.  This endpoint must be using
 * <em>https</em> protocol.  See {@link Config}#endpoint
 * <p>
 * If {@link KVStoreCredentials}#autoRenew property is set to true (which is
 * the default), after initial login is done, the driver will renew
 * authentication token each time it reaches half of its lifetime (half-point
 * between acquisition and expiration).  Renew request requires only existing
 * token and does not require user credentials.  If renew request fails, the
 * token will eventually expire and the driver will perform another login
 * (errors due to token expiration are automatically retried by the driver).
 * 
 * @example //AuthConfig object to access secure store with user name and
 * //and password specified
 * {
 *     kvstore: {
 *         user: 'my_user',
 *         password: Buffer.from('my_password@@123')
 *     }
 * }
 * @example //Full JSON config file to access secure store with user name and
 * //password stored in JSON credentials file
 * {
 *     "endpoint": "https://my_host:8089",
 *     "auth": {
 *         "kvstore": {
 *             "credentials": "/path/to/credentials.json"
 *         }
 *     }
 * }
 * @example //AuthConfig with using user-defined credentials provider
 * {
 *     kvstore: {
 *         credentials: new MyKVStoreCredentialsProvider()
 *     }
 * }
 * 
 * @see {@link Config}
 * @see {@link AuthConfig}
 * @see {@link KVStoreCredentialsProvider}
 * @tutorial connect-on-prem
 * 
 * @global
 * @typedef {object} KVStoreAuthConfig
 * @property {string} [user] NoSQL database user name.  May not be specified
 * together with <em>credentials</em> property
 * @property {string|Buffer} [password] User's password.  May only be
 * specified if <em>user</em> property is also specified.  If password is
 * represented as <em>Buffer</em>, it is UTF8-encoded.
 * @property {string|KVStoreCredentialsProvider} [credentials] A string
 * representing file path to credentials file (absolute or relative to current
 * directory) or an instance of user-defined credentials provider.  May not
 * be specified to gether with <em>user</em> or <em>password</em> properties
 * @property {number} [timeout=30000] Timeout used for login and renew-token
 * requests
 * @property {boolean} [autoRenew=true] If set to true, the driver will
 * attempt to renew the authentication token half way before its expiration
 * time
 */

/**
 * This type encapsulates credentials required for authenticating with
 * on-premise NoSQL secure store and consists of user name and password.  It
 * is also the format in which to store credentials in a JSON file as
 * described in {@link KVStoreAuthConfig}.
 * 
 * @example //JSON credentials file to store user name and password
 * {
 *     "user": "my_user",
 *     "password": "my_password@@123"
 * }
 * 
 * @global
 * @typedef {object} KVStoreCredentials
 * @property {string} user NoSQL Database user name
 * @property {Buffer|string} password User's password.  If
 * using <em>Buffer</em>, it is UTF8-encoded. When using
 * {@link KVStoreCredentialsProvider} and the password is represented as
 * <em>Buffer</em>, the driver will erase it as soon as store
 * login is performed
 */

/**
 * Interface to load credentials needed to login to secure on-premise NoSQL
 * database.
 * @see {@link KVStoreCredentials}
 * @see {@link KVStoreCredentialsProvider}
 * 
 * @global
 * @callback loadKVStoreCredentials
 * @async
 * @returns {Promise} Promise resolved with {@link KVStoreCredentials} or
 * rejected with an error
 */

/**
 * This interface may be implemented by applications to allow obtaining
 * {@link KVStoreCredentials} required to login to on-premise store in a
 * more secure manner than built-in mechanisms (supplying user/password
 * directly or storing them in JSON file) allow, by storing credentials in
 * encrypted form, in a keystore, etc.  This provider may be specified in
 * {@link KVStoreAuthConfig}#credentials property as either a function
 * {@link loadKVStoreCredentials} or an object (class instance or otherwise)
 * with method {@link KVStoreCredentialsProvider}#loadCredentials imlementing
 * {@link loadKVStoreredentials}
 * <p>
 * It is advisable that the implementation does not keep sensitive information
 * (such as password) in memory in plain text in between calls to this
 * provider.
 * 
 * @see {@link loadKVStoreCredentials}
 * @see {@link KVStoreCredentials}
 * @tutorial connect-on-prem
 * 
 * @global
 * @typedef {object|loadKVStoreCredentials} KVStoreCredentialsProvider
 * @property {loadKVStoreCredentials} loadCredentials loadCredentials function
 * @property {function()} [close] If specified, releases any resources
 * associated with this provider when {@link NoSQLClient} instance is closed
 */
