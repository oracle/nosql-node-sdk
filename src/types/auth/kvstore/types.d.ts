/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { KVStoreAuthorizationProvider } from "./auth_provider";

/**
 * This configuration is required to authenticate against secure On-Premises
 * Oracle NoSQL Database.  It should be set as {@link AuthConfig#kvstore}.
 * To authenticate against secure kvstore the driver needs user name and
 * password of existing store user that has required permissions to perform
 * needed database operations (see {@page connect-on-prem.md} on how to set
 * up access to secure On-Premise Oracle NoSQL database).  The are 3 ways in
 * which these credentials may be specified.  In order of increased security,
 * they are:
 * <ul>
 * <li>You may set user name and password explicitly as
 * {@link user} and {@link password} (see
 * example). This is not very secure since password will be in memory in
 * plain text.  If password is specified as {@link !Buffer | Buffer}, it will
 * be copied when {@link NoSQLClient} is created and erased when
 * {@link NoSQLClient} is closed.</li>
 * <li>You may store user name and password in separate JSON file and set
 * the path to this file as {@link credentials} property.
 * This file should contain credentials in the form of
 * {@link KVStoreCredentials}.  It is more secure to store these credentials
 * in a separate file instead of main config file as access to this file may
 * be further restricted by appropriate permissions.  In addition, the
 * credentials will not be stored in memory but loaded from the file every
 * time when login is required.</li>
 * <li>You may implement and use your own {@link KVStoreCredentialsProvider}
 * to access credentials in secure way (e.g. by storing them in a keystore or
 * in encrypted form).  Set the provider instance as
 * {@link credentials} property.  The credentials should be returned in the
 * form of {@link KVStoreCredentials}.</li>
 * </ul>
 *
 * See {@page connect-on-prem.md} tutorial on how to set up the driver to
 * access secure on-premise NoSQL store via proxy.  Note that secure
 * on-premise NoSQL store uses the same <em>endpoint</em> for authentication
 * and to perform database operations.  This endpoint must be using
 * <em>https</em> protocol.  See {@link Config#endpoint}.
 * <p>
 * If {@link autoRenew} property is set to true (which is
 * the default), after initial login is done, the driver will renew
 * authentication token each time it reaches half of its lifetime (half-point
 * between acquisition and expiration).  Renew request requires only existing
 * token and does not require user credentials.  If renew request fails, the
 * token will eventually expire and the driver will perform another login
 * (errors due to token expiration are automatically retried by the driver).
 * @see {@link KVStoreAuthorizationProvider}
 * @see {@link KVStoreCredentials}
 * @see {@link KVStoreCredentialsProvider}
 */
export interface KVStoreAuthConfig {
    /**
     * NoSQL database user name. May not be specified together with
     * {@link credentials} property.
     */
    user?: string;

    /**
     * User's password. May only be specified if {@link user} property is
     * also specified. If password is represented as {@link !Buffer | Buffer},
     * it must be UTF8-encoded.
     */
    password?: string|Buffer;
    
    /**
     * A string representing file path to credentials file (absolute or
     * relative to current directory) or an instance of user-defined
     * credentials provider. May not be specified together with {@link user}
     * or {@link password} properties.
     */
    credentials?: string | KVStoreCredentialsProvider |
        KVStoreCredentialsProvider["loadCredentials"];
    
    /**
     * Timeout used for login and renew-token requests, in milliseconds.
     * @defaultValue 30000 (30 seconds)
     */
    timeout?: number;
    
    /**
     * If set to true, the driver will attempt to renew the authentication
     * token half way before its expiration time.
     */
    autoRenew?: boolean;
}

/**
 * This type encapsulates credentials required for authenticating with
 * on-premise NoSQL secure store and consists of user name and password.  It
 * is also the format in which to store credentials in a JSON file as
 * described in {@link KVStoreAuthConfig}.
 */
export interface KVStoreCredentials {
    /**
     * NoSQL Database user name
     */
    user: string;

    /**
     * User's password.  If using {@link !Buffer | Buffer}, it must be
     * UTF8-encoded. When using {@link KVStoreCredentialsProvider} and the
     * password is represented as {@link !Buffer | Buffer}, the driver will
     * erase it as soon as store login is performed.
     */
    password: Buffer|string;
}

/**
 * This interface may be implemented by applications to allow obtaining
 * {@link KVStoreCredentials} required to login to on-premise store in a
 * secure manner. {@link KVStoreCredentialsProvider} is set as
 * {@link KVStoreAuthConfig#credentials} property of
 * {@link KVStoreAuthConfig}. Instead of a class implementing this interface,
 * you may also set {@link KVStoreAuthConfig#credentials} to a function with
 * the signature of {@link loadCredentials}.
 */
export interface KVStoreCredentialsProvider {
    /**
     * Asynchronously load credentials required to login to secure on-premise
     * NoSQL database.
     * @async
     * @returns {Promise} Promise resolved with {@link KVStoreCredentials} or
     * rejected with an error. Properties of type {@link !Buffer | Buffer}
     * such as {@link KVStoreCredentials#password} will be erased once the
     * store login is performed.
     */
    loadCredentials(): Promise<KVStoreCredentials>;
}
