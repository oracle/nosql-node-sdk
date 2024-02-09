/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, TableDDLOpt, TableResult, TableLimits, CapacityMode,
    TableState, TableETag, DefinedTags, FreeFormTags, ModifyTableOpt,
    ReplicaInfo } from "../../../";

const client = new NoSQLClient("nosuchfile.json");

function testTableLimits() {
    let limits: TableLimits;

    limits = { readUnits: 1, writeUnits: 1, storageGB: 1 };
    
    // @ts-expect-error Missing all properties.
    limits = {};

    // TODO: enable when have exclusive properties
    // ts-expect-error Missing writeUnits.
    limits = { readUnits: 1, storageGB: 1 };
    // @ts-expect-error Missing storageGB.
    limits = { readUnits: 1, writeUnits: 1 };

    // @ts-expect-error Invalid type for readUnits.
    limits = { readUnits: "a", writeUnits: 1, storageGB: 1 };
    // @ts-expect-error Invalid type for storageGB.
    limits = { readUnits: 1, writeUnits: 1, storageGB: true };
    // @ts-expect-error Invalid extra property.
    limits = { readUnits: 1, writeUnits: 1, storageGB: 1, other: 1 };
    
    limits = { mode: CapacityMode.PROVISIONED, readUnits: 10, writeUnits: 10,
        storageGB: 10 };
    
    limits = { mode: CapacityMode.ON_DEMAND, storageGB: 10 };
    
    // TODO: enable when have exclusive properties
    // ts-expect-error readUnits and writeUnits not allowed for ON_DEMAND.
    limits = { mode: CapacityMode.ON_DEMAND, readUnits: 10, writeUnits: 10,
        storageGB: 10 };
    // ts-expect-error readUnits not allowed for ON_DEMAND.
    limits = { mode: CapacityMode.ON_DEMAND, readUnits: 10, storageGB: 10 };

    // @ts-expect-error Missing storageGB for ON_DEMAND.
    limits = { mode: CapacityMode.ON_DEMAND };

    // @ts-expect-error Invalid type for storageGB.
    limits = { mode: CapacityMode.ON_DEMAND, storageGB: "10" };
    // @ts-expect-error Invalid extra property.
    limits = { mode: CapacityMode.ON_DEMAND, other: 1 };
}

function testModifyTableOpt(res: TableResult) {
    let opt: ModifyTableOpt = {};

    opt.compartment = "c";
    opt.namespace = "n";

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 1;

    opt.timeout = 10000;

    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    
    opt.matchETag = res.etag;
    
    // @ts-expect-error Invalid type for matchETag.
    opt.matchETag = 1;
    // @ts-expect-error Invalid type for matchETag.
    opt.matchETag = {};
    // @ts-expect-error Invalid type for matchETag, must be TableETag.
    opt.matchETag = "etag";

    opt.complete = true;
    opt.complete = undefined;

    // @ts-expect-error Invalid type for complete.
    opt.complete = 1;

    opt.delay = 1000;

    // @ts-expect-error Invalid type for delay.
    opt.delay = "1000";

    // @ts-expect-error Invalid extra property in opt.
    opt.other = 1;
}

function testTableDDLOpt() {
    // Assignability test will disregard optional properties so we have to
    // test types with required properties.
    expectTypeOf<Required<TableDDLOpt>>()
        .toMatchTypeOf<Required<ModifyTableOpt>>();
    expectTypeOf<Required<ModifyTableOpt>>()
        .not.toMatchTypeOf<Required<TableDDLOpt>>();

    let opt: TableDDLOpt = {};
    
    // @ts-expect-error Invalid type for table limits.
    opt.tableLimits = 10;
    // @ts-expect-error Typo in readUnits.
    opt.tableLimits = { readUnts: 1, writeUnits: 1, storageGB: 1 };

    opt.tableLimits = { readUnits: 1, writeUnits: 1, storageGB: 1 };

    opt.definedTags = { "ns1": { "key1": "val1" }, "ns2": {} };
    
    // @ts-expect-error Invalid type for definedTags.
    opt.definedTags = "tags";
    // @ts-expect-error Missing grouping by namespace.
    opt.definedTags = { "key1": "val1" };
    // @ts-expect-error Invalid value type for key.
    opt.definedTags = { "ns1": { "key1": 1 } };

    opt.freeFormTags = { "key1": "val1", "key2": "val2" };

    // @ts-expect-error Invalid type for freeFormTags.
    opt.freeFormTags = "tags";
    // @ts-expect-error Grouping by namespace (not allowed).
    opt.freeFormTags = { "ns1": { "key1": "val1" } };
    // @ts-expect-error Invalid value type for key.
    opt.freeFormTags = { "key1": 1 };

    // @ts-expect-error Invalid extra property in opt.
    opt.other = 1;
}

function testTableResult(res: TableResult) {
    // check result types
    expectTypeOf(res.tableName).toBeString();
    expectTypeOf(res.tableState).toEqualTypeOf<TableState>();
    expectTypeOf(res.compartmentId).toEqualTypeOf<string|undefined>();
    expectTypeOf(res.namespace).toEqualTypeOf<string|undefined>();
    expectTypeOf(res.tableOCID).toEqualTypeOf<string|undefined>();
    expectTypeOf(res.schema).toEqualTypeOf<string|undefined>();
    expectTypeOf(res.tableDDL).toEqualTypeOf<string|undefined>();
    expectTypeOf(res.tableLimits).toEqualTypeOf<TableLimits|undefined>();
    expectTypeOf(res.etag).toEqualTypeOf<TableETag|undefined>();
    expectTypeOf(res.definedTags)
        .toEqualTypeOf<{[ns: string]: {[key: string]: string}}|undefined>();
    expectTypeOf(res.definedTags).toEqualTypeOf<DefinedTags|undefined>();
    expectTypeOf(res.freeFormTags)
        .toEqualTypeOf<{[key: string]: string}|undefined>();
    expectTypeOf(res.freeFormTags).toEqualTypeOf<FreeFormTags|undefined>();
    expectTypeOf(res.operationId).toEqualTypeOf<string|undefined>();
    expectTypeOf(res.isSchemaFrozen).toEqualTypeOf<boolean|undefined>();
    expectTypeOf(res.isReplicated).toEqualTypeOf<boolean|undefined>();
    expectTypeOf(res.isLocalReplicaInitialized)
        .toEqualTypeOf<boolean|undefined>();
    expectTypeOf(res.replicas).toEqualTypeOf<ReplicaInfo[]|undefined>();

    // all properties of TableResult must be read-only
    expectTypeOf<Readonly<TableResult>>().toEqualTypeOf<TableResult>();
}

async function testTableDDL() {
    expectTypeOf(client.tableDDL).toBeFunction();
    expectTypeOf(client.tableDDL).parameters
        .toEqualTypeOf<[string, TableDDLOpt?]>();
    expectTypeOf(client.tableDDL).parameter(0).toBeString();
    expectTypeOf(client.tableDDL).parameter(1)
        .toEqualTypeOf<TableDDLOpt|undefined>();
    expectTypeOf(client.tableDDL).returns.not.toEqualTypeOf<TableResult>();
    expectTypeOf(client.tableDDL).returns.resolves
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.tableDDL).toBeCallableWith("stmt");
    expectTypeOf(client.tableDDL).toBeCallableWith("stmt", { timeout: 1 });
    
    // @ts-expect-error
    client.tableDDL(); 
    // @ts-expect-error
    client.tableDDL(1);
    // @ts-expect-error
    client.tableDDL({ statement: "stmt" });
    // @ts-expect-error
    client.tableDDL("stmt", 1);
    // @ts-expect-error
    client.tableDDL("stmt", "opt");
    // @ts-expect-error
    client.tableDDL("stmt", {}, "extra");
    // @ts-expect-error
    client.tableDDL("stmt", {}, {}, {});
}

function testSetTableLimits(limits: TableLimits) {
    expectTypeOf(client.setTableLimits).toBeFunction();
    // Somehow using TableDDLOpt instead of ModifyTableOpt passes here to, so
    // it's better to also check parameters individually.
    expectTypeOf(client.setTableLimits).parameters
        .toEqualTypeOf<[string, TableLimits, ModifyTableOpt?]>();
    expectTypeOf(client.setTableLimits).parameter(0).toBeString();
    expectTypeOf(client.setTableLimits).parameter(1)
        .toEqualTypeOf<TableLimits>();
    expectTypeOf(client.setTableLimits).parameter(2)
        .toEqualTypeOf<ModifyTableOpt|undefined>();
    expectTypeOf(client.setTableLimits).returns.not
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.setTableLimits).returns.resolves
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.setTableLimits).toBeCallableWith("table", limits);
    expectTypeOf(client.setTableLimits).toBeCallableWith("table", limits,
        { timeout: 1 });
    
    // @ts-expect-error
    client.setTableLimits(); 
    // @ts-expect-error
    client.setTableLimits(1);
    // @ts-expect-error
    client.setTableLimits({ table: "table" });
    // @ts-expect-error
    client.setTableLimits("table", 1);
    // @ts-expect-error Invalid type of complete.
    client.setTableLimits("table", limits, { complete: 1 });
    // @ts-expect-error
    client.setTableLimits("table", limits, undefined, "extra");
    // @ts-expect-error
    client.setTableLimits("table", limits, {}, {});
}

function testSetTableTags() {
    expectTypeOf(client.setTableTags).toBeFunction();
    // Somehow using TableDDLOpt instead of ModifyTableOpt passes here to, so
    // it's better to also check parameters individually.
    expectTypeOf(client.setTableTags).parameters
        .toEqualTypeOf<[string, DefinedTags|undefined, FreeFormTags?,
            ModifyTableOpt?]>();
    expectTypeOf(client.setTableTags).parameter(0).toBeString();
    expectTypeOf(client.setTableTags).parameter(1)
        .toEqualTypeOf<DefinedTags|undefined>();
    expectTypeOf(client.setTableTags).parameter(2)
        .toEqualTypeOf<FreeFormTags|undefined>();
    expectTypeOf(client.setTableTags).parameter(3)
        .toEqualTypeOf<ModifyTableOpt|undefined>();
    expectTypeOf(client.setTableTags).returns.not
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.setTableTags).returns.resolves
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.setTableTags).toBeCallableWith("table",
        { "ns" : { "key": "val" } });
    expectTypeOf(client.setTableTags).toBeCallableWith("table",
        { "ns" : { "key": "val" } }, { "key": "val" });
    expectTypeOf(client.setTableTags).toBeCallableWith("table",
        undefined, { "key": "val" });
    expectTypeOf(client.setTableTags).toBeCallableWith("table",
        { "ns" : { "key": "val" } }, undefined, { delay: 1000 });
    
    // @ts-expect-error
    client.setTableTags(); 
    // @ts-expect-error
    client.setTableTags(1);
    // @ts-expect-error
    client.setTableTags({ table: "table" });
    // @ts-expect-error
    client.setTableTags("table", 1);
    // @ts-expect-error Invalid type of complete.
    client.setTableTags("table", limits, { complete: 1 });
    // @ts-expect-error
    client.setTableTags("table", limits, undefined, "extra");
    // @ts-expect-error
    client.setTableTags("table", limits, {}, {});
}
