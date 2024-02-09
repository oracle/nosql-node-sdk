/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, TableResult, CapacityMode, TableState, ModifyTableOpt,
    ReplicaInfo, AddReplicaOpt, Region, ReplicaStatsOpt, ReplicaStats,
    ReplicaStatsResult, CompletionOpt } from "../../../";

const client = new NoSQLClient("nosuchfile.json");

function testReplicaInfo(ri: ReplicaInfo) {
    expectTypeOf(ri.replicaName).toBeString();
    expectTypeOf(ri.region).toEqualTypeOf<Region|undefined>();
    expectTypeOf(ri.replicaOCID).toBeString();
    expectTypeOf(ri.capacityMode).toEqualTypeOf<CapacityMode>();
    expectTypeOf(ri.writeUnits).toBeNumber();
    expectTypeOf(ri.state).toEqualTypeOf<TableState>();
    // all properties of ReplicaInfo must be read-only
    expectTypeOf<Readonly<ReplicaInfo>>().toEqualTypeOf<ReplicaInfo>();

    // @ts-expect-error Invalid property in ReplicaInfo.
    ri.tableName;
    // @ts-expect-error Invalid property in ReplicaInfo.
    ri.isLocalReplicaInitialized;
}

function testAddReplicaOpt() {
    // Assignability test will disregard optional properties so we have to
    // test types with required properties.
    expectTypeOf<Required<AddReplicaOpt>>()
        .toMatchTypeOf<Required<ModifyTableOpt>>();
    expectTypeOf<Required<ModifyTableOpt>>()
        .not.toMatchTypeOf<Required<AddReplicaOpt>>();
    
    let opt: AddReplicaOpt = {};

    opt.readUnits = 300;
    opt.writeUnits = 200;

    opt.compartment = "c";
    opt.namespace = "n";

    // @ts-expect-error Invalid type for readUnits.
    opt.readUnits = "100";
    // @ts-expect-error Invalid type for writeUnits.
    opt.writeUnits = "100";

    // @ts-expect-error Invalid extra property in opt.
    opt.other = 1;
}

async function testAddReplica() {
    expectTypeOf(client.addReplica).toBeFunction();
    expectTypeOf(client.addReplica).parameters
        .toEqualTypeOf<[string, Region|string, AddReplicaOpt?]>();
    expectTypeOf(client.addReplica).parameter(0).toBeString();
    expectTypeOf(client.addReplica).parameter(1)
        .toEqualTypeOf<Region|string>();
    expectTypeOf(client.addReplica).parameter(2)
        .toEqualTypeOf<AddReplicaOpt|undefined>();
    expectTypeOf(client.addReplica).returns.not.toEqualTypeOf<TableResult>();
    expectTypeOf(client.addReplica).returns.resolves
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.addReplica).toBeCallableWith("table", "region");
    expectTypeOf(client.addReplica).toBeCallableWith("table",
        Region.AP_CHIYODA_1);
    expectTypeOf(client.addReplica).toBeCallableWith("table",
        Region.AP_HYDERABAD_1, { timeout: 1, compartment: "c",
        writeUnits: 20 });
    
    // @ts-expect-error
    client.addReplica(); 
    // @ts-expect-error
    client.addReplica("table");
    // @ts-expect-error
    client.addReplica("table", 1);
    // @ts-expect-error
    client.addReplica("table", {  });
    // @ts-expect-error
    client.addReplica("stmt", 1);
    // @ts-expect-error
    client.addReplica("stmt", { regionId: "region"});
    // @ts-expect-error
    client.addReplica("stmt", Region.CA_TORONTO_1, { something: "a" });
    // @ts-expect-error
    client.addReplica("stmt", "us-phoenix-1", { timeout: 2 }, 1);
}

async function testDropReplica() {
    expectTypeOf(client.dropReplica).toBeFunction();
    expectTypeOf(client.dropReplica).parameters
        .toEqualTypeOf<[string, Region|string, AddReplicaOpt?]>();
    expectTypeOf(client.dropReplica).parameter(0).toBeString();
    expectTypeOf(client.dropReplica).parameter(1)
        .toEqualTypeOf<Region|string>();
    expectTypeOf(client.dropReplica).parameter(2)
        .toEqualTypeOf<ModifyTableOpt|undefined>();
    expectTypeOf(client.dropReplica).returns.not.toEqualTypeOf<TableResult>();
    expectTypeOf(client.dropReplica).returns.resolves
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.dropReplica).toBeCallableWith("table", "region");
    expectTypeOf(client.dropReplica).toBeCallableWith("table",
        Region.AP_CHIYODA_1);
    expectTypeOf(client.dropReplica).toBeCallableWith("table",
        Region.AP_HYDERABAD_1, { timeout: 1, compartment: "c", delay: 1 });
    
    // @ts-expect-error
    client.dropReplica(); 
    // @ts-expect-error
    client.dropReplica("table");
    // @ts-expect-error
    client.dropReplica("table", 1);
    // @ts-expect-error
    client.dropReplica("table", {  });
    // @ts-expect-error
    client.dropReplica("stmt", 1);
    // @ts-expect-error
    client.dropReplica("stmt", { regionId: "region"});
    // @ts-expect-error
    client.dropReplica("stmt", Region.CA_TORONTO_1, { something: "a" });
    // @ts-expect-error
    client.dropReplica("stmt", Region.US_ASHBURN_1, { timeout: 2 }, null);
}

function testReplicaStatsOpt() {
    let opt: ReplicaStatsOpt = {};

    opt.compartment = "c";
    opt.timeout = 10000;
    opt.region = Region.AP_IBARAKI_1;
    opt.region = "ap-ibaraki-1";
    opt.startTime = new Date();
    opt.startTime = "2023-04-28T00:00:00Z";
    opt.startTime = 1000000;
    opt.limit = 10;

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid namespace option for cloud-only API.
    opt.namespace = "namespace";
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid type for region.
    opt.region = 1;
    // @ts-expect-error Invalid type for startTime.
    opt.startTime = { d: 1000 };
    // @ts-expect-error Invalid type for limit.
    opt.limit = "10";
    // @ts-expect-error Invalid extra property.
    opt.endTime = new Date();
    // @ts-expect-error Invalid extra property.
    opt.startIndex = 10;
}

function testReplicaStats(rs: ReplicaStats) {
    expectTypeOf(rs.collectionTime).toEqualTypeOf<Date>();
    expectTypeOf(rs.replicaLag).toEqualTypeOf<number|undefined>;   
    // all properties of TableUsage must be read-only
    expectTypeOf<Readonly<ReplicaStats>>().toEqualTypeOf<ReplicaStats>();

    // @ts-expect-error Invalid property in ReplicaStats.
    rs.tableName;
    // @ts-expect-error Invalid property in ReplicaStats.
    rs.replicaName;
}

function testReplicaStatsResult(res: ReplicaStatsResult) {
    expectTypeOf(res.tableName).toBeString();
    expectTypeOf(res.nextStartTime).toEqualTypeOf<Date>();
    expectTypeOf(res.statsRecords)
        .toEqualTypeOf<{ readonly [key: string]: ReplicaStats[] }>();
    expectTypeOf(res.statsRecords).toBeObject();
    expectTypeOf<keyof typeof res.statsRecords>()
        .toEqualTypeOf<string|number>();
    expectTypeOf<(typeof res.statsRecords)[string]>()
        .toEqualTypeOf<ReplicaStats[]>();
    // properties of statsRecords must be read-only
    expectTypeOf<Readonly<typeof res.statsRecords>>()
        .toEqualTypeOf(res.statsRecords);

    // all properties of ReplicaStatsResult must be read-only
    expectTypeOf<Readonly<ReplicaStats>>().toEqualTypeOf<ReplicaStats>();

    // @ts-expect-error Invalid property in ReplicaStatsResult.
    res.nextIndex;
}

async function testGetReplicaStats() {
    expectTypeOf(client.getReplicaStats).toBeFunction();
    expectTypeOf(client.getReplicaStats).parameters
        .toEqualTypeOf<[string, ReplicaStatsOpt?]>();
    expectTypeOf(client.getReplicaStats).parameter(0).toBeString();
    expectTypeOf(client.getReplicaStats).parameter(1)
        .toEqualTypeOf<ReplicaStatsOpt|undefined>();
    expectTypeOf(client.getReplicaStats).returns
        .not.toEqualTypeOf<ReplicaStatsResult>();
    expectTypeOf(client.getReplicaStats).returns.resolves
        .toEqualTypeOf<ReplicaStatsResult>();
    expectTypeOf(client.getReplicaStats).toBeCallableWith("table");
    expectTypeOf(client.getReplicaStats).toBeCallableWith("table",
        { region: "region" });
    expectTypeOf(client.getReplicaStats).toBeCallableWith("table",
        { region: Region.EU_AMSTERDAM_1 });
    expectTypeOf(client.getReplicaStats).toBeCallableWith("table",
        { startTime: 1 });
    expectTypeOf(client.getReplicaStats).toBeCallableWith("table",
        { startTime: new Date() });
    expectTypeOf(client.getReplicaStats).toBeCallableWith("table",
        { startTime: "date", region: "region" });
    expectTypeOf(client.getReplicaStats).toBeCallableWith("table",
        { timeout: 1, compartment: "c" });
    
    // @ts-expect-error
    client.getReplicaStats(); 
    // @ts-expect-error
    client.getReplicaStats("table", 1);
    // @ts-expect-error
    client.getReplicaStats("table", { regionId: "region"});
    // @ts-expect-error
    client.getReplicaStats("table", { something: "a" });
    // @ts-expect-error
    client.getReplicaStats("table", { startTime: new Date }, "other");
    // @ts-expect-error
    client.getReplicaStats("table", { startTime: new Date }, {});
}

async function testForLocalReplicaInit() {
    expectTypeOf(client.forLocalReplicaInit).toBeFunction();
    expectTypeOf(client.forLocalReplicaInit).parameters
        .toEqualTypeOf<[string, CompletionOpt?]>();
    expectTypeOf(client.forLocalReplicaInit).parameter(0).toBeString();
    expectTypeOf(client.forLocalReplicaInit).parameter(1)
        .toEqualTypeOf<CompletionOpt|undefined>();
    expectTypeOf(client.forLocalReplicaInit).returns.not
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.forLocalReplicaInit).returns.resolves
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.forLocalReplicaInit).toBeCallableWith("table");
    expectTypeOf(client.forLocalReplicaInit).toBeCallableWith("table",
        { timeout: 1, delay: 1 });

    await client.forLocalReplicaInit("table");
    await client.forLocalReplicaInit("table",
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Invalid table name.
    client.forLocalReplicaInit(res, 1);
    // @ts-expect-error Invalid CompletionOpt.
    client.forLocalReplicaInit("table", TableState.ACTIVE);
    // @ts-expect-error Invalid CompletionOpt.
    client.forLocalReplicaInit("table", { complete: true });
}
