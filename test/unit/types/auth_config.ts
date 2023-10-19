/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { AuthConfig, IAMConfig, KVStoreAuthConfig, AuthorizationProvider,
    ServiceType, Region, Operation, NoSQLError, DelegationTokenProvider,
    IAMCredentialsProvider, IAMCredentials, KVStoreCredentialsProvider,
    KVStoreCredentials, IAMAuthorizationProvider,
    KVStoreAuthorizationProvider, Config, AuthResult,
    ResourcePrincipalClaims } from "../../../";

function testAuthConfig(iamCfg: IAMConfig, kvCfg: KVStoreAuthConfig,
    provider: AuthorizationProvider, iamProvider: IAMAuthorizationProvider,
    kvStoreProvider: KVStoreAuthorizationProvider) {
    let cfg: AuthConfig;
    
    cfg = { iam: iamCfg };
    cfg = { kvstore: kvCfg };
    cfg = { provider };
    cfg = { provider: iamProvider };
    cfg = { provider: kvStoreProvider };

    // @ts-expect-error Invalid type for iam.
    cfg = { iam: true };
    // @ts-expect-error Invalid type for iam.
    cfg = { iam: { kv: {} } };
    // @ts-expect-error Invalid type for iam.
    cfg = { iam: provider };

    // @ts-expect-error Invalid type for kvstore.
    cfg = { kvstore: "kvstore" };
    // @ts-expect-error Invalid type for kvstore.
    cfg = { kvstore: { iam: {} } };
    // @ts-expect-error Invalid type for kvstore.
    cfg = { kvstore: provider };

    // @ts-expect-error Invalid type for provider.
    cfg = { provider: () => "auth" };
    // @ts-expect-error Invalid type for provider.
    cfg = { provider: async () => 1 };
    // @ts-expect-error Invalid type for provider.
    cfg = { provider: async (op: Operation, extra: boolean) => "auth" };
    // @ts-expect-error Invalid type for provider.
    cfg = { provider: {} };
    // @ts-expect-error Invalid type for provider.
    cfg = { provider: { async foo() { return "auth" } } };
    // @ts-expect-error Invalid type for provider.
    cfg = { provider: { async getAuthorization()
        { return Buffer.alloc(10); } } };    
    // @ts-expect-error Invalid type for provider.
    cfg = { provider: { async getAuthorization(op: string)
        { return { "header": "val" } } } };

    // TODO: enable when have exclusive properties

    // ts-expect-error Mutually exclusive properties.
    cfg = { iam: iamCfg, kvstore: kvCfg };
    // ts-expect-error Mutually exclusive properties.
    cfg = { iam: iamCfg, provider };
    // ts-expect-error Mutually exclusive properties.
    cfg = { kvstore: kvCfg, provider };
}

function testIAMConfig(dtp: DelegationTokenProvider,
    cp: IAMCredentialsProvider) {
    let cfg: IAMConfig;

    cfg = { useInstancePrincipal: true };
    cfg.federationEndpoint = "endpoint";
    cfg.delegationToken = "dt";
    cfg.delegationTokenFile = "file";
    cfg.delegationTokenProvider = async () => { return "dt "};
    cfg = {
        useInstancePrincipal: true,
        delegationTokenProvider: dtp
    };

    cfg.durationSeconds = 500;
    cfg.refreshAheadMs = 20000;
    cfg.timeout = 30000;

    cfg = { useResourcePrincipal: true };
    cfg = {
        useResourcePrincipal: true,
        durationSeconds: 600,
        refreshAheadMs: 2000,
        timeout: 40000
    };

    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKey: "pem",
        fingerprint: "fingerprint",
        passphrase: "passphrase"
    };
    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKey: Buffer.from("pem"),
        fingerprint: "fingerprint",
        passphrase: Buffer.from("passphrase"),
        refreshAheadMs: 20000,
        timeout: 30000
    };
    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKeyFile: "file",
        fingerprint: "fingerprint",
        durationSeconds: 500
    };
    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKeyFile: Buffer.from("file"),
        fingerprint: "fingerprint",
        passphrase: "passphrase"
    };

    cfg = {
        configFile: "file",
        durationSeconds: 450
    };
    cfg = {
        configFile: "file",
        profileName: "profile"
    };
    cfg.timeout = 50000;
    cfg.refreshAheadMs = 10000;

    cfg = {
        credentialsProvider: cp
    };
    cfg.refreshAheadMs = 4500;
    cfg.timeout = 10000;
    cfg.durationSeconds = 700;

    // @ts-expect-error Invalid spelling of useResourcePrincipal.
    cfg = { userResourcePrincipal: true };
    // @ts-expect-error Invalid type for userInstancePrincipal.
    cfg = { useInstancePrincipal: 1 };
    cfg = { useInstancePrincipal: true };
    // @ts-expect-error Invalid type for federationEndpoint.
    cfg.federationEndpoint = Buffer.alloc(100);
    // @ts-expect-error Invalid type for delegationToken.
    cfg.delegationToken = [1, 2, 3];
    // @ts-expect-error Invalid type for delegationTokenProvider.
    cfg.delegationTokenProvider = () => {};

    // @ts-expect-error Invalid type for durationSeconds.
    cfg.durationSeconds = "500";
    // @ts-expect-error Invalid type for refreshAheadMs.
    cfg.refreshAheadMs = "20000";
    // @ts-expect-error Invalid type for timeout.
    cfg.timeout = true;

    // @ts-expect-error Invalid type for useResourcePrincipal.
    cfg = { useResourcePrincipal: 1 };
    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKey: "pem",
        fingerprint: "fingerprint",
        passphrase: "passphrase"
    };
    // @ts-expect-error Invalid type for tenantId.
    cfg.tenantId = 1;
    // @ts-expect-error Invalid type for userId.
    cfg.userId = true;
    // @ts-expect-error Invalid type for privateKey.
    cfg.privateKey = {};
    // @ts-expect-error Invalid type for fingerprint.
    cfg.fingerprint = Buffer.from(100);
    // @ts-expect-error Invalid type for passphrase.
    cfg.passphrase = 10000;
    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKeyFile: "file",
        fingerprint: "fingerprint",
        durationSeconds: 500
    };
    // @ts-expect-error Invalid type for privateKeyFile.
    cfg.privateKeyFile = true;
    cfg = { configFile: "file" };
    // @ts-expect-error Invalid type for configFile.
    cfg.configFile = 100;
    // @ts-expect-error Invalid type for profileName.
    cfg.profileName = Buffer.from("profile");
    // @ts-expect-error Invalid type for credentialsProvider.
    cfg = { credentialsProvider: {} };
}

// TODO: enable when have exclusive properties
function testIAMConfigCompatProps(cp: IAMCredentialsProvider,
    dtp: DelegationTokenProvider) {
    let cfg: IAMConfig;

    // ts-expect-error Mutually exclusive with useInstancePrincipal.
    cfg = {
        useInstancePrincipal: true,
        useResourcePrincipal: true
    };
    // ts-expect-error Mutually exclusive with useInstancePrincipal.
    cfg = {
        useInstancePrincipal: true,
        configFile: "file",
        profileName: "DEFAULT"
    };
    // ts-expect-error Mutually exclusive with useInstancePrincipal.
    cfg = {
        useInstancePrincipal: true,
        credentialsProvider: cp
    };
    // ts-expect-error Mutually exclusive with useInstancePrincipal.
    cfg = {
        useInstancePrincipal: true,
        tenantId: "tenant",
        userId: "user",
        privateKey: "pem",
        fingerprint: "fingerprint"
    };
    // ts-expect-error Mutually exclusive with useResourcePrincipal.
    cfg = {
        useResourcePrincipal: true,
        configFile: "file"
    };
    // ts-expect-error Mutually exclusive with useResourcePrincipal.
    cfg = {
        useResourcePrincipal: true,
        credentialsProvider: cp,
        timeout: 10000
    };
    // ts-expect-error Mutually exclusive with useResourcePrincipal.
    cfg = {
        useResourcePrincipal: true,
        tenantId: "tenant",
        userId: "user",
        privateKeyFile: "file",
        fingerprint: "fingerprint",
        passphrase: "passphrase"
    };
    // ts-expect-error Mutually exclusive with configFile.
    cfg = {
        configFile: "file",
        profileName: "DEFAULT",
        credentialsProvider: cp,
        refreshAheadMs: 10000
    };
    // ts-expect-error Mutually exclusive with configFile.
    cfg = {
        configFile: "file",
        tenantId: "tenant",
        userId: "user",
        privateKeyFile: "file",
        fingerprint: "fingerprint",
    };
    // ts-expect-error Mutually exclusive with credentialsProvider.
    cfg = {
        credentialsProvider: cp,
        tenantId: "tenant",
        userId: "user",
        privateKeyFile: "file",
        fingerprint: "fingerprint",
        durationSeconds: 500
    };

    // ts-expect-error privateKey mutually exclusive with privateKeyFile.
    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKey: "pem",
        privateKeyFile: "file",
        fingerprint: "fingerprint"
    };

    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKey: "pem",
        fingerprint: "fingerprint"
    };

    // ts-expect-error Missing tenantId.
    cfg = {
        userId: "user",
        privateKey: "pem",
        fingerprint: "fingerprint"
    };

    // ts-expect-error Missing userId.
    cfg = {
        tenantId: "tenant",
        privateKey: "pem",
        fingerprint: "fingerprint"
    };

    // ts-expect-error Missing privateKey or privateKeyFile.
    cfg = {
        tenantId: "tenant",
        userId: "user",
        fingerprint: "fingerprint"
    };

    // ts-expect-error Missing fingerprint.
    cfg = {
        tenantId: "tenant",
        userId: "user",
        privateKey: "pem"
    };

    // ts-expect-error delegationToken mutually exclusive with
    // delegationTokenProvider.
    cfg = {
        useInstancePrincipal: true,
        delegationToken: "token",
        delegationTokenProvider: dtp
    }
}

function testAuthorizationProvider(provider: AuthorizationProvider,
    iam: IAMAuthorizationProvider, kv: KVStoreAuthorizationProvider) {
    expectTypeOf<string>().toMatchTypeOf<AuthResult>();
    expectTypeOf<Record<string,string>>().toMatchTypeOf<AuthResult>();
    expectTypeOf(provider.getAuthorization)
        .toEqualTypeOf<(op: Operation) => Promise<AuthResult>>();
    expectTypeOf(provider.close)
        .toEqualTypeOf<(() => void|Promise<void>)|undefined>();
    expectTypeOf(provider.onInit)
        .toEqualTypeOf<((cfg: Config) => void)|undefined>();
    
    expectTypeOf(iam).toMatchTypeOf(provider);
    expectTypeOf(kv).toMatchTypeOf(provider);

    const claims: ResourcePrincipalClaims = {} as ResourcePrincipalClaims;
    expectTypeOf(claims.tenantId).toEqualTypeOf<string|undefined>();
    expectTypeOf(claims.compartmentId).toEqualTypeOf<string|undefined>();

    expectTypeOf(iam.getResourcePrincipalClaims)
        .toEqualTypeOf<() => Promise<ResourcePrincipalClaims|undefined>>();
}

function testDelegationToken(cfg: IAMConfig) {
    expectTypeOf(cfg.delegationToken).toEqualTypeOf<string|undefined>();
    expectTypeOf(cfg.delegationTokenFile).toEqualTypeOf<string|undefined>();
    expectTypeOf(cfg.delegationTokenProvider)
        .toEqualTypeOf<(() => Promise<string>)
        |DelegationTokenProvider|string|undefined>();

    let dtp: DelegationTokenProvider;
    dtp = { async loadDelegationToken() { return "a"; }};
    // @ts-expect-error No parameters expected.
    dtp = { async loadDelegationToken(opt: any) { return "a"; }};
    // @ts-expect-error Invalid return type, must be promise.
    dtp = { loadDelegationToken() { return "a"; }};

    expectTypeOf(dtp.loadDelegationToken).toBeFunction();
    expectTypeOf(dtp.loadDelegationToken).parameters.toEqualTypeOf<[]>();
    expectTypeOf(dtp.loadDelegationToken).returns.resolves.toBeString();
}

function testIAMCredentialsProvider(cfg: IAMConfig, creds: IAMCredentials) {
    expectTypeOf(cfg.credentialsProvider).toEqualTypeOf<
    (() => Promise<IAMCredentials>)|IAMCredentialsProvider|string
    |undefined>();
    
    let cp: IAMCredentialsProvider;
    cp = { async loadCredentials() { return creds; }};
    // @ts-expect-error No parameters expected.
    cp = { async loadCredentials(opt: any) { return creds; }};
    // @ts-expect-error Invalid return type, must be promise.
    cp = { loadCredentials() { return creds; }};

    expectTypeOf(cp.loadCredentials).toBeFunction();
    expectTypeOf(cp.loadCredentials).parameters.toEqualTypeOf<[]>();
    expectTypeOf(cp.loadCredentials).returns.resolves
        .toEqualTypeOf<IAMCredentials>();
}

function testIAMCredentials(creds: IAMCredentials) {
    expectTypeOf(creds.tenantId).toBeString();
    expectTypeOf(creds.userId).toBeString();
    expectTypeOf(creds.privateKey).toEqualTypeOf<Buffer|string|undefined>();
    expectTypeOf(creds.privateKeyFile)
    expectTypeOf(creds.fingerprint).toBeString();
    expectTypeOf(creds.passphrase).toEqualTypeOf<Buffer|string|undefined>();

    // @ts-expect-error Invalid property.
    creds.name;
}

function testKVStoreAuthConfig(cp: KVStoreCredentialsProvider) {
    let cfg: KVStoreAuthConfig;

    cfg = { user: "user", password: "pwd" };
    cfg.password = Buffer.from("pwd");
    // @ts-expect-error Invalid type for user.
    cfg.user = 100;
    // @ts-expect-error Invalid type for user.
    cfg.user = Buffer.from("user");
    // @ts-expect-error Invalid type for password.
    cfg.password = [ 1, 2 ];

    cfg = { credentials: cp };
    cfg = { credentials: "file" };
    // @ts-expect-error Invalid type for credentials.
    cfg = { credentials: 100 };
    // @ts-expect-error Invalid type for credentials.
    cfg = { credentials: true };
    // @ts-expect-error Invalid type for credentials provider.
    cfg = { credentials: () => {} };

    // TODO: enable when have exclusive properties
    // ts-expect-error Missing password.
    cfg = { user: "user" };
    // ts-expect-error Missing user.
    cfg = { password: "password" };
    
    // TODO: enable when have exclusive properties
    // ts-expect-error credentials mutually exclusive with user and password.
    cfg = {
        user: "user",
        password: "password",
        credentials: cp
    };
    // ts-expect-error credentials mutually exclusive with user and password.
    cfg = {
        user: "user",
        password: "password",
        credentials: "file"
    };
}

function testKVStoreCredentialsProvider(cfg: KVStoreAuthConfig,
    creds: KVStoreCredentials) {
    expectTypeOf(cfg.credentials).toEqualTypeOf<
    (() => Promise<KVStoreCredentials>)|KVStoreCredentialsProvider|string
    |undefined>();
    
    let cp: KVStoreCredentialsProvider;
    cp = { async loadCredentials() { return creds; }};
    // @ts-expect-error No parameters expected.
    cp = { async loadCredentials(opt: any) { return creds; }};
    // @ts-expect-error Invalid return type, must be promise.
    cp = { loadCredentials() { return creds; }};

    expectTypeOf(cp.loadCredentials).toBeFunction();
    expectTypeOf(cp.loadCredentials).parameters.toEqualTypeOf<[]>();
    expectTypeOf(cp.loadCredentials).returns.resolves
        .toEqualTypeOf<KVStoreCredentials>();
}

function testKVStoreCredentials(creds: KVStoreCredentials) {
    expectTypeOf(creds.user).toBeString();
    expectTypeOf(creds.password).toEqualTypeOf<string|Buffer>();
    // @ts-expect-error Invalid property.
    creds.name;
}
