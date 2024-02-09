/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, GetIndexesOpt, GetIndexOpt, IndexInfo }
    from "../../../";

const client = new NoSQLClient("nosuchfile.json");

function testGetIndexesOpt() {
    let opt: GetIndexesOpt = {};
    opt.compartment = "c";
    opt.namespace = "n";

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 1;

    opt.timeout = 10000;
    opt.indexName = "index";

    // @ts-expect-error Invalid type for index name.
    opt.indexName = 1;
    // @ts-expect-error Invalid type for index name.
    opt.indexName = { name: "index" };
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid extra property.
    opt.complete = true;
    // @ts-expect-error Invalid extra property.
    opt.delay = 1000;
    // @ts-expect-error Invalid extra property.
    opt.other = 1;
}

function testGetIndexOpt() {
    let opt: GetIndexOpt = {};
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
    opt.indexName = "index";
    // @ts-expect-error Invalid extra property.
    opt.delay = 1000;
}

function testIndexInfo(res: IndexInfo) {
    // check result types
    expectTypeOf(res.indexName).toBeString();
    expectTypeOf(res.fields).toEqualTypeOf<string[]>();
    expectTypeOf(res.fieldTypes)
        .toEqualTypeOf<((string|undefined)[])|undefined>();
    
    // all properties of IndexInfo must be read-only
    expectTypeOf<Readonly<IndexInfo>>().toEqualTypeOf<IndexInfo>();

    // @ts-expect-error Invalid property in IndexInfo.
    res.tableName;
}

async function testGetIndexes() {
    let res: IndexInfo[];
    let idxInfo: IndexInfo;

    expectTypeOf(client.getIndexes).toBeFunction();
    expectTypeOf(client.getIndexes).parameters
        .toEqualTypeOf<[string, GetIndexesOpt?]>();
    expectTypeOf(client.getIndexes).parameter(0).toBeString();
    expectTypeOf(client.getIndexes).parameter(1)
        .toEqualTypeOf<GetIndexesOpt|undefined>();
    expectTypeOf(client.getIndexes).returns.not.toEqualTypeOf<IndexInfo[]>();
    expectTypeOf(client.getIndexes).returns.resolves
        .toEqualTypeOf<IndexInfo[]>();
    expectTypeOf(client.getIndexes).toBeCallableWith("table");
    expectTypeOf(client.getIndexes).toBeCallableWith("table", { timeout: 1 });
    expectTypeOf(client.getIndexes).toBeCallableWith("table",
        { indexName: "indexName" });

    res = await client.getIndexes("table");
    res = await client.getIndexes("table", { compartment: "compartment",
        timeout: 5000, indexName: "indexName" });

    // @ts-expect-error Missing table name.
    client.getIndexes();
    // @ts-expect-error Missing table name.
    client.getIndexes({ timeout: 1 });
    // @ts-expect-error Invalid table name.
    client.getIndexes(123);
    // @ts-expect-error Invalid option.
    client.getIndexes("table", { delay: 1000 });
    // @ts-expect-error Wrong result type.
    idxInfo = await client.getIndexes("table");
}

async function testGetIndex() {
    let res: IndexInfo;
    let arr: IndexInfo[];

    expectTypeOf(client.getIndex).toBeFunction();
    expectTypeOf(client.getIndex).parameters
        .toEqualTypeOf<[string, string, GetIndexOpt?]>();
    expectTypeOf(client.getIndex).parameter(0).toBeString();
    expectTypeOf(client.getIndex).parameter(1).toBeString();
    expectTypeOf(client.getIndex).parameter(2)
        .toEqualTypeOf<GetIndexOpt|undefined>();
    expectTypeOf(client.getIndex).returns.not.toEqualTypeOf<IndexInfo>();
    expectTypeOf(client.getIndex).returns.resolves
        .toEqualTypeOf<IndexInfo>();
    expectTypeOf(client.getIndex).toBeCallableWith("table", "index");
    expectTypeOf(client.getIndex).toBeCallableWith("table", "index",
        { compartment: "compartment", timeout: 1 });
    expectTypeOf(client.getIndex).toBeCallableWith("table", "index",
        { timeout: 1 });

    res = await client.getIndex("table", "idx");
    res = await client.getIndex("table", "idx", { compartment: "compartment",
        timeout: 5000 });

    // @ts-expect-error Missing table name.
    client.getIndex();
    // @ts-expect-error Missing index name.
    client.getIndex("table");
    // @ts-expect-error Invalid table name.
    client.getIndex(123, "index");
    // @ts-expect-error Invalid index name.
    client.getIndex("table", 1);
    // @ts-expect-error Invalid option.
    client.getIndex("table", "index", { delay: 1000 });
}
