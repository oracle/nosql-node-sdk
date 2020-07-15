/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/**
 * Defines types used for NoSQL driver configuration for Oracle Cloud
 * Infrastructure Identity and Access Management (IAM).
 */

/**
 * {@link IAMConfig} is required to authorize operations using Oracle Cloud
 * Infrastructure Identity and Access Management (IAM).  It should be set as
 * {@link AuthConfig}#iam.
 * <p>
 * See [Overview of Oracle Cloud Infrastructure Identity and Access Management]{@link https://docs.cloud.oracle.com/iaas/Content/Identity/Concepts/overview.htm}
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
 * [Calling Services from an Instance]{@link https://docs.cloud.oracle.com/en-us/iaas/Content/Identity/Tasks/callingservicesfrominstances.htm}
 * for more information.  Use Instance Principal by setting
 * {@link IAMConfig}#useInstancePrincipal property to true.</li>
 * <li>Using Resource Principal.  You may use Resource Principal when calling
 * Oracle NoSQL Database Cloud Service from other Oracle Cloud service
 * resource such as
 * [Functions]{@link https://docs.cloud.oracle.com/en-us/iaas/Content/Functions/Concepts/functionsoverview.htm}.
 * See
 * [Accessing Other Oracle Cloud Infrastructure Resources from Running Functions]{@link https://docs.cloud.oracle.com/en-us/iaas/Content/Functions/Tasks/functionsaccessingociresources.htm}
 * for more information.  Use Resouce Principal by setting
 * {@link IAMConfig}#useResourcePrincipal property to true.</li>
 * </ol>
 * <p>
 * Note that when using Instance Principal or Resource Principal you must
 * specify compartiment id (OCID), either as
 * {@link Config}#compartment property of the initial configuration or as
 * <em>opt.compartment</em> for each {@link NoSQLClient} method call.  Note
 * that you must use compartment id (OCID) and not compartment name.  This
 * also means that you may not prefix table name with compartment name when
 * calling methods of {@link NoSQLClient}.  These restrictions do not apply
 * when using specific user identity, which is best when naming flexibility is
 * desired.
 * <p>
 * To use specific user's identity, you must provide the following credentials:
 * <ul>
 * <li>Tenancy OCID.  This is Oracle Cloud ID (OCID) for your tenancy.  See
 * [Resource Identifiers]{@link https://docs.cloud.oracle.com/iaas/Content/General/Concepts/identifiers.htm}
 * for information on OCIDs.</li>
 * <li>User's OCID.  This is Oracle Cloud ID (OCID) for the user in your
 * tenancy.  See [Resource Identifiers]{@link https://docs.cloud.oracle.com/iaas/Content/General/Concepts/identifiers.htm}
 * for information on OCIDs.</li>
 * <li>API Signing Key.  This is public-private key pair used to sign the API
 * requests, see [Required Keys and OCIDs]{@link https://docs.cloud.oracle.com/iaas/Content/API/Concepts/apisigningkey.htm}.
 * In particular, private key is needed to generate the request signature.</li>
 * <li>Public Key Fingerprint.  This is an identifier of the public key of the
 * API Signing Key pair.</li>
 * <li>Passphrase for the private key of API Signing Key pair if the private
 * key is encrypted.</li>
 * </ul>
 * <p>
 * See [Required Keys and OCIDs]{@link https://docs.cloud.oracle.com/iaas/Content/API/Concepts/apisigningkey.htm}
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
 * In this case, set properties <em>tenantId</em>, <em>userId</em>,
 * <em>privateKey</em> or <em>privateKeyFile</em>, <em>fingerprint</em> and
 * <em>passphrase</em> (if private key is encrypted)</li>
 * <li>As part of an OCI configuration file.  See
 * [SDK and CLI Configuration File]{@link https://docs.cloud.oracle.com/iaas/Content/API/Concepts/sdkconfig.htm}
 * for information on OCI configuration file and what entries are used for the
 * required credentials.  In this case, you may set properties
 * <em>configFile</em> and/or <em>profileName</em>.  If not set,
 * appropriate default values will be used, see property descriptions.</li>
 * <li>Specify your own credentials provider in the form of
 * {@link IAMCredentialsProvider} that implements {@link loadIAMCredentials}
 * function.  This allows you to store and retrieve credentials in a secure
 * manner.  In this case, specify <em>credentialsProvider</em> property.</li>
 * </ul>
 * Note that the private key must be in PEM format.  You may provide a path
 * to the PEM key file.  Alternatively, except when using OCI configuration
 * file, you may provide PEM encoded private key directly as <em>Buffer</em>
 * or <em>string</em>.  Note that the <em>passphrase</em> must be provided if
 * the private key is encrypted.
 * <p>
 * <p>
 * The driver will determine the method of authorization as follows:
 * <ol>
 * <li>If {@link IAMConfig}#useResourcePrincipal is set to <em>true</em>, then
 * Resource Principal authorization will be used.  No other properties are
 * required for Resource Prinicpal authorization.</li>
 * <li>If {@link IAMConfig}#useInstancePrincipal is set to <em>true</em>, then
 * Instance Principal authorization will be used.  You may also set
 * {@link IAMConfig}#federationEndpoint, although it is not requred and in
 * most cases federation endpoint will be auto-detected.  No other properties
 * are required for Instance Principal authorization.</li>
 * <li>If {@link IAMConfig} has <em>privateKeyFile</em> or <em>privateKey</em>
 * property, the driver assumes that you are using a specific user's identity
 * and that the credentials are provided directly in {@link IAMConfig}.  All
 * required user's credentials, as described above, must be present as
 * properties of {@link IAMConfig}, otherwise {@link NoSQLArgumentError} will
 * result.</li>
 * <li>If {@link IAMConfig} has <em>credentialsProvider</em> property, the
 * driver assuems that you are using a specific user's identity and the
 * credentials are obtained through the credentials provider which must be in
 * the form of {@link IAMCredentialsProvider}.  In this case the credentials
 * should not be set directly in {@link IAMConfig}.</li>
 * <li>If none of the above, the driver assumes that you are using a specific
 * user's identity and the credentials are stored in OCI config
 * file and will use <em>configFile</em> and <em>profileName</em> properties
 * if present, otherwise it will assume their default values.  In particular,
 * if you specify {@link Config}#serviceType as {@link ServiceType.CLOUD}
 * and omit {@link Config}#auth alltogether, the driver will use IAM
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
 * properties {@link IAMConfig}#durationSeconds and
 * {@link IAMConfig}#refreshAheadMs. See their property descriptions for
 * details.
 *
 * @see {@link AuthConfig}
 * @see {@link IAMCredentials}
 * @see {@link IAMCredentialsProvider}
 * @tutorial connect-cloud
 *
 * @example //JSON config object supplying user's credentials directly
 * //(sensitiveinfo not shown)
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
 *
 * @example //JSON AuthConfig object supplying user's credentials through OCI
 * //configuration file
 * {
 *     "region": "us-phoenix-1",
 *     "auth": {
 *         "iam": {
 *             "configFile": "~/myapp/.oci/config",
 *             "profileName": "John"
 *         }
 *     }
 * }
 *
 * @example //Javascript AuthConfig object supplying user's credentials via
 * //custom credentials provider
 * {
 *     "region": "us-phoenix-1",
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
 * @example //JSON config object using Instance Principal
 * {
 *     "region": "us-phoenix-1",
 *     "compartment": "ocid1.compartment.oc1.............................",
 *     "auth": {
 *         "iam": {
 *             "useInstancePrincipal": "true"
 *         }
 *     }
 * }
 * @example //JSON config object using Resource Principal
 * {
 *     "compartment": "ocid1.compartment.oc1.............................",
 *     "auth": {
 *         "iam": {
 *             "useResourcePrincipal": "true"
 *         }
 *     }
 * }
 * 
 * @global
 * @typedef {object} IAMConfig
 * @property {boolean} [useInstancePrincipal] If set to true, Instance
 * Principal authorization will be used.  May not be combined with
 * <em>useResourcePrincipal</em> or any properties used for specific user's
 * identity
 * @property {string|URL} [federationEndpoint] When using Instance Principal,
 * specifies endpoint to use to communicate with authorization server.
 * Usually this does not need to be specified as the driver will detect the
 * federation endpoint automatically.  Specify this if you need to override
 * the default federation endpoint.  The endpoint must be in the form
 * <em>https://auth.{region-identifier}.{second-level-domain}, e.g.
 * <em>https://auth.ap-hyderabad-1.oraclecloud.com</em>
 * @property {boolean} [useResourcePrincipal] If set to true, Resource
 * Principal authorization will be used.  May not be combined with
 * <em>useInstancePrincipal</em> or any properties used for specific user's
 * identity
 * @property {string} [tenantId] Tenancy OCID
 * @property {string} [userId] User OCID
 * @property {Buffer|string} [privateKey] PEM-encoded private key data.  If
 * specified as <em>Buffer</em>, you may clear the buffer contents afer
 * {@link NoSQLClient} instance is created for added security.  Note that only
 * one of <em>privateKey</em> or <em>privateKeyFile</em> properties may be
 * specified
 * @property {string|Buffer} [privateKeyFile] Path to PEM private key file.
 * Path may be absolute or relative to current directory.  May be
 * <em>string</em> or UTF-8 encoded <em>Buffer</em>.  Note that only one
 * of <em>privateKey</em> or <em>privateKeyFile</em> properties may be
 * specified
 * @property {string} [fingerprint] Public key fingerprint
 * @property {Buffer|string} [passphrase] Passphrase for the private key if it
 * is encrypted.  If specified as <em>Buffer</em>, you may clear the buffer
 * contents after {@link NoSQLClient} instance is created for added security
 * @property {string|Buffer} [configFile='~/.oci/config'] OCI configuration
 * file path.  May be absolute or relative to current directory.  May be
 * <em>string</em> or UTF-8 encoded <em>Buffer</em>.  If not
 * set, the default is used which is "~/.oci/config", where "~" represents
 * user's home directory on Unix systems and %USERPROFILE% directory on
 * Windows (see USERPROFILE environment variable)
 * @property {string} [profileName='DEFAULT'] Profile name within the OCI
 * configuration file, used only if credentials are obtained from the
 * configuration file as described.  If not set, the name "DEFAULT" is used
 * @property {IAMCredentialsProvider|string} [credentialsProvider] Custom
 * credentials provider to use to obtain credentials in the form of
 * {@link IAMCredentials}.  You may also specify string for a module name or
 * path that exports {@link IAMCredentialsProvider}
 * @property {number} [durationSeconds=300] Cache duration of the signature
 * in seconds.  Specifies how long cached signature may be used before new one
 * has to be created.  Maximum allowed duration is 5 minutes (300 seconds),
 * which is also the default
 * @property {number} [refreshAheadMs=10000] Tells the driver when to
 * automatically refresh the signature before its expiration in the cache,
 * measured in number of milliseconds before expiration.  E.g. value 10000
 * means that the driver will attempt to refresh the signature 10 seconds
 * before its expiration.  Using refresh allows to avoid slowing down of
 * database operations by creating the signature asynchronously.  You can set
 * this property to null to disable automatic refresh
 * @property {number} [timeout=120000] Timeout in milliseconds used for
 * requests to the authorization server.  Currently this is only used with
 * Instance Principal
 */

/**
 * This type encapsulates credentials required for generating OCI request
 * signature.  It is used as a return type for {@link loadIAMCredentials} in
 * {@link IAMCredentialsProvider}.  The properties of this type are the same
 * as in {@link IAMConfig} when credentials are provided directly.  See
 * {@link IAMConfig} for more information.
 * <p>
 * When returning this object, you have choices to return <em>privateKey</em>
 * or <em>privateKeyFile</em> and to return <em>Buffer</em> or <em>string</em>
 * for fields indicated as such.
 *
 * @see {@link IAMConfig}
 * @see {@link loadIAMCredentials}
 * @see {@link IAMCredentialsProvider}
 *
 * @global
 * @typedef {object} IAMCredentials
 * @property {string} [tenantId] Tenancy OCID
 * @property {string} [userId] User OCID
 * @property {Buffer|string} [privateKey] PEM encoded private key data.  Note
 * that only one of <em>privateKey</em> or <em>privateKeyFile</em> properties
 * may be returned
 * @property {string|Buffer} [privateKeyFile] Path to PEM private key file.
 * Note that only one of <em>privateKey</em> or <em>privateKeyFile</em>
 * properties may be returned
 * @property {string} [fingerprint] Public key fingerprint
 * @property {Buffer|string} [passphrase] Passphrase for the private key if it
 * is encrypted
 */

/**
 * Interface to load credentials required for generating OCI request
 * signature.  Used in {@link IAMCredentialsProvider}.
 * @see {@link IAMCredentialsProvider}
 * @see {@link IAMCredentials}
 *
 * @global
 * @callback loadIAMCredentials
 * @async
 * @returns {Promise} Promise resolved with {@link IAMCredentials} or
 * rejected with an error.  Properties of type <em>Buffer</em> in
 * {@link IAMCredentials} such as <em>privateKey</em> and <em>passphrase</em>
 * will be erased once the signature is generated
 */

/**
 * You may implement {@link IAMCredentialsProvider} interface to securely
 * obtain credentials required for generation of Oan CI request signature, as
 * described in {@link IAMConfig}.  {@link IAMCredentialsProvider} is
 * set as {@link IAMConfig}#credentialsProvider property and may be specified
 * either as {@link loadIAMCredentials} function or as an object
 * implementing <em>loadCredentials</em> function.
 *
 * @see {@link loadIAMCredentials}
 * @see {@link IAMCredentials}
 * @see {@link IAMConfig}
 * @tutorial connect-cloud
 *
 * @global
 * @typedef {object|loadIAMCredentials} IAMCredentialsProvider
 * @property {loadIAMCredentials} loadCredentials loadCredentials function
 */
