/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { NoSQLClient } from "../../nosql_client";
import type { Config } from "../../config";
import type { Operation } from "../../param";
import type { NoSQLArgumentError } from "../../error";
import type { AuthConfig, AuthorizationProvider, AuthResult }
    from "../config";
import type { KVStoreAuthConfig, KVStoreCredentialsProvider } from "./types";

/**
 * Authorization provider used to to authorize operations against secure
 * on-premises Oracle NoSQL Database.
 * <p>
 * The driver uses this class internally for on-premises authentication.
 * Normally, you do not need to use this class. Instead, create
 * {@link NoSQLClient} instance by specifying {@link AuthConfig#kvstore}
 * property in {@link AuthConfig} as part of {@link Config#auth}, as described
 * in {@link KVStoreAuthConfig}.
 * <p>
 * You may use this class as an alternative to specifying
 * {@link AuthConfig#kvstore}, as a value for {@link AuthConfig#provider}
 * property when creating {@link NoSQLClient} instance. This is shown in the
 * example.
 * 
 * @see {@link KVStoreAuthConfig}
 * @see {@link AuthConfig}
 * 
 * @example
 * Using KVStoreAuthorizationProvider when creating NoSQLClient instance.
 * 
 * const userName = .....;
 * const pwd = .....;
 * 
 * const client = new NoSQLClient({
 *     endpoint: "",
 *     auth: {
 *         provider: new KVStoreAuthorizationProvider({
 *             user: userName,
 *             password: pwd
 *         })
 *     }
 * });
 */
export class KVStoreAuthorizationProvider implements AuthorizationProvider {
    /**
     * Initializes a new instance of {@link KVStoreAuthorizationProvider}.
     * @param config Configuration to create
     * {@link KVStoreAuthorizationProvider} specified as
     * {@link KVStoreAuthConfig}.
     * @throws {NoSQLArgumentError} if the configuration is has invalid
     * properties
     * @see {@link KVStoreAuthConfig}
     */
    constructor(config: KVStoreAuthConfig);

    /**
     * A convenience method to create new instance of
     * {@link KVStoreAuthorizationProvider} with supplied user name and
     * password.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link KVStoreAuthConfig}.
     * @param user User name, see {@link KVStoreAuthConfig#user}
     * @param pwd User's password, see {@link KVStoreAuthConfig#password} 
     * @returns New instance of {@link KVStoreAuthorizationProvider} using
     * specified credentials
     * @see {@link KVStoreAuthConfig}
     */
    static withCredentials(user: string, pwd: Buffer | string):
        KVStoreAuthorizationProvider;

    /**
     * A convenience method to create new instance of
     * {@link KVStoreAuthorizationProvider} with supplied credentials
     * provider.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link KVStoreAuthConfig}.
     * @param provider Credentials provider, see
     * {@link KVStoreCredentialsProvider}
     * @returns New instance of {@link KVStoreAuthorizationProvider} using
     * specified credentials provider
     * @see {@link KVStoreCredentialsProvider}
     * @see {@link KVStoreAuthConfig}
     */
    static withCredentialsProvider(provider: KVStoreCredentialsProvider):
        KVStoreAuthorizationProvider;

    /**
     * A convenience method to create new instance of
     * {@link KVStoreAuthorizationProvider} with supplied credentials
     * file path.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link KVStoreAuthConfig}.
     * @param file Credentials file, see {@link KVStoreAuthConfig#credentials}
     * {@link KVStoreCredentialsProvider}
     * @returns New instance of {@link KVStoreAuthorizationProvider} using
     * specified credentials file
     * @see {@link KVStoreAuthConfig}
     */
    static withCredentialsFile(file: string): KVStoreAuthorizationProvider;

    /**
     * Asynchronously acquires authorization information. This method is only
     * used by the driver. You don't need to call this method. This method can
     * only be used after {@link onInit} is called.
     * @async
     * @param {Operation} op {@link Operation} that requires authorization
     * @returns {Promise} Promise resolved with authorization information or
     * rejected with an error
     */
    getAuthorization(op: Operation): Promise<AuthResult>;

    /**
     * Initialization callback.
     * @param config {@link Config} object used to create {@link NoSQLClient}
     * instance.
     * @see {@link AuthorizationProvider#onInit}
     */
    onInit(config: Config): void;

    /**
     * Releases resources associated with this provider.
     * @see {@link AuthorizationProvider#close}
     */
    onClose(): void | Promise<void>;
}
