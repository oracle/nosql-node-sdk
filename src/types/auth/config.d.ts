/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { NoSQLClient } from "../nosql_client";
import type { Operation } from "../param";
import type { Config } from "../config";
import type { IAMConfig } from "./iam/types";
import type { IAMAuthorizationProvider } from "./iam/auth_provider";
import type { KVStoreAuthConfig } from "./kvstore/types";
import type { KVStoreAuthorizationProvider } from "./kvstore/auth_provider";
import type { ServiceType } from "../constants";

/**
 * Authorization configuration for the driver provided as {@link Config#auth}
 * when {@link NoSQLClient} instance is created.
 * <p>
 * Every request to the server made by {@link NoSQLClient} methods requires
 * authorization information.  The way authorization information is obtained
 * depends on the {@link ServiceType} used (set as
 * {@link Config#serviceType}):
 * <ul>
 * <li>For {@link ServiceType.CLOUD}, authorization information is obtained
 * using Oracle Cloud Infrastructure Identity and Access Management (IAM). To
 * enable authorization, you must set {@link iam} property to IAM
 * configuration object in the form of {@link IAMConfig}. Alternatively, you
 * may set {@link provider} property to an instance of
 * {@link IAMAuthorizationProvider}. The only exception to this is if using
 * default default OCI configuration file and default profile name, in which
 * case you need not specify {@link Config#auth} property (see
 * {@link IAMConfig} and {@link ServiceType}).</li>
 * <li>For {@link ServiceType.CLOUDSIM}, authorization is not required and
 * you do not need to specify {@link Config#auth} property.</li>
 * <li>For {@link ServiceType.KVSTORE}, if using secure store, you need to
 * set {@link kvstore} property to specify the store authentication
 * information such as user name and password in the form of
 * {@link KVStoreAuthConfig}. Alternatively, you may set {@link provider}
 * property to an instance of {@link KVStoreAuthorizationProvider}.
 * <p>
 * If using non-secure store, authorization is not required and you do not
 * need to specify {@link Config#auth} property.</li>
 * <li>You may also choose to implement your own authorization provider to
 * obtain authorization information for each request. In this case, set
 * {@link provider} property to this provider's instance. If the provider is
 * set, {@link ServiceType} can be undefined, although it may also be possible
 * to have custom provider for existing service types.</li>
 * </ul>
 * <p>
 * Note that you must specify only one of {@link AuthConfig#iam},
 * {@link AuthConfig#kvstore} or {@link AuthConfig#provider} properties.
 */
export interface AuthConfig {
    /**
     * IAM configuration, see {@link IAMConfig}. Must be set to use Oracle
     * NoSQL Cloud service.
     * @see {@link IAMConfig}
     */
    iam?: IAMConfig;

    /**
     * Configuration to authenticate with secure On-Premise NoSQL database.
     * Must be set to connect to secure store.
     * @see {@link KVStoreAuthConfig}
     */
    kvstore?: KVStoreAuthConfig;
    
    /**
     * Custom authorization provider.
     * @see {@link AuthorizationProvider}
     */
    provider?: AuthorizationProvider |
        AuthorizationProvider['getAuthorization'];
}

/**
 * Represents the authorization information obtained by
 * {@link AuthorizationProvider#getAuthorization} method. This information
 * may be returned as either a string or an object:
 * <ul>
 * <li>If represented as a <em>string</em>, it will be used as a value of HTTP
 * <em>Authorization</em> header for the service request.</li>
 * <li>If represented as an <em>object</em>, this object's properties will be
 * added as HTTP headers for the service request.</li>
 * </ul>
 * The specifics depend on the authorization protocol.
 */
export type AuthResult = string | { [name: string]: string };

/**
 * AuthorizationProvider is an interface to obtain authorization information
 * for NoSQL database operation. By default, the driver will use built-in
 * authorization providers, such as {@link IAMAuthorizationProvider} and
 * {@link KVStoreAuthorizationProvider} based on specified {@link ServiceType}
 * and/or presense of service-specific configurations such as
 * {@link IAMConfig} and {@link KVStoreAuthConfig} as properties
 * {@link AuthConfig#iam} and {@link AuthConfig#kvstore} of
 * {@link AuthConfig}. Alternatively, an application may choose to
 * use custom authorization provider that implements
 * {@link AuthorizationProvider} interface and set it as
 * {@link AuthConfig#provider} property of {@link AuthConfig}. Instead of a
 * class implementing this interface, you may also set
 * {@link AuthConfig#provider} to a function with the signature of
 * {@link AuthorizationProvider#getAuthorization}.
 */
export interface AuthorizationProvider {
    /**
     * Method to asynchronously obtain authorization information in the form
     * of {@link AuthResult}.
     * @async
     * @param op {@link Operation} that requires authorization
     * @returns {Promise} Promise resolved with {@link AuthResult} or rejected
     * with an error
     */
    getAuthorization(op: Operation): Promise<AuthResult>;

    /**
     * Optional callback called when {@link NoSQLClient} instance is
     * initialized. Allows access to the information in the {@link Config}.
     * @param config {@link Config} object used to create {@link NoSQLClient}
     * instance.
     */
    onInit?(config: Config): void;

    /**
     * Releases resources held by this provider.
     * <p>
     * This method only needs to be implemented if the provider needs to
     * release resources such as connections, open files, etc. when the
     * instance of {@link NoSQLClient} is no longer needed.
     * <p>
     * After this provider instance is passed to {@link NoSQLClient} via
     * {@link AuthConfig}, the driver will invoke this method when
     * calling {@link NoSQLClient#close} method of {@link NoSQLClient}, so
     * applications should not call this method (unless this provider is
     * used standalone).
     * <p>
     * This method can be either sync or async depending on the resources
     * that need to be released.  If a <em>Promise</em> is returned, it can
     * be awaited when calling {@link NoSQLClient#close} method of
     * {@link NoSQLClient}.
     * <p>
     * Implementations of this method should not throw errors or result in
     * promise rejections (rather, any errors should be handled within the
     * implementation).
     */
    close?(): void | Promise<void>;
}
