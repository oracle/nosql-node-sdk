/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, PutIfOpt, PutOpt, Durability, RowVersion,
    PutResult, ConsumedCapacity, FieldValue, Durabilities, TTLUtil,
    SyncPolicy, ReplicaAckPolicy, IdentityField, AnyRow } from "../../../";

import Decimal from "decimal.js";

const client = new NoSQLClient("nosuchfile.json");

function testDurability() {
    let dur: Durability;

    dur = Durabilities.COMMIT_NO_SYNC;
    dur = Durabilities.COMMIT_SYNC;
    dur = Durabilities.COMMIT_WRITE_NO_SYNC;
    dur = { masterSync: SyncPolicy.SYNC, replicaSync: SyncPolicy.NO_SYNC,
        replicaAck: ReplicaAckPolicy.ALL };
    
    // @ts-expect-error Invalid type for durability.
    dur = 0;
    // @ts-expect-error Invalid type for durability.
    dur = "COMMIT_SYNC";
    // @ts-expect-error Missing replicaAck in durability.
    dur = { masterSync: SyncPolicy.SYNC, replicaSync: SyncPolicy.SYNC };
    // @ts-expect-error Missing replicaSync in durability.
    dur = { masterSync: SyncPolicy.SYNC,
        replicaAck: ReplicaAckPolicy.NONE };
    // @ts-expect-error Missing masterSync in durability.
    dur = { replicaSync: SyncPolicy.SYNC,
        replicaAck: ReplicaAckPolicy.NONE };
    // @ts-expect-error Invalid masterSync in durability.
    dur = { masterSync: 1, replicaSync: SyncPolicy.SYNC,
        replicaAck: ReplicaAckPolicy.NONE };
    // @ts-expect-error Invalid masterSync in durability.
    dur = { masterSync: "SYNC", replicaSync: SyncPolicy.SYNC,
        replicaAck: ReplicaAckPolicy.NONE };
    // @ts-expect-error Invalid masterSync in durability.
    dur = { masterSync: undefined, replicaSync: SyncPolicy.SYNC,
        replicaAck: ReplicaAckPolicy.NONE };
    // @ts-expect-error Invalid masterSync in durability.
    dur = { masterSync: null, replicaSync: SyncPolicy.SYNC,
        replicaAck: ReplicaAckPolicy.NONE };
    // @ts-expect-error Invalid replicaSync in durability.
    dur = { masterSync: SyncPolicy.SYNC, replicaSync: 0,
        replicaAck: ReplicaAckPolicy.NONE };
    dur = { masterSync: SyncPolicy.SYNC, replicaSync: SyncPolicy.SYNC,
        // @ts-expect-error Invalid replicaAck in durability.
        replicaAck: 1 };
    dur = { masterSync: SyncPolicy.SYNC, replicaSync: SyncPolicy.SYNC,
        // @ts-expect-error Invalid replicaAck in durability.
        replicaAck: "NONE" };
    dur = { masterSync: SyncPolicy.SYNC, replicaSync: SyncPolicy.SYNC,
        // @ts-expect-error Invalid replicaAck in durability.
        replicaAck: null };
    dur = { masterSync: SyncPolicy.SYNC, replicaSync: SyncPolicy.SYNC,
        // @ts-expect-error Invalid replicaAck in durability.
        replicaAck: undefined };

    dur = { masterSync: SyncPolicy.SYNC, replicaSync: SyncPolicy.NO_SYNC,
        // @ts-expect-error Invalid extra property in durability.
        replicaAck: ReplicaAckPolicy.ALL, other: true };
}

function testPutOpt(ver: RowVersion) {
    let opt1: PutIfOpt = {};
    opt1.compartment = "c";
    opt1.timeout = 10000;
    opt1.durability = Durabilities.COMMIT_NO_SYNC;
    opt1.ttl = 1;
    opt1.ttl = TTLUtil.ofDays(1);
    opt1.ttl = TTLUtil.ofHours(10);
    opt1.ttl = { days: 1 };
    opt1.returnExisting = true;
    opt1.updateTTLToDefault = false;
    opt1.exactMatch = true;
    opt1.identityCacheSize = 100;

    // @ts-expect-error Invalid type for compartment.
    opt1.compartment = 1;
    // @ts-expect-error Invalid type for timeout.
    opt1.timeout = "10000";
    // @ts-expect-error Invalid type for durability.
    opt1.durability = "COMMIT_SYNC";
    // @ts-expect-error Invalid type for ttl.
    opt1.ttl = "2 DAYS";
    
    // TODO: enable when have exclusive properties
    // ts-expect-error Empty object for ttl.
    opt1.ttl = {};
    
    // @ts-expect-error Invalid property for ttl.
    opt1.ttl = { day: 5 };
    
    // TODO: enable when have exclusive properties
    // ts-expect-error Cannot specify both days and hours in ttl.
    opt1.ttl = { days: 2, hours: 3 };

    // @ts-expect-error Invalid extra property for ttl.
    opt1.ttl = { hours: 1, hour: 2 };
    // @ts-expect-error Invalid type for returnExisting.
    opt1.returnExisting = 1;
    // @ts-expect-error Invalid type for updateTTLToDefault.
    opt1.updateTTLToDefault = 0;
    // @ts-expect-error Invalid type for exactMatch.
    opt1.exactMatch = "true";
    // @ts-expect-error Invalid type for identityCacheSize.
    opt1.identityCacheSize = "100";

    // @ts-expect-error Invalid extra property.
    opt1.consistency = ver;
    // @ts-expect-error Invalid extra property, available only in PutOpt.
    opt1.ifAbsent = true;
    // @ts-expect-error Invalid extra property, available only in PutOpt.
    opt1.matchVersion = ver;

    // TODO: enable when have exclusive properties
    // ts-expect-error Mutually exclusive properties.
    opt1 = { ttl: TTLUtil.ofDays(5), updateTTLToDefault: true };

    let opt2: PutOpt = {};

    // Assignability test will disregard optional properties so we have to
    // test types with required properties.
    expectTypeOf<Required<PutOpt>>().toMatchTypeOf<Required<PutIfOpt>>();
    expectTypeOf<Required<PutIfOpt>>().not.toMatchTypeOf<Required<PutOpt>>();

    opt2.ifAbsent = true;
    opt2.ifPresent = true;
    opt2.matchVersion = ver;

    // Explicit cast from to/from Buffer is allowed.
    opt2.matchVersion = Buffer.alloc(10) as RowVersion;
    const buf: Buffer = opt2.matchVersion as Buffer;

    // @ts-expect-error Invalid type for ifAbsent.
    opt2.ifAbsent = 1;
    // @ts-expect-error Invalid type for ifPresent.
    opt2.ifPresent = 0;
    // @ts-expect-error Invalid type for matchVersion.
    opt2.matchVersion = {};
    // @ts-expect-error Invalid type for matchVersion.
    opt2.matchVersion = Buffer.alloc(10);

    opt2 = { ifAbsent: true };

    // TODO: enable when have exclusive properties
    // ts-expect-error Mutually exclusive properties.
    opt2.ifPresent = true;
    // ts-expect-error Mutually exclusive properties.
    opt2.matchVersion = ver;
    // ts-expect-error Mutually exclusive properties.
    opt2 = { ifPresent: true, matchVersion: ver };
    // ts-expect-error Mutually exclusive properties.
    opt2 = { ifAbsent: true, matchVersion: ver };
}

function testTypedPutResult(res: PutResult<MyRow>) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.success).toBeBoolean();
    expectTypeOf(res.version).toEqualTypeOf<RowVersion|undefined>();
    expectTypeOf(res.existingRow).toEqualTypeOf<MyRow|undefined>();
    expectTypeOf(res.existingVersion).toEqualTypeOf<RowVersion|undefined>();
    expectTypeOf(res.existingModificationTime)
        .toEqualTypeOf<Date|undefined>();
    expectTypeOf(res.generatedValue).toEqualTypeOf<IdentityField|undefined>();

    // all properties of PutResult must be read-only
    expectTypeOf<Readonly<PutResult>>().toEqualTypeOf<PutResult>();

    // @ts-expect-error Invalid property in PutResult.
    res.modificationTime;
}

function testUntypedPutResult(res: PutResult) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.success).toBeBoolean();
    expectTypeOf(res.version).toEqualTypeOf<RowVersion|undefined>();
    expectTypeOf(res.existingRow).toEqualTypeOf<AnyRow|undefined>();
    expectTypeOf(res.existingVersion).toEqualTypeOf<RowVersion|undefined>();
    expectTypeOf(res.existingModificationTime)
        .toEqualTypeOf<Date|undefined>();
    expectTypeOf(res.generatedValue).toEqualTypeOf<IdentityField|undefined>();

    // all properties of PutResult must be read-only
    expectTypeOf<Readonly<PutResult>>().toEqualTypeOf<PutResult>();

    // @ts-expect-error Invalid property in PutResult.
    res.modificationTime;
}

import { MyRow } from "./get";

async function testPutTyped() {
    const put = (client.put)<MyRow>;
    let res: PutResult;

    expectTypeOf(put).toBeFunction();
    expectTypeOf(put).parameters.toEqualTypeOf<[string, MyRow, PutOpt?]>();
    expectTypeOf(put).parameter(0).toBeString();
    expectTypeOf(put).parameter(1).toEqualTypeOf<MyRow>();
    expectTypeOf(put).parameter(2).toEqualTypeOf<PutOpt|undefined>();
    expectTypeOf(put).returns.not.toEqualTypeOf<PutResult<MyRow>>();
    expectTypeOf(put).returns.resolves.toEqualTypeOf<PutResult<MyRow>>();
    expectTypeOf(put).toBeCallableWith("table",
        { pk1: "a", pk2: 1, pk3: new Decimal(1), col6: true });
    expectTypeOf(put).toBeCallableWith("table", { 
        pk1: "a",
        pk2: 1,
        pk3: new Decimal(1),
        col1: Buffer.alloc(10),
        col6: true
    }, {
        timeout: 1,
        ttl: TTLUtil.ofHours(24),
        ifAbsent: true
    });

    res = await client.put<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2], col6: false });
    res = await client.put<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col1: Buffer.alloc(1), col2: new Date(),
        col3: [ 1, 2 ], col4: {}, col5: new Map<string, Date[]>(),
        col6: false },
        { compartment: "compartment", timeout: 5000 });

    

    // @ts-expect-error Missing row.
    client.put<MyRow>("table");
    // @ts-expect-error Invalid table name.
    client.put<MyRow>(1, { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true });
    client.put<MyRow>("table",  { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true },
        // @ts-expect-error Invalid option.
        { timeou: 10000 });

    // @ts-expect-error Invalid type for row
    client.put<MyRow>("table", new Map<string, any>());
    // @ts-expect-error Invalid row, missing required field col6
    client.put<MyRow>("table", { pk1: "a", pk2: 1, pk3: new Decimal(1) });
    // @ts-expect-error Invalid row, wrong type for pk3
    client.put<MyRow>("table", { pk1: "a", pk2: 1, pk3: 1.1, col6: false });
    client.put<MyRow>("table",  { pk1: "a", pk2: 1, pk3: new Decimal(1),
        // @ts-expect-error Invalid row, invalid extra property
        col6: true, col7: 1 });
}

async function testPutUntyped() {
    const put = (client.put)<AnyRow>;

    expectTypeOf(put).toBeFunction();
    expectTypeOf(put).parameters.toEqualTypeOf<[string, any, PutOpt?]>();
    expectTypeOf(put).parameter(0).toBeString();
    expectTypeOf(put).parameter(1).toEqualTypeOf<AnyRow>();
    expectTypeOf(put).parameter(2).toEqualTypeOf<PutOpt|undefined>();
    expectTypeOf(put).returns.not.toEqualTypeOf<PutResult>();
    expectTypeOf(put).returns.resolves.toEqualTypeOf<PutResult>();
    expectTypeOf(put).toBeCallableWith("table", { x: 1});
    expectTypeOf(put).toBeCallableWith("table", { x: 1 }, {
        timeout: 1,
        ttl: TTLUtil.ofHours(24),
        ifAbsent: true
    });

    let res = await client.put("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2], col6: false });
    expectTypeOf(res).toMatchTypeOf<PutResult<MyRow>>();
    res = await client.put("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col1: Buffer.alloc(1), col2: new Date(),
        col3: [ 1, 2 ], col4: {}, col5: new Map<string, Date[]>(),
        col6: false },
        { compartment: "compartment", timeout: 5000 });

    let res2 = await client.put("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2] });
    // Missing required field col6 of MyRow
    expectTypeOf(res2).not.toMatchTypeOf<PutResult<MyRow>>();

    // @ts-expect-error Missing row.
    client.put("table");
    // @ts-expect-error Invalid table name.
    client.put(1, { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true });
    // @ts-expect-error Invalid row.
    client.put("table", "a");
    client.put("table",  { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true },
        // @ts-expect-error Invalid option.
        { timeou: 10000 });

    let res3: PutResult<MyRow> = await client.put("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col6: true });

    // Below, type for row should be inferred from res3 as MyRow.

    // @ts-expect-error Invalid type for row
    res3 = await client.put("table", new Map<string, any>());
    // @ts-expect-error Invalid row, missing required field col6
    res3 = await client.put("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1) });
    // @ts-expect-error Invalid row, wrong type for pk3
    res3 = await client.put("table", { pk1: "a", pk2: 1, pk3: 1.1,
        col6: false });
}

async function testPutIfAbsentTyped() {
    const putIfAbsent = (client.putIfAbsent)<MyRow>;
    let res: PutResult;

    expectTypeOf(putIfAbsent).toBeFunction();
    expectTypeOf(putIfAbsent).parameters
        .toEqualTypeOf<[string, MyRow, PutOpt?]>();
    expectTypeOf(putIfAbsent).parameter(0).toBeString();
    expectTypeOf(putIfAbsent).parameter(1).toEqualTypeOf<MyRow>();
    expectTypeOf(putIfAbsent).parameter(2)
        .toEqualTypeOf<PutIfOpt|undefined>();
    expectTypeOf(putIfAbsent).returns.not.toEqualTypeOf<PutResult<MyRow>>();
    expectTypeOf(putIfAbsent).returns.resolves
        .toEqualTypeOf<PutResult<MyRow>>();
    expectTypeOf(putIfAbsent).toBeCallableWith("table",
        { pk1: "a", pk2: 1, pk3: new Decimal(1), col6: true });
    expectTypeOf(putIfAbsent).toBeCallableWith("table", { 
        pk1: "a",
        pk2: 1,
        pk3: new Decimal(1),
        col1: Buffer.alloc(10),
        col6: true
    }, {
        timeout: 1,
        ttl: TTLUtil.ofHours(24)
    });

    res = await client.putIfAbsent<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2], col6: false });
    res = await client.putIfAbsent<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col1: Buffer.alloc(1), col2: new Date(),
        col3: [ 1, 2 ], col4: {}, col5: new Map<string, Date[]>(),
        col6: false },
        { compartment: "compartment", timeout: 5000 });

    const myRow = { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true } as MyRow;

    // @ts-expect-error Missing row.
    client.putIfAbsent<MyRow>("table");
    // @ts-expect-error Invalid table name.
    client.putIfAbsent<MyRow>(1, myRow);
    // @ts-expect-error Invalid option.
    client.putIfAbsent<MyRow>("table", myRow, { timeou: 10000 });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfAbsent<MyRow>("table", myRow, { ifAbsent: true });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfAbsent<MyRow>("table", myRow, { ifPresent: false });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfAbsent<MyRow>("table", myRow, { matchVersion: ver });

    // @ts-expect-error Invalid type for row
    client.putIfAbsent<MyRow>("table", new Map<string, any>());
    // @ts-expect-error Invalid row, missing required field col6
    client.putIfAbsent<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1) });
    client.putIfAbsent<MyRow>("table",
        // @ts-expect-error Invalid row, wrong type for pk3
        { pk1: "a", pk2: 1, pk3: 1.1, col6: false });
    client.putIfAbsent<MyRow>("table",  { pk1: "a", pk2: 1,
        // @ts-expect-error Invalid row, invalid extra property
        pk3: new Decimal(1), col6: true, col7: 1 });
}

async function testPutIfAbsentUntyped() {
    const putIfAbsent = (client.putIfAbsent)<AnyRow>;

    expectTypeOf(putIfAbsent).toBeFunction();
    expectTypeOf(putIfAbsent).parameters
        .toEqualTypeOf<[string, any, PutOpt?]>();
    expectTypeOf(putIfAbsent).parameter(0).toBeString();
    expectTypeOf(putIfAbsent).parameter(1).toEqualTypeOf<AnyRow>();
    expectTypeOf(putIfAbsent).parameter(2)
        .toEqualTypeOf<PutIfOpt|undefined>();
    expectTypeOf(putIfAbsent).returns.not.toEqualTypeOf<PutResult>();
    expectTypeOf(putIfAbsent).returns.resolves.toEqualTypeOf<PutResult>();
    expectTypeOf(putIfAbsent).toBeCallableWith("table", { x: 1});
    expectTypeOf(putIfAbsent).toBeCallableWith("table", { x: 1 }, {
        timeout: 1,
        ttl: TTLUtil.ofHours(24)
    });

    let res = await client.putIfAbsent("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2], col6: false });
    expectTypeOf(res).toMatchTypeOf<PutResult<MyRow>>();
    res = await client.putIfAbsent("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col1: Buffer.alloc(1), col2: new Date(),
        col3: [ 1, 2 ], col4: {}, col5: new Map<string, Date[]>(),
        col6: false },
        { compartment: "compartment", timeout: 5000 });

    let res2 = await client.putIfAbsent("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2] });
    // Missing required field col6 of MyRow
    expectTypeOf(res2).not.toMatchTypeOf<PutResult<MyRow>>();

    const myRow = { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true } as MyRow;

    // @ts-expect-error Missing row.
    client.putIfAbsent("table");
    // @ts-expect-error Invalid table name.
    client.putIfAbsent(1, myRow);
    // @ts-expect-error Invalid option.
    client.putIfAbsent("table", myRow, { timeou: 10000 });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfAbsent("table", myRow, { ifAbsent: true });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfAbsent("table", myRow, { ifPresent: false });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfAbsent("table", myRow, { matchVersion: ver });
    
    let res3: PutResult<MyRow> = await client.putIfAbsent("table",
        { pk1: "a", pk2: 1, pk3: new Decimal(1), col6: true });

    // Below, type for row should be inferred from res3 as MyRow.

    // @ts-expect-error Invalid type for row
    res3 = await client.putIfAbsent("table", new Map<string, any>());
    // @ts-expect-error Invalid row, missing required field col6
    res3 = await client.putIfAbsent("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1) });
    // @ts-expect-error Invalid row, wrong type for pk3
    res3 = await client.putIfAbsent("table", { pk1: "a", pk2: 1, pk3: 1.1,
        col6: false });
}

async function testPutIfPresentTyped() {
    const putIfPresent = (client.putIfPresent)<MyRow>;
    let res: PutResult;

    expectTypeOf(putIfPresent).toBeFunction();
    expectTypeOf(putIfPresent).parameters
        .toEqualTypeOf<[string, MyRow, PutOpt?]>();
    expectTypeOf(putIfPresent).parameter(0).toBeString();
    expectTypeOf(putIfPresent).parameter(1).toEqualTypeOf<MyRow>();
    expectTypeOf(putIfPresent).parameter(2)
        .toEqualTypeOf<PutIfOpt|undefined>();
    expectTypeOf(putIfPresent).returns.not.toEqualTypeOf<PutResult<MyRow>>();
    expectTypeOf(putIfPresent).returns.resolves
        .toEqualTypeOf<PutResult<MyRow>>();
    expectTypeOf(putIfPresent).toBeCallableWith("table",
        { pk1: "a", pk2: 1, pk3: new Decimal(1), col6: true });
    expectTypeOf(putIfPresent).toBeCallableWith("table", { 
        pk1: "a",
        pk2: 1,
        pk3: new Decimal(1),
        col1: Buffer.alloc(10),
        col6: true
    }, {
        timeout: 1,
        ttl: TTLUtil.ofHours(24)
    });

    res = await client.putIfPresent<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2], col6: false });
    res = await client.putIfPresent<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col1: Buffer.alloc(1), col2: new Date(),
        col3: [ 1, 2 ], col4: {}, col5: new Map<string, Date[]>(),
        col6: false },
        { compartment: "compartment", timeout: 5000 });

    
    const myRow = { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true } as MyRow;

     // @ts-expect-error Missing row.
     client.putIfPresent<MyRow>("table");
     // @ts-expect-error Invalid table name.
     client.putIfPresent<MyRow>(1, myRow);
     // @ts-expect-error Invalid option.
     client.putIfPresent<MyRow>("table", myRow, { timeou: 10000 });
     // @ts-expect-error Invalid option for putIfAbsent.
     client.putIfPresent<MyRow>("table", myRow, { ifAbsent: true });
     // @ts-expect-error Invalid option for putIfAbsent.
     client.putIfPresent<MyRow>("table", myRow, { ifPresent: false });
     // @ts-expect-error Invalid option for putIfAbsent.
     client.putIfPresent<MyRow>("table", myRow, { matchVersion: ver }); 

    // @ts-expect-error Invalid type for row
    client.putIfPresent<MyRow>("table", new Map<string, any>());
    // @ts-expect-error Invalid row, missing required field col6
    client.putIfPresent<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1) });
    client.putIfPresent<MyRow>("table",
        // @ts-expect-error Invalid row, wrong type for pk3
        { pk1: "a", pk2: 1, pk3: 1.1, col6: false });
    client.putIfPresent<MyRow>("table",  { pk1: "a", pk2: 1,
        // @ts-expect-error Invalid row, invalid extra property
        pk3: new Decimal(1), col6: true, col7: 1 });
}

async function testPutIfPresentUntyped() {
    const putIfPresent = (client.putIfPresent)<AnyRow>;

    expectTypeOf(putIfPresent).toBeFunction();
    expectTypeOf(putIfPresent).parameters
        .toEqualTypeOf<[string, any, PutOpt?]>();
    expectTypeOf(putIfPresent).parameter(0).toBeString();
    expectTypeOf(putIfPresent).parameter(1).toEqualTypeOf<AnyRow>();
    expectTypeOf(putIfPresent).parameter(2)
        .toEqualTypeOf<PutIfOpt|undefined>();
    expectTypeOf(putIfPresent).returns.not.toEqualTypeOf<PutResult>();
    expectTypeOf(putIfPresent).returns.resolves.toEqualTypeOf<PutResult>();
    expectTypeOf(putIfPresent).toBeCallableWith("table", { x: 1});
    expectTypeOf(putIfPresent).toBeCallableWith("table", { x: 1 }, {
        timeout: 1,
        ttl: TTLUtil.ofHours(24)
    });

    let res = await client.putIfPresent("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2], col6: false });
    expectTypeOf(res).toMatchTypeOf<PutResult<MyRow>>();
    res = await client.putIfPresent("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col1: Buffer.alloc(1), col2: new Date(),
        col3: [ 1, 2 ], col4: {}, col5: new Map<string, Date[]>(),
        col6: false },
        { compartment: "compartment", timeout: 5000 });

    let res2 = await client.putIfPresent("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2] });
    // Missing required field col6 of MyRow
    expectTypeOf(res2).not.toMatchTypeOf<PutResult<MyRow>>();

    const myRow = { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true } as MyRow;

    // @ts-expect-error Missing row.
    client.putIfPresent("table");
    // @ts-expect-error Invalid table name.
    client.putIfPresent(1, myRow);
    // @ts-expect-error Invalid option.
    client.putIfPresent("table", myRow, { timeou: 10000 });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfPresent("table", myRow, { ifAbsent: true });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfPresent("table", myRow, { ifPresent: false });
    // @ts-expect-error Invalid option for putIfAbsent.
    client.putIfPresent("table", myRow, { matchVersion: ver });

    let res3: PutResult<MyRow> = await client.putIfPresent("table",
        { pk1: "a", pk2: 1, pk3: new Decimal(1), col6: true });

    // Below, type for row should be inferred from res3 as MyRow.

    // @ts-expect-error Invalid type for row
    res3 = await client.putIfPresent("table", new Map<string, any>());
    // @ts-expect-error Invalid row, missing required field col6
    res3 = await client.putIfPresent("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1) });
    // @ts-expect-error Invalid row, wrong type for pk3
    res3 = await client.putIfPresent("table", { pk1: "a", pk2: 1, pk3: 1.1,
        col6: false });
}

async function testPutIfVersionTyped(ver: RowVersion) {
    const putIfVersion = (client.putIfVersion)<MyRow>;
    let res: PutResult;

    expectTypeOf(putIfVersion).toBeFunction();
    expectTypeOf(putIfVersion).parameters
        .toEqualTypeOf<[string, MyRow, RowVersion, PutOpt?]>();
    expectTypeOf(putIfVersion).parameter(0).toBeString();
    expectTypeOf(putIfVersion).parameter(1).toEqualTypeOf<MyRow>();
    expectTypeOf(putIfVersion).parameter(2).toEqualTypeOf<RowVersion>();
    expectTypeOf(putIfVersion).parameter(3)
        .toEqualTypeOf<PutIfOpt|undefined>();
    expectTypeOf(putIfVersion).returns.not.toEqualTypeOf<PutResult<MyRow>>();
    expectTypeOf(putIfVersion).returns.resolves
        .toEqualTypeOf<PutResult<MyRow>>();
    expectTypeOf(putIfVersion).toBeCallableWith("table",
        { pk1: "a", pk2: 1, pk3: new Decimal(1), col6: true }, ver);
    expectTypeOf(putIfVersion).toBeCallableWith("table", { 
        pk1: "a",
        pk2: 1,
        pk3: new Decimal(1),
        col1: Buffer.alloc(10),
        col6: true
    }, ver, {
        timeout: 1,
        ttl: TTLUtil.ofHours(24)
    });

    res = await client.putIfVersion<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2], col6: false }, ver);
    res = await client.putIfVersion<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col1: Buffer.alloc(1), col2: new Date(),
        col3: [ 1, 2 ], col4: {}, col5: new Map<string, Date[]>(),
        col6: false }, ver,
        { compartment: "compartment", timeout: 5000 });

    const myRow = { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true } as MyRow;

    // @ts-expect-error Missing table name.
    client.putIfVersion<MyRow>();
    // @ts-expect-error Missing row.
    client.putIfVersion<MyRow>("table", ver);
    // @ts-expect-error Missing row version.
    client.putIfVersion<MyRow>("table", myRow);
    // @ts-expect-error Invalid table name.
    client.putIfVersion<MyRow>(1, myRow, ver);
    // @ts-expect-error Invalid type for version.
    client.putIfVersion<MyRow>("table", myRow, Buffer.alloc(10));
    // @ts-expect-error Invalid option.
    client.putIfVersion<MyRow>("table", myRow, ver, { timeou: 10000 });
    // @ts-expect-error Invalid option for putIfVersion.
    client.putIfVersion<MyRow>("table", myRow, ver, { ifAbsent: true });
    // @ts-expect-error Invalid option for putIfVersion.
    client.putIfVersion<MyRow>("table", myRow, ver, { ifPresent: false });
    // @ts-expect-error Invalid option for putIfVersion.
    client.putIfVersion<MyRow>("table", myRow, ver, { matchVersion: ver });

    // @ts-expect-error Invalid type for row
    client.putIfVersion<MyRow>("table", new Map<string, any>(), ver);
    // @ts-expect-error Invalid row, missing required field col6
    client.putIfVersion<MyRow>("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1) }, ver);
    client.putIfVersion<MyRow>("table",
        // @ts-expect-error Invalid row, wrong type for pk3
        { pk1: "a", pk2: 1, pk3: 1.1, col6: false }, ver);
    client.putIfVersion<MyRow>("table",  { pk1: "a", pk2: 1,
        // @ts-expect-error Invalid row, invalid extra property
        pk3: new Decimal(1), col6: true, col7: 1 }, ver);
}

async function testPutIfVersionUntyped(ver: RowVersion) {
    const putIfVersion = (client.putIfVersion)<AnyRow>;

    expectTypeOf(putIfVersion).toBeFunction();
    expectTypeOf(putIfVersion).parameters
        .toEqualTypeOf<[string, any, RowVersion, PutOpt?]>();
    expectTypeOf(putIfVersion).parameter(0).toBeString();
    expectTypeOf(putIfVersion).parameter(1).toEqualTypeOf<AnyRow>();
    expectTypeOf(putIfVersion).parameter(2).toEqualTypeOf<RowVersion>();
    expectTypeOf(putIfVersion).parameter(3)
        .toEqualTypeOf<PutIfOpt|undefined>();
    expectTypeOf(putIfVersion).returns.not.toEqualTypeOf<PutResult>();
    expectTypeOf(putIfVersion).returns.resolves.toEqualTypeOf<PutResult>();
    expectTypeOf(putIfVersion).toBeCallableWith("table", { x: 1}, ver);
    expectTypeOf(putIfVersion).toBeCallableWith("table", { x: 1 }, ver, {
        timeout: 1,
        ttl: TTLUtil.ofHours(24)
    });

    let res = await client.putIfVersion("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2], col6: false }, ver);
    expectTypeOf(res).toMatchTypeOf<PutResult<MyRow>>();
    res = await client.putIfVersion("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col1: Buffer.alloc(1), col2: new Date(),
        col3: [ 1, 2 ], col4: {}, col5: new Map<string, Date[]>(),
        col6: false }, ver,
        { compartment: "compartment", timeout: 5000 });

    let res2 = await client.putIfVersion("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col3: [ 1, 2] }, ver);
    // Missing required field col6 of MyRow
    expectTypeOf(res2).not.toMatchTypeOf<PutResult<MyRow>>();

    const myRow = { pk1: "a", pk2: 1, pk3: new Decimal(1),
        col6: true } as MyRow;

    // @ts-expect-error Missing table name.
    client.putIfVersion<MyRow>();
    // @ts-expect-error Missing row.
    client.putIfVersion("table", ver);
    // @ts-expect-error Missing row version.
    client.putIfVersion("table", myRow);
    // @ts-expect-error Invalid table name.
    client.putIfVersion(1, myRow, ver);
    // @ts-expect-error Invalid type for version.
    client.putIfVersion("table", myRow, Buffer.alloc(10));
    // @ts-expect-error Invalid option.
    client.putIfVersion("table", myRow, ver, { timeou: 10000 });
    // @ts-expect-error Invalid option for putIfVersion.
    client.putIfVersion("table", myRow, ver, { ifAbsent: true });
    // @ts-expect-error Invalid option for putIfVersion.
    client.putIfVersion("table", myRow, ver, { ifPresent: false });
    // @ts-expect-error Invalid option for putIfVersion.
    client.putIfVersion("table", myRow, ver, { matchVersion: ver });

    let res3: PutResult<MyRow> = await client.putIfVersion("table", myRow,
        ver);

    // Below, type for row should be inferred from res3 as MyRow.

    // @ts-expect-error Invalid type for row
    res3 = await client.putIfVersion("table", new Map<string, any>(), ver);
    // @ts-expect-error Invalid row, missing required field col6
    res3 = await client.putIfVersion("table", { pk1: "a", pk2: 1,
        pk3: new Decimal(1) }, ver);
    // @ts-expect-error Invalid row, wrong type for pk3
    res3 = await client.putIfVersion("table", { pk1: "a", pk2: 1, pk3: 1.1,
        col6: false }, ver);
}
