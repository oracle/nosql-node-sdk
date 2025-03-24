/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, TableResult, AdminResult, TableState, CompletionOpt,
    GetTableOpt }
    from "../../../";

const client = new NoSQLClient("nosuchfile.json");

function testGetTableOpt() {
    let opt: GetTableOpt = {};
    opt.compartment = "c";
    opt.namespace = "n";

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 1;

    opt.timeout = 10000;

    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid extra property.
    opt.complete = true;
    // @ts-expect-error Invalid extra property.
    opt.delay = 1000;
    // @ts-expect-error Invalid extra property.
    opt.other = 1;
}

function testCompletionOpt() {
    let opt: CompletionOpt = {};
    opt.compartment = "c";
    opt.namespace = "n";

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 1;

    opt.timeout = 10000;

    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid extra property.
    opt.complete = true;
    // @ts-expect-error Invalid type for delay property.
    opt.delay = "1000";

    opt.delay = 1000;

    // @ts-expect-error Invalid extra property.
    opt.other = 1;
}

async function testGetTable(res: TableResult) {
    expectTypeOf(client.getTable).toBeFunction();
    expectTypeOf(client.getTable).parameters
        .toEqualTypeOf<[string|TableResult, GetTableOpt?]>();
    expectTypeOf(client.getTable).parameter(0)
        .toEqualTypeOf<string|TableResult>();
    expectTypeOf(client.getTable).parameter(1)
        .toEqualTypeOf<GetTableOpt|undefined>();
    expectTypeOf(client.getTable).returns.not.toEqualTypeOf<TableResult>();
    expectTypeOf(client.getTable).returns.resolves
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.getTable).toBeCallableWith("table");
    expectTypeOf(client.getTable).toBeCallableWith("table", { timeout: 1 });
    expectTypeOf(client.getTable).toBeCallableWith(res);
    expectTypeOf(client.getTable).toBeCallableWith(res, { timeout: 1 });

    await client.getTable("table");
    await client.getTable(res);
    await client.getTable(res, { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Invalid table name or result.
    client.getTable({ timeout: 1 });
    // @ts-expect-error Invalid table name or result.
    client.getTable(123);
    // @ts-expect-error Invalid option.
    client.getTable("table", { delay: 1000 });
}

async function testForTableState(res: TableResult) {
    expectTypeOf(client.forTableState).toBeFunction();
    expectTypeOf(client.forTableState).parameters
        .toEqualTypeOf<[string, TableState, CompletionOpt?]>();
    expectTypeOf(client.forTableState).parameter(0).toBeString();
    expectTypeOf(client.forTableState).parameter(1)
        .toEqualTypeOf<TableState>();
    expectTypeOf(client.forTableState).parameter(2)
        .toEqualTypeOf<CompletionOpt|undefined>();
    expectTypeOf(client.forTableState).returns.not
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.forTableState).returns.resolves
        .toEqualTypeOf<TableResult>();
    expectTypeOf(client.forTableState).toBeCallableWith("table",
        TableState.ACTIVE);
    expectTypeOf(client.forTableState).toBeCallableWith("table",
        TableState.ACTIVE, { timeout: 1, delay: 1 });

    await client.forTableState("table", TableState.DROPPED);
    await client.forTableState("table", TableState.ACTIVE,
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing table state argument.
    client.forTableState("table");
    // @ts-expect-error Invalid table name.
    client.forTableState(res, TableState.ACTIVE);
    // @ts-expect-error Invalid table state.
    client.forTableState("table", "ACTIVE");
    // @ts-expect-error Invalid table state.
    client.forTableState("table", 1);
    // @ts-expect-error Invalid table state.
    client.forTableState("table", TableState.OK);
    // @ts-expect-error Invalid CompletionOpt.
    client.forTableState("table", TableState.ACTIVE, { complete: true });
}

async function testForCompletion(tableRes: TableResult,
    adminRes: AdminResult) {
    expectTypeOf(client.forCompletion).toBeFunction();
    expectTypeOf(client.forCompletion).parameters
        .toMatchTypeOf<[TableResult|AdminResult, CompletionOpt?]>();
    expectTypeOf(client.forCompletion).parameter(0)
        .toMatchTypeOf<TableResult|AdminResult>();
    expectTypeOf(client.forCompletion).parameter(1)
        .toEqualTypeOf<CompletionOpt|undefined>();
    expectTypeOf(client.forCompletion).returns.not
        .toMatchTypeOf<TableResult|AdminResult>();
    expectTypeOf(client.forCompletion).returns.resolves
        .toMatchTypeOf<TableResult|AdminResult>();

    tableRes = await client.forCompletion(tableRes);
    tableRes = await client.forCompletion(tableRes, { timeout: 10000 });
    adminRes = await client.forCompletion(adminRes);
    adminRes = await client.forCompletion(adminRes, { delay: 1000 });

    // @ts-expect-error Missing table or admin state argument.
    client.forCompletion();
    // @ts-expect-error Invalid table or admin state argument.
    client.forCompletion({});
    // @ts-expect-error Invalid CompletionOpt.
    client.forCompletion(tableRes, 1);
    // @ts-expect-error Invalid CompletionOpt.
    client.forCompletion("table", TableState.ACTIVE, { complete: true });

    // @ts-expect-error Wrong result type.
    adminRes = await client.forCompletion(tableRes);
    // @ts-expect-error Wrong result type.
    tableRes = await client.forCompletion(adminRes);
}
