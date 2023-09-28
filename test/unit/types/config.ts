/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, Config, ServiceType, Region, Consistency, Durabilities,
    RetryConfig, DBNumberConfig, AuthConfig, RateLimiterConstructor, HttpOpt,
    RetryHandler, Operation, NoSQLError, SimpleRateLimiter, ConsumedCapacity, TableState }
    from "../../../";
import { table } from "console";

function testConfig(retryCfg: RetryConfig, numConfig: DBNumberConfig,
    authCfg: AuthConfig, rlCons: RateLimiterConstructor, httpOpt: HttpOpt) {
    let cfg: Config = {};
    
    cfg.serviceType = ServiceType.CLOUD;
    cfg.serviceType = "CLOUD";
    cfg.endpoint = "http://localhost:8080";
    cfg.endpoint = new URL("http://localhost:8080");
    cfg.region = Region.AP_IBARAKI_1;
    cfg.region = "ap-ibaraki-1";
    cfg.timeout = 10000;
    cfg.ddlTimeout = 10000;
    cfg.securityInfoTimeout = 10000;
    cfg.tablePollTimeout = 100000;
    cfg.tablePollDelay = 500;
    cfg.adminPollTimeout = 30000;
    cfg.adminPollDelay = 500;
    cfg.consistency = Consistency.ABSOLUTE;
    cfg.durability = Durabilities.COMMIT_NO_SYNC;
    cfg.maxMemoryMB = 512;
    cfg.compartment = "compartment";
    cfg.namespace = "namespace";
    cfg.retry = retryCfg;
    cfg.retry = null;
    cfg.httpOpt = httpOpt;
    cfg.auth = authCfg;
    cfg.dbNumber = numConfig;
    cfg.longAsBigInt = true;
    cfg.rateLimiter = true;
    cfg.rateLimiter = "rate_limiter";
    cfg.rateLimiter = rlCons;
    cfg.rateLimiterPercent = 50;

    // @ts-expect-error Invalid serviceType.
    cfg.serviceType = 1;
    // @ts-expect-error Invalid endpoint.
    cfg.endpoint = Buffer.alloc(32);
    // @ts-expect-error Invalid region.
    cfg.region = 10;
    // @ts-expect-error Invalid timeout.
    cfg.timeout = "10000";
    // @ts-expect-error Invalid ddlTimeout.
    cfg.ddlTimeout = true;
    // @ts-expect-error Invalid securityInfoTimeout.
    cfg.securityInfoTimeout = "10000";
    // @ts-expect-error Invalid tablePollTimeout.
    cfg.tablePollTimeout = "100000";
    // @ts-expect-error Invalid tablePollDelay.
    cfg.tablePollDelay = false;
    // @ts-expect-error Invalid adminPollTimeout.
    cfg.adminPollTimeout = true;
    // @ts-expect-error Invalid adminPollDelay.
    cfg.adminPollDelay = {};
    // @ts-expect-error Invalid consistency.
    cfg.consistency = 1;
    // @ts-expect-error Invalid consistency.
    cfg.consistency = "ABSOLUTE";
    // @ts-expect-error Invalid durability.
    cfg.durability = {};
    // @ts-expect-error Invalid durability.
    cfg.durability = 1;
    // @ts-expect-error Invalid durability.
    cfg.durability = "COMMIT_SYNC";
    // @ts-expect-error Invalid maxMemoryMB.
    cfg.maxMemoryMB = "100";
    // @ts-expect-error Invalid compartment.
    cfg.compartment = 1;
    // @ts-expect-error Invalid namespace.
    cfg.namespace = 1;
    // @ts-expect-error Invalid retry config.
    cfg.retry = "retry";
    // @ts-expect-error Invalid tablePollDelay.
    cfg.retry = { maxRetries: "" };
    // @ts-expect-error Invalid httpOpt.
    cfg.httpOpt = new Date();
    // @ts-expect-error Invalid auth config.
    cfg.auth = { provider: "provider" };
    // @ts-expect-error Invalid dbNumber config.
    cfg.dbNumber = 10;
    // @ts-expect-error Invalid longAsBigInt.
    cfg.longAsBigInt = 1;
    // @ts-expect-error Invalid rateLimiter.
    cfg.rateLimiter = 1;
    // @ts-expect-error Invalid rateLimiterPercent.
    cfg.rateLimiterPercent = "50";
    // @ts-expect-error Invalid extra property.
    cfg.retryConfig = undefined;

    // TODO: enable when have exclusive properties
    // ts-expect-error Region and endpoint are mutually exclusive.
    cfg = { region: Region.AF_JOHANNESBURG_1, endpoint: "endpoint" };
}

function testRegion(reg: Region) {
    // Region is not publicly constructible.
    expectTypeOf(Region).constructorParameters.toEqualTypeOf<never>();
    expectTypeOf(Region.values).toEqualTypeOf<Region[]>();
    // @ts-expect-error Region.values is readonly.
    Region.values = [];

    expectTypeOf(Region.fromRegionId).toBeFunction();
    expectTypeOf(Region.fromRegionId).parameters
        .toEqualTypeOf<[string]>();
    expectTypeOf(Region.fromRegionId).parameter(0).toBeString();
    expectTypeOf(Region.fromRegionId).returns
        .toEqualTypeOf<Region|undefined>();

    expectTypeOf(Region.fromRegionCodeOrId).toBeFunction();
    expectTypeOf(Region.fromRegionCodeOrId).parameters
        .toEqualTypeOf<[string]>();
    expectTypeOf(Region.fromRegionCodeOrId).parameter(0).toBeString();
    expectTypeOf(Region.fromRegionCodeOrId).returns
        .toEqualTypeOf<Region|undefined>();

    expectTypeOf(reg.regionId).toBeString();
    // @ts-expect-error Readonly property.
    reg.regionId = "region";
    expectTypeOf(reg.regionCode).toBeString();
    // @ts-expect-error Readonly property.
    reg.regionCode = "region";
    expectTypeOf(reg.secondLevelDomain).toBeString();
    // @ts-expect-error Readonly property.
    reg.secondLevelDomain = "region";
    expectTypeOf(reg.endpoint).toBeString();
    // @ts-expect-error Readonly property.
    reg.endpoint = "region";    
}

function testRetryHandler(handler: RetryHandler) {
    expectTypeOf(handler.doRetry).toEqualTypeOf<boolean|
        ((operation: Operation, numRetries: number, error: NoSQLError) =>
        boolean)>();
    handler.doRetry = true;
    handler.doRetry = () => { return true; }
    handler.doRetry = (op: Operation) => { return true; }
    handler.doRetry = (op: Operation, n: number) => { return true; }
    handler.doRetry = (op: Operation, n: number, err: NoSQLError) =>
        { return true; }
    
    // @ts-expect-error Invalid doRetry value.
    handler.doRetry = 1;
    // @ts-expect-error Invalid doRetry callback.
    handler.doRetry = (n: number) => { return true; }
    // @ts-expect-error Invalid doRetry callback, extra parameter.
    handler.doRetry = (op: Operation, n: number, err: NoSQLError,
        extra: boolean) => { return true; }

    expectTypeOf(handler.delay).toEqualTypeOf<number|
        ((operation: Operation, numRetries: number, error: NoSQLError) =>
        number)>();
    handler.delay = 1000;
    handler.delay = () => { return 1000; }
    handler.delay = (op: Operation) => { return 1000; }
    handler.delay = (op: Operation, n: number) => { return 1000; }
    handler.delay = (op: Operation, n: number, err: NoSQLError) =>
        { return 1000; }
    
    // @ts-expect-error Invalid delay value.
    handler.delay = true;
    // @ts-expect-error Invalid delay callback.
    handler.delay = (n: number) => { return 1000; }
    // @ts-expect-error Invalid delay callback, extra parameter.
    handler.delay = (op: Operation, n: number, err: NoSQLError,
        extra: boolean) => { return 1000; }

    // @ts-expect-error Invalid extra property.
    handler.handler;

    handler = { doRetry: true, delay: 1000 };
    handler = { doRetry: () => true, delay: 1000 };
    handler = { doRetry: true, delay: () => 1000 };
    handler = { doRetry: () => true, delay: () => 1000 };

    // @ts-expect-error Missing required properties.
    handler = {};
    // @ts-expect-error Missing one of required properties.
    handler = { doRetry: () => true };
    // @ts-expect-error Missing one of required properties.
    handler = { delay: () => 1000 };
}

function testRetryConfig(handler: RetryHandler) {
    let cfg: RetryConfig = {};

    cfg.handler = handler;

    cfg.maxRetries = 5;
    cfg.baseDelay = 1000;
    cfg.controlOpBaseDelay = 50000;
    cfg.secInfoBaseDelay = 1000;
    cfg.secInfoNumBackoff = 5;
    
    // @ts-expect-error Wrong spelling.
    cfg.haldler = handler;
    // @ts-expect-error Invalid handler.
    cfg.handler = {};

    // @ts-expect-error Invalid type for maxRetries.
    cfg.maxRetries = "5";
    // @ts-expect-error Invalid type for baseDelay.
    cfg.baseDelay = true;
    // @ts-expect-error Invalid type for controlOpBaseDelay.
    cfg.controlOpBaseDelay = "50000";
    // @ts-expect-error Invalid type for secInfoBaseDelay.
    cfg.secInfoBaseDelay = true;
    // @ts-expect-error Invalid type for secInfoNumBackoff.
    cfg.secInfoNumBackoff = "5";

    // @ts-expect-error Invalid extra property.
    cfg.timeout = 10000;

    // TODO: enable when have exclusive properties
    // ts-expect-error Handler is mutually exclusive with other properties.
    cfg = { handler, maxRetries: 5 };
    // ts-expect-error Handler is mutually exclusive with other properties.
    cfg = { handler, baseDelay: 5000 };
    // ts-expect-error Handler is mutually exclusive with other properties.
    cfg = { handler, controlOpBaseDelay: 50000 };
    // ts-expect-error Handler is mutually exclusive with other properties.
    cfg = { handler, secInfoBaseDelay: 5000, secInfoNumBackoff: 5 };
}

function testHttpOpt() {
    let opt: HttpOpt = {};

    // http.AgentOptions
    opt.keepAlive = true;
    opt.keepAliveMsecs = 10000;
    opt.maxSockets = 100;
    opt.maxTotalSockets = 100;
    opt.scheduling = "fifo";
    opt.timeout = 100000;
    
    // tls.CommonConnectionOptions
    opt.secureContext = { context: {} };
    opt.enableTrace = true;
    opt.requestCert = true;
    opt.ALPNProtocols = [ "a" ];
    opt.SNICallback = function() {}
    opt.rejectUnauthorized = true;

    // tls.SecureContextOptions
    opt.ca = "pem_cert";
    opt.ca = Buffer.from("cert");
    opt.ca = [ "pem_cert" ];
    opt.ca = [ Buffer.from("cert") ];
    opt.cert = "pem_cert";
    opt.cert = Buffer.from("cert");
    opt.cert = [ "pem_cert" ];
    opt.cert = [ Buffer.from("cert") ];
    opt.sigalgs = "sig_alg";
    opt.ciphers = "cipher";
    opt.clientCertEngine = "engine";
    opt.crl = "crl";
    opt.crl = Buffer.from("crl");
    opt.crl = [ "crl" ];
    opt.crl = [ Buffer.from("crl") ];
    opt.dhparam = "dh_param";
    opt.ecdhCurve = "ecdh_curve";
    opt.honorCipherOrder = true;
    opt.key = "pem";
    opt.key = Buffer.from("key");
    opt.key = [ Buffer.from("cert") ];
    opt.privateKeyEngine = "engine";
    opt.privateKeyIdentifier = "id";
    opt.maxVersion = "TLSv1.3";
    opt.minVersion = "TLSv1.3";
    opt.passphrase = "passphrase";
    opt.pfx = "pfx";
    opt.secureOptions = 1;
    opt.secureProtocol = "protocol";
    opt.sessionIdContext = "id";
    opt.sessionTimeout = 1000;

    // @ts-expect-error Invalid extra option.
    opt.localAddress = "addr";
}

function testRateLimiterCons() {
    let rlCons: RateLimiterConstructor;

    rlCons = SimpleRateLimiter;

    rlCons = class {
        setLimit(limit: number): void {}
        async consumeUnits(units: number, timeout: number,
            consumeOnTimeout: boolean): Promise<number> {
                return 1000;
        }
        onThrottle(err: NoSQLError) {}
    };
    // Implementations can use fewer arguments.
    rlCons = class {
        setLimit = () => {}
        consumeUnits = () => Promise.resolve(1000);
        onThrottle = () => {}
    }

    // @ts-expect-error Not a constructor.
    rlCons = new SimpleRateLimiter();
    // @ts-expect-error Not a constructor.
    rlCons = () => new SimpleRateLimiter();
    // @ts-expect-error Missing methods.
    rlCons = class {};
    // @ts-expect-error Invalid param type in setLimit.
    rlCons = class {
        setLimit = (limit: string) => {}
        consumeUnits = () => Promise.resolve(1000);
        onThrottle = () => {}
    }
    // @ts-expect-error Invalid return type in consumeUnits.
    rlCons = class {
        setLimit = () => {}
        consumeUnits = () => Promise.resolve("a");
        onThrottle = () => {}
    }    
}

function testNoSQLClientCons() {
    let client: NoSQLClient;

    client = new NoSQLClient();
    client = new NoSQLClient(undefined);
    client = new NoSQLClient(null);
    client = new NoSQLClient("file");
    client = new NoSQLClient({ timeout: 10000 });

    // @ts-expect-error Invalid parameter.
    client = new NoSQLClient(1);
    // @ts-expect-error Invalid parameter.
    client = new NoSQLClient(new Date());
    // Currently works because NoSQLClient has serviceType property. Need to
    // see if possible to limit Config type appropriately.
    client = new NoSQLClient(client);
    // @ts-expect-error Invalid parameter.
    client = new NoSQLClient({ timeou: 10000 });
}

class A {}
type T = typeof A extends abstract new(...args: any) => any ? true : false;

async function testNoSQLClientMisc() {
    expectTypeOf(NoSQLClient.version).toBeString();
    // @ts-expect-error Version is read-only.
    NoSQLClient.version = "version";

    // @ts-expect-error Wrong spelling of version.
    NoSQLClient.versiom;

    let client = new NoSQLClient();

    expectTypeOf(client.close).toBeFunction();
    expectTypeOf(client.close).parameters.toEqualTypeOf<[]>();
    expectTypeOf(client.close).returns.not.toEqualTypeOf<void>();
    expectTypeOf(client.close).returns.resolves.toEqualTypeOf<void>();

    await client.close();

    expectTypeOf(client.precacheAuth).toBeFunction();
    expectTypeOf(client.precacheAuth).parameters.toEqualTypeOf<[]>();
    expectTypeOf(client.precacheAuth).returns.not
        .toEqualTypeOf<NoSQLClient>();
    expectTypeOf(client.precacheAuth).returns.resolves
        .toEqualTypeOf<NoSQLClient>();
    
    client = await client.precacheAuth();
}

async function testNoSQLClientEvents() {
    const client = new NoSQLClient();

    client.on("consumedCapacity", (cc: ConsumedCapacity,
        op: Operation) => {});
    client.on("error", (err: NoSQLError, op: Operation) => {});
    client.on("retryable", (err: NoSQLError, op: Operation,
        numRetries: number) => {})
    client.on("tableState", (tableName: string,
        tableState: TableState) => {});

    // @ts-expect-error Invalid event name
    client.on("nosuchevent", () => {});
    // @ts-expect-error Invalid listener for "consumedCapacity" event
    client.on("consumedCapacity", (op: Operation) => {});
    // @ts-expect-error Invalid listener for "error" event
    client.on("error", (err: NoSQLError, op: Operation,
        numRetries: number) => {})
    // @ts-expect-error Invalid listener for "retryable" event
    client.on("retryable", (numRetries: number) => {});
    // @ts-expect-error Invalid listener for "tableState" event
    client.on("tableState", (tableName: string, tableState: number) => {});
}
