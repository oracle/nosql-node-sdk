/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, TableUsageOpt, TableUsage, TableUsageResult }
    from "../../../";

const client = new NoSQLClient("nosuchfile.json");

function testTableUsageOpt() {
    let opt: TableUsageOpt = {};

    opt.compartment = "c";
    opt.timeout = 10000;
    opt.startTime = new Date();
    opt.startTime = "2023-04-28T00:00:00Z";
    opt.startTime = 1000000;
    opt.endTime = new Date();
    opt.endTime = "2023-04-28T00:00:00Z";
    opt.endTime = 1000000;
    opt.limit = 10;
    opt.startIndex = 10;

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid namespace option for cloud-only API.
    opt.namespace = "namespace";
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid type for startTime.
    opt.startTime = { d: 1000 };
    // @ts-expect-error Invalid type for endTime.
    opt.endTime = true;
    // @ts-expect-error Invalid type for limit.
    opt.limit = "10";
    // @ts-expect-error Invalid type for startIndex.
    opt.startIndex = "10";
    // @ts-expect-error Invalid extra property.
    opt.lastIndex = 0;
}

function testTableUsage(tu: TableUsage) {
    expectTypeOf(tu.startTime).toEqualTypeOf<Date>();
    expectTypeOf(tu.secondsInPeriod).toBeNumber();
    expectTypeOf(tu.readUnits).toBeNumber();
    expectTypeOf(tu.writeUnits).toBeNumber();
    expectTypeOf(tu.storageGB).toBeNumber();
    expectTypeOf(tu.readThrottleCount).toBeNumber();
    expectTypeOf(tu.writeThrottleCount).toBeNumber();
    expectTypeOf(tu.storageThrottleCount).toBeNumber();
    expectTypeOf(tu.maxShardUsagePercent).toBeNumber();
   
    // all properties of TableUsage must be read-only
    expectTypeOf<Readonly<TableUsage>>().toEqualTypeOf<TableUsage>();

    // @ts-expect-error Invalid property in TableUsage.
    tu.tableName;
}

function testTableUsageResult(res: TableUsageResult) {
    expectTypeOf(res.tableName).toBeString();
    expectTypeOf(res.usageRecords).toEqualTypeOf<TableUsage[]>();
    expectTypeOf(res.nextIndex).toBeNumber();

    // all properties of TableUsageResult must be read-only
    expectTypeOf<Readonly<TableUsageResult>>()
        .toEqualTypeOf<TableUsageResult>();

    // @ts-expect-error Invalid property in TableUsageResult.
    res.lastIndex;
}

async function testGetTableUsage() {
    let res: TableUsageResult;

    expectTypeOf(client.getTableUsage).toBeFunction();
    expectTypeOf(client.getTableUsage).parameters
        .toEqualTypeOf<[string, TableUsageOpt?]>();
    expectTypeOf(client.getTableUsage).parameter(0).toBeString();
    expectTypeOf(client.getTableUsage).parameter(1)
        .toEqualTypeOf<TableUsageOpt|undefined>();
    expectTypeOf(client.getTableUsage).returns.not
        .toEqualTypeOf<TableUsageResult>();
    expectTypeOf(client.getTableUsage).returns.resolves
        .toEqualTypeOf<TableUsageResult>();
    expectTypeOf(client.getTableUsage).toBeCallableWith("table");
    expectTypeOf(client.getTableUsage).toBeCallableWith("table",
        { timeout: 1 });
    expectTypeOf(client.getTableUsage).toBeCallableWith("table",
        { startTime: new Date(), endTime: 1000000, limit: 1, startIndex: 2 });

    res = await client.getTableUsage("table");
    res = await client.getTableUsage("table", { compartment: "compartment",
        timeout: 5000, limit: 2 });

    // @ts-expect-error Missing table name.
    client.getTableUsage();
    // @ts-expect-error Missing table name.
    client.getTableUsage({ timeout: 1 });
    // @ts-expect-error Invalid table name.
    client.getTableUsage(123);
    // @ts-expect-error Invalid option.
    client.getTableUsage("table", { lastIndex: 1 });
}

async function testTableUsageIterable() {
    let it: AsyncIterable<TableUsageResult>;
    let res: TableUsageResult;

    expectTypeOf(client.tableUsageIterable).toBeFunction();
    expectTypeOf(client.tableUsageIterable).parameters
        .toEqualTypeOf<[string, TableUsageOpt?]>();
    expectTypeOf(client.tableUsageIterable).parameter(0).toBeString();
    expectTypeOf(client.tableUsageIterable).parameter(1)
        .toEqualTypeOf<TableUsageOpt|undefined>();
    expectTypeOf(client.tableUsageIterable).returns.not
        .toEqualTypeOf<TableUsageResult>();
    expectTypeOf(client.tableUsageIterable).returns
        .toEqualTypeOf<AsyncIterable<TableUsageResult>>();
    expectTypeOf(client.tableUsageIterable).toBeCallableWith("table");
    expectTypeOf(client.tableUsageIterable).toBeCallableWith("table",
        { timeout: 1 });
    expectTypeOf(client.tableUsageIterable).toBeCallableWith("table",
        { startTime: new Date(), endTime: 1000000, limit: 1, startIndex: 2 });

    it =  client.tableUsageIterable("table");
    it = client.tableUsageIterable("table", { compartment: "compartment",
        timeout: 5000, limit: 2 });

    for await (const itRes of it) {
        expectTypeOf(itRes).toEqualTypeOf<TableUsageResult>();
    }

    // @ts-expect-error Missing table name.
    client.tableUsageIterable();
    // @ts-expect-error Missing table name.
    client.tableUsageIterable({ timeout: 1 });
    // @ts-expect-error Invalid table name.
    client.tableUsageIterable(123);
    // @ts-expect-error Invalid option.
    client.tableUsageIterable("table", { lastIndex: 1 });
    // @ts-expect-error Using wrong return type.
    res = client.tableUsageIterable("table");
    // @ts-expect-error Using wrong return type.
    res = await client.tableUsageIterable("table");
}
