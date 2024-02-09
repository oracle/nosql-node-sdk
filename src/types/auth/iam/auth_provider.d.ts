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
import type { IAMConfig, DelegationTokenProvider } from "./types";

/**
 * Claims available in resource principal session token (RPST), which can be
 * retrieved by calling
 * {@link IAMAuthorizationProvider#getResourcePrincipalClaims}.
 * @see {@link IAMAuthorizationProvider#getResourcePrincipalClaims}
 */
export interface ResourcePrincipalClaims {
    /**
     * Resource tenant OCID, if available.
     */
    tenantId?: string;

    /**
     * Resource compartment OCID, if available.
     */
    compartmentId?: string;
}

/**
 * Authorization provider used to to authorize operations using Oracle Cloud
 * Infrastructure Identity and Access Management (IAM).
 * <p>
 * The driver uses this class internally for authorization with the Cloud
 * Service. Normally, you do not need to use this class. Instead, create
 * {@link NoSQLClient} instance by specifying {@link AuthConfig#iam} property
 * in {@link AuthConfig} as part of {@link Config#auth}, as described in
 * {@link IAMConfig}.
 * <p>
 * You may use this class as an alternative to specifying
 * {@link AuthConfig#iam}, as this may allow additional operations, e.g.
 * retrieving resource principal claim information. Use this class as a value
 * for {@link AuthConfig#provider} property when creating {@link NoSQLClient}
 * instance. This is shown in the example.
 * 
 * @see {@link IAMConfig}
 * @see {@link AuthConfig}
 * 
 * @example
 * Using IAMAuthorizationProvider when creating NoSQLClient instance.
 * 
 * const client = new NoSQLClient({
 *     region: Region.US_PHOENIX_1,
 *     compartment: "ocid1.compartment.oc1.............................",
 *     auth: {
 *         provider: new IAMAuthorizationProvider({
 *             configFile: "~/myapp/.oci/config",
 *             profileName: "Jane"
 *         })
 *     }
 * });
 */
export class IAMAuthorizationProvider implements AuthorizationProvider {

    /**
     * Initializes a new instance of {@link IAMAuthorizationProvider}.
     * @param config Configuration to create {@link IAMAuthorizationProvider}
     * specified as {@link IAMConfig}. You may omit this parameter (use
     * no-argument constructor) if using cloud service with the default
     * OCI configuration file with default profile name that contains
     * credentials and region identifier, as described in {@link IAMConfig}.
     * @throws {NoSQLArgumentError} if the configuration is has invalid
     * properties
     * @see {@link IAMConfig}
     */
    constructor(config?: IAMConfig);

    /**
     * A convenience method to create new instance of
     * {@link IAMAuthorizationProvider} using Instance Principal.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link IAMConfig}.
     * @param federationEndpoint Optional federation endpoint. See
     * {@link IAMConfig#federationEndpoint}.
     * @returns New instance of {@link IAMAuthorizationProvider} using
     * Instance Principal
     * @see {@link IAMConfig#useInstancePrincipal}
     */
    static withInstancePrincipal(federationEndpoint?: string):
        IAMAuthorizationProvider;

    /**
     * @overload
     * A convenience method to create new instance of
     * {@link IAMAuthorizationProvider} using Instance Principal with
     * delegation token.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link IAMConfig}.
     * @param delegationToken Delegation token
     * @param federationEndpoint Optional federation endpoint. See
     * {@link IAMConfig#federationEndpoint}
     * @returns New instance of {@link IAMAuthorizationProvider} using
     * Instance Principal and specified delegation token
     * @see {@link IAMConfig#useInstancePrincipal}
     * @see {@link IAMConfig#delegationToken}
     */
    static withInstancePrincipalForDelegation(
        delegationToken: string, federationEndpoint?: string):
        IAMAuthorizationProvider;

    /**
     * @overload
     * A convenience method to create new instance of
     * {@link IAMAuthorizationProvider} using Instance Principal with
     * delegation token provider.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link IAMConfig}.
     * @param delegationTokenProvider Delegation token provider
     * @param federationEndpoint Optional federation endpoint. See
     * {@link IAMConfig#federationEndpoint}
     * @returns New instance of {@link IAMAuthorizationProvider} using
     * Instance Principal and specified delegation token provider
     * @see {@link IAMConfig#useInstancePrincipal}
     * @see {@link IAMConfig#delegationTokenProvider}
     */
    static withInstancePrincipalForDelegation(
        delegationTokenProvider: DelegationTokenProvider,
        federationEndpoint?: string): IAMAuthorizationProvider;

    /**
     * A convenience method to create new instance of
     * {@link IAMAuthorizationProvider} using Instance Principal with
     * delegation token file.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link IAMConfig}.
     * @param delegationTokenFile Delegation token file
     * @param federationEndpoint Optional federation endpoint. See
     * {@link IAMConfig#federationEndpoint}
     * @returns New instance of {@link IAMAuthorizationProvider} using
     * Instance Principal and specified delegation token file
     * @see {@link IAMConfig#useInstancePrincipal}
     * @see {@link IAMConfig#delegationTokenFile}
     */
    static withInstancePrincipalForDelegationFromFile(
        delegationTokenFile: string, federationEndpoint?: string):
        IAMAuthorizationProvider;

    /**
     * A convenience method to create new instance of
     * {@link IAMAuthorizationProvider} using Resource Principal.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link IAMConfig}.
     * @param useResourcePrincipalCompartment Whether to use the resource
     * compartment as default compartment for NoSQL Database operations.
     * Defaults to false. See
     * {@link IAMConfig#useResourcePrincipalCompartment}
     * @returns New instance of {@link IAMAuthorizationProvider} using
     * Resource Principal
     * @see {@link IAMConfig}
     */
    static withResourcePrincipal(useResourcePrincipalCompartment?: boolean):
        IAMAuthorizationProvider;

    /**
     * @overload
     * A convenience method to create new instance of
     * {@link IAMAuthorizationProvider} for session token-based authentication
     * using default OCI configuration file and specified or default profile
     * name.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link IAMConfig}.
     * @param profileName Optional profile name in the default OCI
     * configuration file. Defaults to value "DEFAULT"
     * @returns New instance of {@link IAMAuthorizationProvider} using session
     * token-based authentication
     * @see {@link IAMConfig#configFile}
     * @see {@link IAMConfig#profileName}
     */
    static withSessionToken(profileName?: string): IAMAuthorizationProvider;

    /**
     * @overload
     * A convenience method to create new instance of
     * {@link IAMAuthorizationProvider} for session token-based
     * authentication using specified OCI configuration file and profile name.
     * <p>
     * Other applicable properties are initialized to their defaults as
     * described in {@link IAMConfig}.
     * @param configFile OCI configuration file path. See
     * {@link IAMConfig#configFile}
     * @param profileName Optional profile name in the default OCI
     * configuration file. Defaults to value "DEFAULT"
     * @returns New instance of {@link IAMAuthorizationProvider} using session
     * token-based authentication
     * @see {@link IAMConfig#configFile}
     * @see {@link IAMConfig#profileName}
     */
    static withSessionToken(configFile: string, profileName?: string):
        IAMAuthorizationProvider;

    /**
     * Asynchronously acquires authorization information. This method is only
     * used by the driver. You do not need to call this method. This method
     * can only be used after {@link onInit} is called.
     * @async
     * @param {Operation} op {@link Operation} that requires authorization
     * @returns {Promise} Promise resolved with authorization information or
     * rejected with an error
     */
    getAuthorization(op: Operation): Promise<AuthResult>;

    /**
     * If using Resource Principal, gets the claims information in the
     * resource principal session token (RPST) such as the resource tenant and
     * compartment OCIDs.
     * @async
     * @returns {Promise} If using Resource Principal, promise of
     * {@link ResourcePrincipalClaims} containing RPST claim information,
     * otherwise promise of <em>undefined</em>.
     */
    getResourcePrincipalClaims():
        Promise<ResourcePrincipalClaims | undefined>;

    /**
     * Initialization callback.
     * @param config {@link Config} object used to create {@link NoSQLClient}
     * instance.
     * @see {@link AuthorizationProvider#onInit}
     */
    onInit(config: Config): void;

    /**
     * Releases resources held by this provider.
     * @see {@link AuthorizationProvider#close}
     */
    close(): void | Promise<void>;
}
