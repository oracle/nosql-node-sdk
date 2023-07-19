/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, ListTablesOpt, ListTablesResult }
    from "../../../";

const client = new NoSQLClient("nosuchfile.json");

function testListTablesOpt() {
    let opt: ListTablesOpt = {};

    opt.compartment = "c";
    opt.timeout = 10000;
    opt.startIndex = 1;
    opt.limit = 10;
    opt.namespace = "namespace";

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid type for startIndex.
    opt.startIndex = "1";
    // @ts-expect-error Invalid type for limit.
    opt.limit = true;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = true;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 2;
    // @ts-expect-error Invalid extra property.
    opt.startTime = 0;
}

function testListTablesResult(res: ListTablesResult) {
    expectTypeOf(res.tables).toEqualTypeOf<string[]>();
    expectTypeOf(res.lastIndex).toBeNumber();

    // all properties of ListTablesResult must be read-only
    expectTypeOf<Readonly<ListTablesResult>>()
        .toEqualTypeOf<ListTablesResult>();

    // @ts-expect-error Invalid property in TableUsageResult.
    res.last;
}

async function testListTables() {
    let res: ListTablesResult;

    expectTypeOf(client.listTables).toBeFunction();
    expectTypeOf(client.listTables).parameters
        .toEqualTypeOf<[ListTablesOpt?]>();
    expectTypeOf(client.listTables).parameter(0)
        .toEqualTypeOf<ListTablesOpt|undefined>();
    expectTypeOf(client.listTables).returns.not
        .toEqualTypeOf<ListTablesResult>();
    expectTypeOf(client.listTables).returns.resolves
        .toEqualTypeOf<ListTablesResult>();
    expectTypeOf(client.listTables).toBeCallableWith();
    expectTypeOf(client.listTables).toBeCallableWith({ timeout: 1 });
    expectTypeOf(client.listTables).toBeCallableWith({ startIndex: 10,
        namespace: "namespace" });

    res = await client.listTables();
    res = await client.listTables({ compartment: "compartment",
        timeout: 5000, startIndex: 2 });

    // @ts-expect-error Invalid parameter tableName.
    client.listTables("table");
    // @ts-expect-error Invalid table name.
    client.listTables({ namespace: 0 });
}
