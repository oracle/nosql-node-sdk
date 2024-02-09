/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

/**
 * Defines types used for NoSQL driver configuration for Oracle Cloud
 * Infrastructure Identity and Access Management (IAM).
 */

import type { Config } from "../../config";
import type { AuthConfig } from "../config";
import type { IAMAuthorizationProvider } from "./auth_provider";

/**
 * This type encapsulates credentials required for generating OCI request
 * signature. It is used as a return type for
 * {@link IAMCredentialsProvider#loadCredentials} in
 * {@link IAMCredentialsProvider}.  The properties of this type are the same
 * as in {@link IAMConfig} when credentials are provided directly.  See
 * {@link IAMConfig} for more information.
 * <p>
 * When returning this object, you have choices to return <em>privateKey</em>
 * or <em>privateKeyFile</em> and to return {@link !Buffer | Buffer} or
 * <em>string</em> for fields indicated as such.
 *
 * @see {@link IAMConfig}
 * @see {@link IAMCredentialsProvider}
 */
export interface IAMCredentials {
    /**
     * Tenancy OCID.
     */
    tenantId: string;
    
    /**
     * User OCID.
     */
    userId: string;
    
    /**
     * Public key fingerprint.
     */
    fingerprint: string;
    
    /**
     * PEM-encoded private key data. If specified as {@link !Buffer | Buffer},
     * you may clear the buffer contents afer {@link NoSQLClient} instance is
     * created for added security.  Note that only one of {@link privateKey}
     * or {@link privateKeyFile} properties may be specified.
     */
    privateKey?: string|Buffer;
    
    /**
     * Path to PEM private key file. Path may be absolute or relative to
     * current directory.  May be <em>string</em> or UTF-8 encoded
     * {@link !Buffer | Buffer}. Note that only one of {@link privateKey} or
     * {@link privateKeyFile} properties may be specified.
     */
    privateKeyFile?: string|Buffer;
    
    /**
     * Passphrase for the private key if it is encrypted.  If specified as
     * {@link !Buffer | Buffer}, you may clear the buffer contents after
     * {@link NoSQLClient} instance is created for added security.
     */
    passphrase?: Buffer|string; 
}

/**
 * {@link IAMConfig} is required to authorize operations using Oracle Cloud
 * Infrastructure Identity and Access Management (IAM).  It should be set as
 * {@link AuthConfig#iam}.
 * <p>
 * See {@link https://docs.cloud.oracle.com/iaas/Content/Identity/Concepts/overview.htm | Overview of Oracle Cloud Infrastructure Identity and Access Management}
 * for information on IAM components and how they work together to provide
 * security for Oracle Cloud services.
 * <p>
 * All operations require a request signature that is used by the system to
 * authorize the operation.  The request signature may be created in one of
 * the following ways:
 * <ol>
 * <li>Using specific user's indentity.  See information below on what
 * credentials are required and how to obtain them, as well as the ways these
 * credentials may be provided to the driver via {@link IAMConfig}.</li>
 * <li>Using Instance Principal.  You may use Instance Principal when
 * calling Oracle NoSQL Database Cloud Service from a compute instance in the
 * Oracle Cloud Infrastructure (OCI). See
 * {@link https://docs.cloud.oracle.com/en-us/iaas/Content/Identity/Tasks/callingservicesfrominstances.htm | Calling Services from an Instance}
 * for more information.  Use Instance Principal by setting
 * {@link IAMConfig#useInstancePrincipal} property to true.</li>
 * <li>Using Resource Principal.  You may use Resource Principal when calling
 * Oracle NoSQL Database Cloud Service from other Oracle Cloud service
 * resource such as
 * {@link https://docs.cloud.oracle.com/en-us/iaas/Content/Functions/Concepts/functionsoverview.htm | Functions}.
 * See
 * {@link https://docs.cloud.oracle.com/en-us/iaas/Content/Functions/Tasks/functionsaccessingociresources.htm | Accessing Other Oracle Cloud Infrastructure Resources from Running Functions}
 * for more information.  Use Resouce Principal by setting
 * {@link IAMConfig#useResourcePrincipal} property to true.</li>
 * </ol>
 * <p>
 * When using specific user's identity, if you don't specify compartment,
 * a default compartment will be used, which is a a root compartment of the
 * user's tenancy.  You can also specify compartment, either as
 * {@link Config#compartment} property of initial configuration or as part of
 * options for each request. You may specify either compartment OCID or
 * compartment name. If using compartment name, you can also provide it as a
 * prefix to the table name as in <em>compartmentName.tableName</em>.
 * <p>
 * When using Instance Principal or Resource Principal, there is no default
 * compartment, so you must specify compartiment id (OCID), either as
 * {@link Config#compartment} property of the initial configuration or as part
 * of options for each request. Note that you must use compartment id (OCID)
 * and not compartment name. This also means that you may not prefix table
 * name with compartment name when calling methods of {@link NoSQLClient}.
 * The only exception to this is when using Resource Principal together with
 * {@link useResourcePrincipalCompartment} property, in which case the
 * resource compartment itself will be used.
 * <p>
 * To use specific user's identity, you must provide the following credentials:
 * <ul>
 * <li>Tenancy OCID.  This is Oracle Cloud ID (OCID) for your tenancy.  See
 * {@link https://docs.cloud.oracle.com/iaas/Content/General/Concepts/identifiers.htm | Resource Identifiers}
 * for information on OCIDs.</li>
 * <li>User's OCID.  This is Oracle Cloud ID (OCID) for the user in your
 * tenancy.  See
 * {@link https://docs.cloud.oracle.com/iaas/Content/General/Concepts/identifiers.htm | Resource Identifiers}
 * for information on OCIDs.</li>
 * <li>API Signing Key.  This is public-private key pair used to sign the API
 * requests, see {@link https://docs.cloud.oracle.com/iaas/Content/API/Concepts/apisigningkey.htm | Required Keys and OCIDs}.
 * In particular, private key is needed to generate the request signature.</li>
 * <li>Public Key Fingerprint.  This is an identifier of the public key of the
 * API Signing Key pair.</li>
 * <li>Passphrase for the private key of API Signing Key pair if the private
 * key is encrypted.</li>
 * </ul>
 * <p>
 * See {@link https://docs.cloud.oracle.com/iaas/Content/API/Concepts/apisigningkey.htm | Required Keys and OCIDs}
 * for detailed description of the above credentials and the steps you need to
 * perform to enable signing of API requests, which are:
 * <ul>
 * <li>Generate the key pair described above.</li>
 * <li>Upload public key.</li>
 * <li>Obtain tenancy and user OCIDs and public key fingerprint.</li>
 * </ul>
 * <p>
 * You may provide these credentials in one of the following ways, in order of
 * increased security:
 * <ul>
 * <li>Directly as properties of {@link IAMConfig}.
 * In this case, set properties {@link tenantId}, {@link userId},
 * {@link privateKey} or {@link privateKeyFile}, {@link fingerprint} and
 * {@link passphrase} (if private key is encrypted)</li>
 * <li>As part of an OCI configuration file.  See
 * {@link https://docs.cloud.oracle.com/iaas/Content/API/Concepts/sdkconfig.htm | SDK and CLI Configuration File}
 * for information on OCI configuration file and what entries are used for the
 * required credentials.  In this case, you may set properties
 * {@link configFile} and/or {@link profileName}.  If not set,
 * appropriate default values will be used, see property descriptions.</li>
 * <li>Specify your own credentials provider in the form of
 * {@link IAMCredentialsProvider}.  This allows you to store and retrieve
 * credentials in a secure manner.  In this case, specify
 * {@link credentialsProvider} property.</li>
 * </ul>
 * Note that the private key must be in PEM format.  You may provide a path
 * to the PEM key file.  Alternatively, except when using OCI configuration
 * file, you may provide PEM encoded private key directly as
 * {@link !Buffer | Buffer} or <em>string</em>. Note that the
 * {@link passphrase} must be provided if the private key is encrypted.
 * <p>
 * <p>
 * The driver will determine the method of authorization as follows:
 * <ol>
 * <li>If {@link IAMConfig#useResourcePrincipal} is set to <em>true</em>, then
 * Resource Principal authentication will be used.</li>
 * <li>If {@link IAMConfig#useInstancePrincipal} is set to <em>true</em>, then
 * Instance Principal authentication will be used.  You may also set
 * {@link IAMConfig#federationEndpoint}, although it is not requred and in
 * most cases federation endpoint will be auto-detected.</li>
 * <li>If {@link useSessionToken} is set to <em>true</em>, then session
 * token-based authentication will be used. Note that this method uses OCI
 * config file, so settings to properties {@link configFile} and
 * {@link profileName} also apply. See {@link useSessionToken} for more
 * information.
 * <li>If {@link IAMConfig} has any of user identity properties such as
 * {@link tenantId}, {@link userId}, {@link privateKey}, {@link fingerprint}
 * or {@link passphrase}, the driver assumes that you are using a specific
 * user's identity and that the credentials are provided directly in
 * {@link IAMConfig}.  All required user's credentials, as described above,
 * must be present as properties of {@link IAMConfig}, otherwise
 * {@link NoSQLArgumentError} will result.</li>
 * <li>If {@link IAMConfig} has {@link credentialsProvider} property, the
 * driver assumes that you are using a specific user's identity and the
 * credentials are obtained through the credentials provider which must be in
 * the form of {@link IAMCredentialsProvider}.  In this case the credentials
 * must not be set directly in {@link IAMConfig}.</li>
 * <li>If none of the above, the driver assumes that you are using a specific
 * user's identity and the credentials are stored in OCI config
 * file and will use {@link configFile} and {@link profileName} properties
 * if present, otherwise it will assume their default values.  In particular,
 * if you specify {@link Config#serviceType} as {@link ServiceType.CLOUD}
 * and omit {@link Config#auth} alltogether, the driver will use IAM
 * authorization with default OCI config file and default profile name.</li>
 * </ol>
 * <p>
 * Note that if using an OCI configuration file, you may also specify region
 * identifier in the same profile as your credentials.  In this case, you need
 * not specify either region or endpoint in {@link Config}.  In particular,
 * if you use the default OCI config file (<em>~/.oci/config</em>) and default
 * profile name (<em>DEFAULT</em>) and do not need to customize any other
 * configuration properties, you may create {@link NoSQLClient} instance
 * without providing configuration to {@link NoSQLClient} constructor.
 * See {@link NoSQLClient} for more information.
 * <p>
 * If using Resource Principal, you also need not specify either region or
 * endpoint in {@link Config}, as Resource Principal's region will be used.
 * In fact, when running in Functions service, you may only access NoSQL
 * service in the same region as the running function, so when using Resource
 * Principal, it is preferable not to specify either region or endpoint in
 * {@link Config}.
 * <p>
 * Generated authorization signature is valid for a period of time and is
 * cached for effeciency.  The caching behavior may be customized with
 * properties {@link IAMConfig#durationSeconds} and
 * {@link IAMConfig#refreshAheadMs}. See their property descriptions for
 * details.
 *
 * @see {@link AuthConfig}
 * @see {@link IAMAuthorizationProvider}
 * @see {@link IAMCredentials}
 * @see {@link IAMCredentialsProvider}
 * @see {@page connect-cloud.md}
 *
 * @example
 * JSON {@link Config} object supplying user's credentials directly
 * (sensitiveinfo not shown).
 * ```json
 * {
 *     "region": "us-phoenix-1",
 *     "auth": {
 *         "iam": {
 *             "tenantId": "ocid1.tenancy.oc...................",
 *             "userId": "ocid1.user.oc.....................",
 *             "fingerprint": "aa:aa:aa:aa:.....",
 *             "privateKeyFile": "~/myapp/security/oci_api_key.pem",
 *             "passphrase": "..............."
 *         }
 *     }
 * }
 * ```
 *
 * @example
 * JSON {@link Config} object supplying user's credentials through OCI
 * configuration file.
 * ```json
 * {
 *     "region": "us-phoenix-1",
 *     "auth": {
 *         "iam": {
 *             "configFile": "~/myapp/.oci/config",
 *             "profileName": "John"
 *         }
 *     }
 * }
 * ```
 * 
 * @example
 * Javascript {@link Config} object supplying user's credentials via custom
 * credentials provider.
 * ```js
 * {
 *     region: "us-phoenix-1",
 *     auth: {
 *         iam: {
 *             credentialsProvider: async () => {
 *                 .......... //retrieve credentials somehow
 *                 ..........
 *                 return {
 *                     tenantId: myTenantId,
 *                     userId: myUserId,
 *                     fingerprint: myFingerprint,
 *                     privateKey: myPrivateKey,
 *                     passphrase: myPassphrase
 *                 };
 *             }
 *         }
 *     }
 * }
 * ```
 * 
 * @example
 * JSON {@link Config} object using Instance Principal.
 * ```json
 * {
 *     "region": "us-phoenix-1",
 *     "compartment": "ocid1.compartment.oc1.............................",
 *     "auth": {
 *         "iam": {
 *             "useInstancePrincipal": "true"
 *         }
 *     }
 * }
 * ```
 * 
 * @example
 * Javascript {@link Config} object when using Resource Principal
 * ```js
 * {
 *     compartment: "ocid1.compartment.oc1.............................",
 *     auth: {
 *         iam: {
 *             useResourcePrincipal: true
 *         }
 *     }
 * }
 * ```
 * @example
 * Javascript {@link Config} object when using Resource Principal with
 * {@link useResourcePrincipalCompartment} property. 
 * ```js
 * {
 *     auth: {
 *         iam: {
 *             useResourcePrincipal: true,
 *             useResourcePrincipalCompartment: true
 *         }
 *     }
 * }
 * ```
 */
export interface IAMConfig extends Partial<IAMCredentials> {
    /**
     * If set to true, Instance Principal authorization will be used. May not
     * be combined with {@link useResourcePrincipal} or any properties used
     * for specific user's identity.
     */
    useInstancePrincipal?: boolean;
    
    /**
     * When using Instance Principal, specifies endpoint to use to communicate
     * with authorization server. Usually this does not need to be specified
     * as the driver will detect the federation endpoint automatically.
     * Specify this if you need to override the default federation endpoint.
     * The endpoint must be in the form
     * <em>https://auth.\{region-identifier\}.\{second-level-domain\}</em>,
     * e.g. <em>https://auth.ap-hyderabad-1.oraclecloud.com</em>.
     */
    federationEndpoint?: string|URL;
    
    /**
     * Used only with instance principal (see <em>useInstancePrincipal</em>).
     * The delegation token allows the instance to assume the privileges of
     * the user for which the token was created and act on behalf of that
     * user. Use this property to specify the value of the delegation token
     * directly. Otherwise, to use a provider interface or obtain a token
     * from a file, use {@link delegationTokenProvider} and
     * {@link delegationTokenFile} properties. This property is exclusive with
     * {@link delegationTokenProvider} and {@link delegationTokenFile}.
     */
    delegationToken?: string;
    
    /**
     * Used only with instance principal (see {@link useInstancePrincipal}).
     * The delegation token allows the instance to assume the privileges of
     * the user for which the token was created and act on behalf of that
     * user. This propertiy specifies {@link DelegationTokenProvider} as a
     * custom provider used to load the delegation token. The delegation
     * token will be reloaded each time the authorization signature is
     * refreshed. If specified as a string, this property is equivalent to
     * {@link delegationTokenFile}. This property is exclusive with
     * {@link delegationToken} and {@link delegationTokenFile}.
     */
    delegationTokenProvider?: DelegationTokenProvider |
        DelegationTokenProvider["loadDelegationToken"] | string;

    /**
     * Used only with instance principal (see {@link useInstancePrincipal}).
     * The delegation token allows the instance to assume the privileges of
     * the user for which the token was created and act on behalf of that
     * user. This property specifies a file path (absolute or relative) to
     * load the delegation token from. The delegation token will be reloaded
     * from the file each time the authorization signature is refreshed. This
     * property is exclusive with {@link delegationToken} and
     * {@link delegationTokenFile}.
     */
    delegationTokenFile?: string;
    
    /**
     * If set to true, Resource Principal authorization will be used. May not
     * be combined with {@link useInstancePrincipal} or any properties used
     * for specific user's identity.
     */
    useResourcePrincipal?: boolean;

    /**
     * Only valid when using Resource Principal. If set to true, and
     * compartment id is not specified in the configuration or as a part of
     * operation options, the driver will use the compartment of the resource,
     * obtained from the resource principal session token, as the default
     * compartment for NoSQL database operations. This property is useful,
     * e.g. if you want your NoSQL database tables to reside in the same
     * compartment as your OCI function.
     */
    useResourcePrincipalCompartment?: boolean;

    /**
     * If set to true,
     * {@link https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdk_authentication_methods.htm#sdk_authentication_methods_session_token | Session Token-Based Authentication}
     * will be used. This method uses temporary session token read from a
     * token file. The path of the token file is read from a profile in OCI
     * configuration file as the value of field <em>security_token_file</em>.
     * See
     * {@link https://docs.oracle.com/en-us/iaas/Content/API/Concepts/sdkconfig.htm | SDK Configuration File} for details of the file's contents and format. In
     * addition, see the description of {@link IAMConfig} above.
     * <p>
     * Because this method uses OCI Configuration File, you may use the
     * properties {@link configFile} and {@link profileName} to specify the
     * path to the configuration file and the profile name within the
     * configuration file. The same defaults apply.
     * <p>
     * For session token-based authentication, the properties required in the 
     * OCI config file by the driver are <em>tenancy</em> for tenant OCID,
     * <em>security_token_file</em> for security token file and
     * <em>key_file</em> for private key file.
     * You may also specify <em>pass_phrase</em> property for private key
     * passphrase as well as <em>region</em> property (instead of specifying
     * {@link Config#region} property in the {@link Config} as previously
     * described).
     * <p>
     * You can use the OCI CLI to authenticate and create a token, see
     * {@link https://docs.oracle.com/en-us/iaas/Content/API/SDKDocs/clitoken.htm" | Token-based Authentication for the CLI}.
     * <p>
     */
    useSessionToken?: boolean;

    /**
     *  OCI configuration file path. May be absolute or relative to current
     * directory.  May be <em>string</em> or UTF-8 encoded
     * {@link !Buffer | Buffer}.
     * @defaultValue Path "\~/.oci/config", where "\~" represents user's home
     * directory on Unix systems and %USERPROFILE% directory on Windows
     * (see USERPROFILE environment variable).
     */
    configFile?: string|Buffer;

    /**
     * Profile name within the OCI configuration file, used only if
     * credentials are obtained from the configuration file as described.
     * @defaultValue If not set, the name "DEFAULT" is used.
     */
    profileName?: string;

    /**
     * Custom credentials provider to use to obtain credentials in the form of
     * {@link IAMCredentials}. You may also specify string for a module name
     * or path that exports {@link IAMCredentialsProvider}.
     * @see {@link IAMCredentialsProvider}
     */
    credentialsProvider?: IAMCredentialsProvider |
        IAMCredentialsProvider["loadCredentials"] | string;

    /**
     * Cache duration of the signature in seconds. Specifies how long cached
     * signature may be used before new one has to be created. Maximum allowed
     * duration is 5 minutes (300 seconds), which is also the default.
     * @defaultValue 300 (5 minutes)
     */
    durationSeconds?: number;

    /**
     * Tells the driver when to automatically refresh the signature before its
     * expiration in the cache, measured in number of milliseconds before
     * expiration.  E.g. value 10000 means that the driver will attempt to
     * refresh the signature 10 seconds before its expiration. Using refresh
     * allows to avoid slowing down of database operations by creating the
     * signature asynchronously.  You can set this property to <em>null</em>
     * to disable automatic refresh.
     * @defaultValue 10000 (10 seconds)
     */
    refreshAheadMs?: number|null;

    /**
     * Timeout in milliseconds used for requests to the authorization server.
     * Currently this is only used with Instance Principal.
     * @defaultValue 120000 (2 minutes)
     */
    timeout?: number;
}

/**
 * You may implement {@link IAMCredentialsProvider} interface to securely
 * obtain credentials required for generation of OCI request signature, as
 * described in {@link IAMConfig}. {@link IAMCredentialsProvider} is
 * set as {@link IAMConfig#credentialsProvider} property of {@link IAMConfig}.
 * Instead of a class implementing this interface, you may also set
 * {@link IAMConfig#credentialsProvider} to function with the signature of
 * {@link loadCredentials}.
 * @see {@link IAMCredentials}
 * @see {@link IAMConfig}
 * @see {@page connect-cloud.md}
 */
export interface IAMCredentialsProvider {
    /**
     * Asynchronously load credentials required for generating OCI request
     * signature. 
     * @async
     * @returns {Promise} Promise resolved with {@link IAMCredentials} or
     * rejected with an error. Properties of type {@link !Buffer | Buffer}
     * such as {@link IAMCredentials#privateKey} or
     * {@link IAMCredentials#passphrase} will be erased once the signature is
     * generated.
     */
    loadCredentials(): Promise<IAMCredentials>;
}

/**
 * You may implement {@link DelegationTokenProvider} interface to securely
 * obtain delegation token when using instance principal.
 * {@link DelegationTokenProvider} may be set as
 * {@link IAMConfig#delegationTokenProvider} of {@link IAMConfig}. Instead of
 * a class implementing this interface, you may also set
 * {@link IAMConfig#delegationTokenProvider} to a function with the signature
 * of {@link loadDelegationToken}.
 * @see {@link loadDelegationToken}
 * @see {@link IAMConfig#delegationToken}
 */
export interface DelegationTokenProvider {
    /**
     * Asynchronously load delegation token.
     * @async
     * @returns {Promise} Promise resolved with a <em>string</em> delegation
     * token or rejected with an error
     */
    loadDelegationToken(): Promise<string>;
}
