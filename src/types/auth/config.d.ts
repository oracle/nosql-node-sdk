/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { Operation } from "../param";
import type { Config } from "../config";
import type { IAMConfig } from "./iam/types";
import type { KVStoreAuthConfig } from "./kvstore/types";

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
 * using Oracle Cloud Infrastructure Identity and Access Management (IAM).  To
 * enable authorization, you must set IAM configuration in the form of
 * {@link IAMConfig} as {@link AuthConfig#iam} property.</li>
 * <li>For {@link ServiceType.CLOUDSIM}, authorization is not required and
 * you do not need to specify {@link Config#auth} property.</li>
 * <li>For {@link ServiceType.KVSTORE}, if using secure store, you need to
 * specify the store authentication information such as user name and password
 * as {@link AuthConfig#kvstore} property in the form of
 * {@link KVStoreAuthConfig}.  If using non-secure store, authorization is not
 * required and you do not need to specify {@link Config#auth} property.</li>
 * <li>You may also choose to implement your own authorization provider to
 * obtain authorization information for each request depending on the
 * operation performed.  In this case, set this provider as
 * {@link AuthConfig#provider} property.  If the provider is set,
 * {@link ServiceType} can be undefined, although it may also be possible to
 * have custom provider for existing service types.</li>
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
    provider?: AuthorizationProvider;
}

/**
 * Interface to asynchornously acquire authorization information.
 * It takes as parameter an {@link Operation} that requires authorization.
 * Authorization information may be returned as a string or as an object:
 * <ul>
 * <li>If represented as a <em>string</em>, it will be used as a value of HTTP
 * <em>Authorization</em> header for the service request.</li>
 * <li>If represented as an <em>object</em>, this object's properties will be
 * added as HTTP headers for the service request.</li>
 * </ul>
 * The specifics depend on the authorization protocol used.
 * @async
 * @param {Operation} op {@link Operation} that requires authorization
 * @returns {Promise} Promise resolved with authorization as described or
 * rejected with an error
 */
export type getAuthorization = (op: Operation) =>
    Promise<string | { [name: string]: string }>;

/**
 * AuthorizationProvider is an interface to obtain authorization information
 * for NoSQL database operation.  By default, the driver will use its own
 * authorization providers based on specified {@link ServiceType} and/or
 * presense of service-specific configurations such as {@link IAMConfig} and
 * {@link KVStoreAuthConfig}.  Alternatively, the application may choose to
 * use custom authorization provider and set it as {@link AuthConfig#provider}
 * property.  This custom provider may be specified either as a
 * {@link getAuthorization} function or as an object implementing
 * {@link getAuthorization} function.
 */
export type AuthorizationProvider = getAuthorization |
    { getAuthorization: getAuthorization };
