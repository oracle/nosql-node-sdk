/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, MultiDeleteOpt, Durability,
    RowVersion, PutResult, ConsumedCapacity, FieldValue, Durabilities,
    TTLUtil, SyncPolicy, ReplicaAckPolicy, DeleteResult, RowKey, AnyRow,
    AnyKey, MultiDeleteContinuationKey, MultiDeleteResult, FieldRange }
    from "../../../";

import Decimal from "decimal.js";

const client = new NoSQLClient("nosuchfile.json");

function testFieldRange() {
    let fr: FieldRange;
    fr = { fieldName: "name", startWith: 1 };
    fr = { fieldName: "name", startAfter: 1 };
    fr = { fieldName: "name", endWith: 1 };
    fr = { fieldName: "name", endBefore: 1 };
    fr = { fieldName: "name", startWith: 1, endWith: 2 };
    fr = { fieldName: "name", startWith: 1, endBefore: 2 };
    fr = { fieldName: "name", startAfter: 1, endWith: 2 };
    fr = { fieldName: "name", startAfter: 1, endBefore: 2 };
    fr = { fieldName: "name", startWith: false, endWith: true };
    fr = { fieldName: "name", startAfter: "a", endWith: "zzzzz" };

    // @ts-expect-error
    fr = 100;
    // @ts-expect-error
    fr = "range";
    // @ts-expect-error
    fr = new Date();
    // @ts-expect-error
    fr = {};
    
    // TODO: enable when have exclusive properties
    // ts-expect-error
    fr = { fieldName: "name" };
    // ts-expect-error
    fr = { fieldName: "name", startWith: 1, startAfter: 0 };
    // ts-expect-error
    fr = { fieldName: "name", startWith: 1, startAfter: 0, endWith: 2 };
    // ts-expect-error
    fr = { fieldName: "name", endWith: 1, endBefore: 0 };
    // ts-expect-error
    fr = { fieldName: "name", startWith: 1, endWith: 1, endBefore: 2 };

    // @ts-expect-error
    fr = { field: "name", startWith: 1 };
}

function testDeleteRangeOpt(ver: RowVersion, ck: MultiDeleteContinuationKey) {
    let opt: MultiDeleteOpt = {};

    opt.compartment = "c";
    opt.namespace = "n";
    opt.timeout = 10000;
    opt.durability = Durabilities.COMMIT_NO_SYNC;
    opt.fieldRange = { fieldName: "id", startWith: 1, endWith: 20 };
    opt.maxWriteKB = 100;
    opt.continuationKey = ck;
    opt.continuationKey = undefined;

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 1;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid type for durability.
    opt.durability = "COMMIT_SYNC";
    // @ts-expect-error Invalid field range.
    opt.fieldRange = { startWith: 1, endWith: 20 };
    // @ts-expect-error Invalid type for maxWriteKB.
    opt.maxWriteKB = "100";
    // @ts-expect-error Invalid type for continuationKey.
    opt.continuationKey = Buffer.alloc(100);
    // @ts-expect-error Invalid type for continuationKey.
    opt.continuationKey = {};

    // @ts-expect-error Invalid extra option.
    opt.returnExisting = 1;
}

function testMultiDeleteResult(res: MultiDeleteResult) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.deletedCount).toBeNumber();
    expectTypeOf(res.continuationKey)
        .toEqualTypeOf<MultiDeleteContinuationKey|undefined>();

    // all properties of MultiDeleteResult must be read-only
    expectTypeOf<Readonly<MultiDeleteResult>>()
        .toEqualTypeOf<MultiDeleteResult>();

    // @ts-expect-error Invalid property in MultiDeleteResult.
    res.version;
}

import { MyRow, MyKey, DerivedKey } from "./get";

async function testDeleteRange() {
    const delRange = client.deleteRange;
    let res: MultiDeleteResult;

    expectTypeOf(delRange).toBeFunction();
    expectTypeOf(delRange<MyRow>).parameters
        .toEqualTypeOf<[string, RowKey<MyRow>, MultiDeleteOpt?]>();
    expectTypeOf(delRange).parameters
        .toEqualTypeOf<[string, AnyKey, MultiDeleteOpt?]>();
    expectTypeOf(delRange).parameter(0).toBeString();
    expectTypeOf(delRange<MyRow>).parameter(1).toEqualTypeOf<RowKey<MyRow>>();
    expectTypeOf(delRange<AnyRow>).parameter(1).toEqualTypeOf<AnyKey>();
    expectTypeOf(delRange).parameter(2)
        .toEqualTypeOf<MultiDeleteOpt|undefined>();
    expectTypeOf(delRange).returns.not.toEqualTypeOf<MultiDeleteResult>();
    expectTypeOf(delRange).returns.resolves
        .toEqualTypeOf<MultiDeleteResult>();
    expectTypeOf(delRange<MyRow>).toBeCallableWith("table", { pk1: "val1" });
    expectTypeOf(delRange<AnyRow>).toBeCallableWith("table", { x: true });
    expectTypeOf(delRange<MyRow>).toBeCallableWith("table",
        { pk2: 10 }, { timeout: 1, fieldRange:
        { fieldName: "a", startAfter: "a" } });

    res = await client.deleteRange("table", { col1: 1 });
    res = await client.deleteRange<MyRow>("table", { pk1: "a", pk2: 1 });
    res = await client.deleteRange("table", { col1: 1, col2: "2" },
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing table name.
    client.deleteRange();
    // @ts-expect-error Missing table name.
    client.deleteRange<MyRow>();
    // @ts-expect-error Missing key.
    client.deleteRange("table");
    // @ts-expect-error Missing key.
    client.deleteRange<MyRow>("table");
    // @ts-expect-error Invalid table name.
    client.deleteRange(1, { pk2: 1 });
    // @ts-expect-error Invalid table name.
    client.deleteRange<MyRow>(1, { pk2: 1 });
    // @ts-expect-error Invalid type for key
    client.deleteRange("table", 1);
    // @ts-expect-error Invalid type for key
    client.deleteRange<MyRow>("table", 1);
    // @ts-expect-error Invalid type for key
    client.deleteRange("table", "a");
    // @ts-expect-error Invalid type for key
    client.deleteRange<MyRow>("table", "a");
    // @ts-expect-error Invalid field range.
    client.deleteRange("table", { "col1": 1 }, { fieldRange: 100 });
    // @ts-expect-error Invalid field range.
    client.deleteRange<MyRow>("table", { "col1": 1 }, { fieldRange: 100 });
    // @ts-expect-error Invalid maxWriteKB.
    client.deleteRange("table", { "col1": 1 }, { maxWriteKB: "100" });
    // @ts-expect-error Invalid maxWriteKB.
    client.deleteRange<MyRow>("table", { "col1": 1 }, { maxWriteKB: "100" });
    // @ts-expect-error Invalid option.
    client.deleteRange("table", { "col1": 1 }, { timeou: 10000 });
    // @ts-expect-error Invalid option.
    client.deleteRange<MyRow>("table", { "col1": 1 }, { timeou: 10000 });

    // @ts-expect-error Invalid type for key
    client.deleteRange<MyRow>("table", new Date());
    // @ts-expect-error Invalid type for key, missing fields pk1 and pk3
    client.deleteRange<MyRow>("table", { x: 1 });
    // @ts-expect-error Invalid type for key, invalid field pk5
    client.deleteRange<MyRow>("table", { pk1: "a", pk5: 1 });
    // @ts-expect-error Invalid type for key, invalid type for pk3
    client.deleteRange<MyRow>("table", { pk1: "a", pk3: 10 });
    // @ts-expect-error Invalid type for key, invalid type for pk1
    client.deleteRange<MyRow>("table", { pk1: 1, pk3: new Decimal(1) });
    // @ts-expect-error Invalid type for key, invalid type for col6
    client.deleteRange<MyRow>("table", { col6: 1 });
}
