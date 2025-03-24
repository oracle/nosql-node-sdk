/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, Durability, Consistency, QueryOpt,
    RowVersion, ConsumedCapacity, FieldValue, Durabilities,
    PrepareOpt, PreparedStatement, QueryContinuationKey,
    MultiDeleteContinuationKey, QueryResult, AnyRow } from "../../../";

const client = new NoSQLClient("nosuchfile.json");

function testPrepareOpt() {
    let opt: PrepareOpt = {};

    opt.compartment = "c";
    opt.namespace = "n";
    opt.timeout = 10000;
    opt.getQueryPlan = true;
    opt.getResultSchema = true;

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 1;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid type for getQueryPlan.
    opt.getQueryPlan = 1;
    // @ts-expect-error Invalid type for getResultSchema.
    opt.getResultSchema = "true";

    // @ts-expect-error Invalid extra option.
    opt.consistency = Consistency.EVENTUAL;
}

function testPreparedStatement(prepStmt: PreparedStatement,
    cc: ConsumedCapacity) {
    // PreparedStatement is not publicly constructible.
    expectTypeOf(PreparedStatement).constructorParameters
        .toEqualTypeOf<never>();

    expectTypeOf(prepStmt.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    // @ts-expect-error consumedCapacity is read-only
    prepStmt.consumedCapacity = cc;

    expectTypeOf(prepStmt.bindings)
        .toEqualTypeOf<{ [key: string]: FieldValue }>();
    prepStmt.bindings = { "$var1": 1, "$var2": "val2" };
    
    expectTypeOf(prepStmt.sql).toBeString();
    // @ts-expect-error sql is read-only
    prepStmt.sql = "sql";
    expectTypeOf(prepStmt.queryPlan).toBeString();
    // @ts-expect-error queryPlan is read-only
    prepStmt.queryPlan = "sql";
    expectTypeOf(prepStmt.resultSchema).toBeString();
    // @ts-expect-error resultSchema is read-only
    prepStmt.resultSchema = "sql";

    expectTypeOf(prepStmt.set).toBeFunction();
    expectTypeOf(prepStmt.set).parameters
        .toEqualTypeOf<[string|number, FieldValue]>();
    expectTypeOf(prepStmt.set).parameter(0).toEqualTypeOf<string|number>();
    expectTypeOf(prepStmt.set).parameter(1).toEqualTypeOf<FieldValue>();
    expectTypeOf(prepStmt.set).returns.toEqualTypeOf<PreparedStatement>();
    expectTypeOf(prepStmt.set).toBeCallableWith("$var1", "val1");
    // @ts-expect-error Invalid type for nameOrPosition.
    prepStmt.set(true, "val1");

    expectTypeOf(prepStmt.clearAll).toBeFunction();
    expectTypeOf(prepStmt.clearAll).parameters.toEqualTypeOf<[]>();
    expectTypeOf(prepStmt.clearAll).returns.toEqualTypeOf<PreparedStatement>();
    prepStmt = prepStmt.clearAll();
    // @ts-expect-error Invalid parameters.
    prepStmt.clearAll(1, "a");

    expectTypeOf(prepStmt.copyStatement).toBeFunction();
    expectTypeOf(prepStmt.copyStatement).parameters.toEqualTypeOf<[]>();
    expectTypeOf(prepStmt.copyStatement).returns
        .toEqualTypeOf<PreparedStatement>();
    prepStmt = prepStmt.copyStatement();
    // @ts-expect-error Invalid parameters.
    prepStmt.copyStatement(1, "a");

    // @ts-expect-error Invalid property.
    prepStmt.stmt;
}

async function testPrepare() {
    expectTypeOf(client.prepare).toBeFunction();
    expectTypeOf(client.prepare).parameters
        .toEqualTypeOf<[string, PrepareOpt?]>();
    expectTypeOf(client.prepare).parameter(0).toBeString();
    expectTypeOf(client.prepare).parameter(1)
        .toEqualTypeOf<PrepareOpt|undefined>();
    expectTypeOf(client.prepare).returns.not
        .toEqualTypeOf<PreparedStatement>();
    expectTypeOf(client.prepare).returns.resolves
        .toEqualTypeOf<PreparedStatement>();
    expectTypeOf(client.prepare).toBeCallableWith("sql",
        { compartment: "c", getQueryPlan: true });
    expectTypeOf(client.prepare).toBeCallableWith("sql",
        { timeout: 1, getResultSchema: true });

    let res: PreparedStatement = await client.prepare("sql");
    res = await client.prepare("sql",
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Invalid type for sql.
    client.prepare(1);
    // @ts-expect-error Invalid type for getResultSchema.
    client.prepare("sql", { getResultSchema: 1 });
    // @ts-expect-error Invalid option.
    client.prepare("sql", { timeou: 10000 });
}

function testQueryOpt(ver: RowVersion, ck: QueryContinuationKey) {
    let opt: QueryOpt = {};

    opt.compartment = "c";
    opt.namespace = "n";
    opt.timeout = 10000;
    opt.consistency = Consistency.ABSOLUTE;
    opt.durability = Durabilities.COMMIT_NO_SYNC;
    opt.limit = 1000;
    opt.maxReadKB = 100;
    opt.maxWriteKB = 100;
    opt.maxMemoryMB = 10;
    opt.continuationKey = ck;
    opt.continuationKey = undefined;

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 1;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid type for consistency.
    opt.consistency = 1;
    // @ts-expect-error Invalid type for durability.
    opt.durability = "COMMIT_SYNC";
    // @ts-expect-error Invalid type for limit.
    opt.limit = true;
    // @ts-expect-error Invalid type for maxReadKB.
    opt.maxReadKB = new Number(100);
    // @ts-expect-error Invalid type for maxWriteKB.
    opt.maxWriteKB = "100";
    // @ts-expect-error Invalid type for maxMemoryMB.
    opt.maxMemoryMB = 100n;
    // @ts-expect-error Invalid type for continuationKey.
    opt.continuationKey = Buffer.alloc(100);
    // @ts-expect-error Invalid type for continuationKey.
    opt.continuationKey = {};
    // @ts-expect-error Invalid type for continuationKey.
    opt.continuationKey = {} as MultiDeleteContinuationKey;

    // @ts-expect-error Invalid extra option.
    opt.getQueryPlan = true;
}

import { MyRow } from "./get";

function testTypedQueryResult(res: QueryResult<MyRow>) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.rows).toEqualTypeOf<MyRow[]>();
    expectTypeOf(res.continuationKey)
        .toEqualTypeOf<QueryContinuationKey|undefined>();

    // all properties of MultiDeleteResult must be read-only
    expectTypeOf<Readonly<QueryResult<MyRow>>>()
        .toEqualTypeOf<QueryResult<MyRow>>();

    // @ts-expect-error Invalid property in QueryResult.
    res.queryPlan;
}

function testUntypedQueryResult(res: QueryResult) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.rows).toEqualTypeOf<AnyRow[]>();
    expectTypeOf(res.continuationKey)
        .toEqualTypeOf<QueryContinuationKey|undefined>();

    // all properties of MultiDeleteResult must be read-only
    expectTypeOf<Readonly<QueryResult>>()
        .toEqualTypeOf<QueryResult>();

    // @ts-expect-error Invalid property in QueryResult.
    res.queryPlan;
}

async function testQueryTyped(prepStmt: PreparedStatement,
    ck: QueryContinuationKey) {
    const query = (client.query)<MyRow>;

    expectTypeOf(query).toBeFunction();
    expectTypeOf(query).parameters
        .toEqualTypeOf<[string|PreparedStatement, QueryOpt?]>();
    expectTypeOf(query).parameter(0)
        .toEqualTypeOf<string|PreparedStatement>();
    expectTypeOf(query).parameter(1)
        .toEqualTypeOf<QueryOpt|undefined>();
    expectTypeOf(query).returns.not.toEqualTypeOf<QueryResult<MyRow>>();
    expectTypeOf(query).returns.resolves.toEqualTypeOf<QueryResult<MyRow>>();
    expectTypeOf(query).toBeCallableWith("sql");
    expectTypeOf(query).toBeCallableWith(prepStmt);
    expectTypeOf(query).toBeCallableWith("sql", { timeout: 1,
        durability: Durabilities.COMMIT_SYNC } );
    expectTypeOf(query).toBeCallableWith(prepStmt, { timeout: 1,
        maxMemoryMB: 1000, continuationKey: ck } );
    
    let res = await client.query<MyRow>("sql", { maxWriteKB: 100 });
    expectTypeOf(res).toEqualTypeOf<QueryResult<MyRow>>;
    res = await client.query(prepStmt, { compartment: "compartment",
        timeout: 5000 });

    // @ts-expect-error Missing arguments.
    client.query<MyRow>();
    // @ts-expect-error Invalid sql statement or prepared statement.
    client.query<MyRow>(1);
    // @ts-expect-error Invalid sql statement or prepared statement.
    client.query<MyRow>(Buffer.alloc(16));
    // @ts-expect-error Invalid QueryOpt.
    client.query<MyRow>("sql", 1);
    // @ts-expect-error Invalid maxWriteKB.
    client.query<MyRow>("table", { maxWriteKB: "100" });
    // @ts-expect-error Invalid option.
    client.query<MyRow>("table", { timeou: 10000 });
}

async function testQueryUntyped(prepStmt: PreparedStatement,
    ck: QueryContinuationKey) {
    const query = (client.query)<AnyRow>;

    expectTypeOf(query).toBeFunction();
    expectTypeOf(query).parameters
        .toEqualTypeOf<[string|PreparedStatement, QueryOpt?]>();
    expectTypeOf(query).parameter(0)
        .toEqualTypeOf<string|PreparedStatement>();
    expectTypeOf(query).parameter(1)
        .toEqualTypeOf<QueryOpt|undefined>();
    expectTypeOf(query).returns.not.toEqualTypeOf<QueryResult<AnyRow>>();
    expectTypeOf(query).returns.resolves.toEqualTypeOf<QueryResult<AnyRow>>();
    expectTypeOf(query).toBeCallableWith("sql");
    expectTypeOf(query).toBeCallableWith(prepStmt);
    expectTypeOf(query).toBeCallableWith("sql", { timeout: 1,
        durability: Durabilities.COMMIT_SYNC } );
    expectTypeOf(query).toBeCallableWith(prepStmt, { timeout: 1,
        maxMemoryMB: 1000, continuationKey: ck } );
    
    let res = await client.query("sql", { maxWriteKB: 100 });
    expectTypeOf(res).toEqualTypeOf<QueryResult<AnyRow>>;
    res = await client.query(prepStmt, { compartment: "compartment",
        timeout: 5000 });

    // @ts-expect-error Missing arguments.
    client.query();
    // @ts-expect-error Invalid sql statement or prepared statement.
    client.query(1);
    // @ts-expect-error Invalid sql statement or prepared statement.
    client.query(Buffer.alloc(16));
    // @ts-expect-error Invalid QueryOpt.
    client.query("sql", 1);
    // @ts-expect-error Invalid maxWriteKB.
    client.query("table", { maxWriteKB: "100" });
    // @ts-expect-error Invalid option.
    client.query("table", { timeou: 10000 });
}

async function testQueryIterableTyped(prepStmt: PreparedStatement,
    ck: QueryContinuationKey) {
    const queryIterable = (client.queryIterable)<MyRow>;

    expectTypeOf(queryIterable).toBeFunction();
    expectTypeOf(queryIterable).parameters
        .toEqualTypeOf<[string|PreparedStatement, QueryOpt?]>();
    expectTypeOf(queryIterable).parameter(0)
        .toEqualTypeOf<string|PreparedStatement>();
    expectTypeOf(queryIterable).parameter(1)
        .toEqualTypeOf<QueryOpt|undefined>();
    expectTypeOf(queryIterable).returns.not
        .toEqualTypeOf<QueryResult>();
    expectTypeOf(queryIterable).returns
        .toEqualTypeOf<AsyncIterable<QueryResult<MyRow>>>();
        expectTypeOf(queryIterable).toBeCallableWith("sql");
        expectTypeOf(queryIterable).toBeCallableWith(prepStmt);
        expectTypeOf(queryIterable).toBeCallableWith("sql", { timeout: 1,
            durability: Durabilities.COMMIT_SYNC } );
        expectTypeOf(queryIterable).toBeCallableWith(prepStmt, { timeout: 1,
            maxMemoryMB: 1000, continuationKey: ck } );
    
    let it = client.queryIterable<MyRow>("sql", { maxWriteKB: 100 });
    expectTypeOf(it).toEqualTypeOf<AsyncIterable<QueryResult<MyRow>>>();
    it = client.queryIterable(prepStmt, { compartment: "compartment",
        timeout: 5000 });

    for await (const itRes of it) {
        expectTypeOf(itRes).toEqualTypeOf<QueryResult<MyRow>>();
    }

    // @ts-expect-error Missing arguments.
    client.queryIterable<MyRow>();
    // @ts-expect-error Invalid statement.
    client.queryIterable<MyRow>(123);
    client.queryIterable<MyRow>("sql",
        // @ts-expect-error Invalid option.
        { durabiilty: Durabilities.COMMIT_SYNC });
    // @ts-expect-error Using wrong return type.
    res = client.queryIterable<MyRow>("sql");
    // @ts-expect-error Using wrong return type.
    res = await client.queryIterable<MyRow>("sql");
}

async function testQueryIterableUntyped(prepStmt: PreparedStatement,
    ck: QueryContinuationKey) {
    const queryIterable = (client.queryIterable)<AnyRow>;

    expectTypeOf(queryIterable).toBeFunction();
    expectTypeOf(queryIterable).parameters
        .toEqualTypeOf<[string|PreparedStatement, QueryOpt?]>();
    expectTypeOf(queryIterable).parameter(0)
        .toEqualTypeOf<string|PreparedStatement>();
    expectTypeOf(queryIterable).parameter(1)
        .toEqualTypeOf<QueryOpt|undefined>();
    expectTypeOf(queryIterable).returns.not
        .toEqualTypeOf<QueryResult>();
    expectTypeOf(queryIterable).returns
        .toEqualTypeOf<AsyncIterable<QueryResult>>();
        expectTypeOf(queryIterable).toBeCallableWith("sql");
        expectTypeOf(queryIterable).toBeCallableWith(prepStmt);
        expectTypeOf(queryIterable).toBeCallableWith("sql", { timeout: 1,
            durability: Durabilities.COMMIT_SYNC } );
        expectTypeOf(queryIterable).toBeCallableWith(prepStmt, { timeout: 1,
            maxMemoryMB: 1000, continuationKey: ck } );
    
    let it = client.queryIterable("sql", { maxWriteKB: 100 });
    expectTypeOf(it).toEqualTypeOf<AsyncIterable<QueryResult<AnyRow>>>();
    it = client.queryIterable(prepStmt, { compartment: "compartment",
        timeout: 5000 });

    for await (const itRes of it) {
        expectTypeOf(itRes).toEqualTypeOf<QueryResult>();
    }

    // @ts-expect-error Missing arguments.
    client.queryIterable();
    // @ts-expect-error Invalid statement.
    client.queryIterable(123);
    // @ts-expect-error Invalid option.
    client.queryIterable("sql", { durabiilty: Durabilities.COMMIT_SYNC });
    // @ts-expect-error Using wrong return type.
    res = client.queryIterable("sql");
    // @ts-expect-error Using wrong return type.
    res = await client.queryIterable("sql");
}
