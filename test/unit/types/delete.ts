/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, DeleteIfOpt, DeleteOpt, Durability, RowVersion,
    AnyRow, PutResult, ConsumedCapacity, FieldValue, Durabilities, RowKey,
    AnyKey, TTLUtil, SyncPolicy, ReplicaAckPolicy, DeleteResult }
    from "../../../";

import { Length } from "./utils";
import Decimal from "decimal.js";

const client = new NoSQLClient("nosuchfile.json");

function testDeleteOpt(ver: RowVersion) {
    let opt1: DeleteIfOpt = {};
    opt1.compartment = "c";
    opt1.namespace = "n";
    opt1.timeout = 10000;
    opt1.durability = Durabilities.COMMIT_NO_SYNC;
    opt1.returnExisting = true;

    // @ts-expect-error Invalid type for compartment.
    opt1.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt1.namespace = 1;
    // @ts-expect-error Invalid type for timeout.
    opt1.timeout = "10000";
    // @ts-expect-error Invalid type for durability.
    opt1.durability = "COMMIT_SYNC";
    // @ts-expect-error Invalid type for returnExisting.
    opt1.returnExisting = 1;

    // @ts-expect-error Invalid extra property.
    opt1.consistency = ver;
    // @ts-expect-error Invalid extra property, available only in PutOpt.
    opt1.matchVersion = ver;

    // Assignability test will disregard optional properties so we have to
    // test types with required properties.
    expectTypeOf<Required<DeleteOpt>>()
        .toMatchTypeOf<Required<DeleteIfOpt>>();
    expectTypeOf<Required<DeleteIfOpt>>()
        .not.toMatchTypeOf<Required<DeleteOpt>>();

    let opt2: DeleteOpt = {};
    expectTypeOf(opt1).toMatchTypeOf(opt2);

    opt2.matchVersion = ver;

    // @ts-expect-error Invalid type for matchVersion.
    opt2.matchVersion = {};
    // @ts-expect-error Invalid type for matchVersion.
    opt2.matchVersion = Buffer.alloc(10);
}

import { MyRow, MyKey, DerivedKey } from "./get";

// Some expectTypeOf assertions are not working in generic context so we
// will use concrete type.

function testTypedDeleteResult(res: DeleteResult<MyRow>) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.success).toBeBoolean();
    expectTypeOf(res.existingRow).toEqualTypeOf<MyRow|undefined>();
    expectTypeOf(res.existingVersion).toEqualTypeOf<RowVersion|undefined>();
    expectTypeOf(res.existingModificationTime)
        .toEqualTypeOf<Date|undefined>();

    // all properties of DeleteResult must be read-only
    expectTypeOf<Readonly<DeleteResult<MyRow>>>()
        .toEqualTypeOf<DeleteResult<MyRow>>();

    // @ts-expect-error Invalid property in DeleteResult.
    res.version;
}

function testUntypedDeleteResult(res: DeleteResult) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.success).toBeBoolean();
    type T = typeof res.existingRow;
    expectTypeOf(res.existingRow).toEqualTypeOf<AnyRow|undefined>();
    expectTypeOf(res.existingVersion).toEqualTypeOf<RowVersion|undefined>();
    expectTypeOf(res.existingModificationTime)
        .toEqualTypeOf<Date|undefined>();

    // all properties of DeleteResult must be read-only
    expectTypeOf<Readonly<DeleteResult<MyRow>>>()
        .toEqualTypeOf<DeleteResult<MyRow>>();

    // @ts-expect-error Invalid property in DeleteResult.
    res.version;
}

async function testDeleteTyped() {
    const del = (client.delete)<MyRow>;
    let res: DeleteResult<MyRow>;

    expectTypeOf(del).toBeFunction();
    expectTypeOf<Length<Parameters<typeof del>>>().toEqualTypeOf<2|3>();
    expectTypeOf(del).parameter(0).toBeString();
    expectTypeOf(del).parameter(1).toMatchTypeOf<DerivedKey>();
    expectTypeOf(del).parameter(2).toEqualTypeOf<DeleteOpt|undefined>();
    expectTypeOf(del).returns.not.toEqualTypeOf<DeleteResult<MyRow>>();
    expectTypeOf(del).returns.resolves.toEqualTypeOf<DeleteResult<MyRow>>();
    expectTypeOf(del).toBeCallableWith("table",
        { pk1: "a", pk3: new Decimal(1) });
    expectTypeOf(del).toBeCallableWith("table",
        { pk1: "val1", col2: new Date() },
        { timeout: 1, durability: Durabilities.COMMIT_NO_SYNC });

    res = await client.delete<MyRow>("table",
        { pk2: 10, pk3: new Decimal(1), col6: false });
    res = await client.delete<MyRow>("table",
        { pk1: "", pk2: 1, col2: new Date() },
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing key.
    client.delete<MyRow>("table");
    // @ts-expect-error Invalid table name.
    client.delete<MyRow>(1, { pk1: "" });
    // @ts-expect-error Invalid type for key
    client.delete<MyRow>("table", 1);
    // @ts-expect-error Invalid type for key
    client.delete<MyRow>("table", "a");
    // @ts-expect-error Invalid type for key
    client.delete<MyRow>("table", new Date());
    // @ts-expect-error Invalid type for key, missing fields pk1 and pk3
    client.delete<MyRow>("table", { x: 1 });
    // @ts-expect-error Invalid type for key, invalid field pk5
    client.delete<MyRow>("table", { pk1: "a", pk5: 1 });
    // @ts-expect-error Invalid type for key, invalid type for pk3
    client.delete<MyRow>("table", { pk1: "a", pk3: 10 });
    // @ts-expect-error Invalid type for key, invalid type for pk1
    client.delete<MyRow>("table", { pk1: 1, pk3: new Decimal(1) });
    // @ts-expect-error Invalid type for key, invalid type for col6
    client.delete<MyRow>("table", { col6: 1 });
    // @ts-expect-error Invalid option.
    client.delete<MyRow>("table", { pk1: "" }, { timeou: 10000 });
}

async function testDeleteUntyped() {
    const del = (client.delete)<AnyRow>;

    expectTypeOf(del).toBeFunction();
    expectTypeOf(del).parameters.toEqualTypeOf<[string, any, DeleteOpt?]>();
    expectTypeOf(del).parameter(0).toBeString();
    expectTypeOf(del).parameter(1).toEqualTypeOf<AnyKey>();
    expectTypeOf(del).parameter(2).toEqualTypeOf<DeleteOpt|undefined>();
    expectTypeOf(del).returns.not.toEqualTypeOf<DeleteResult>();
    expectTypeOf(del).returns.resolves.toEqualTypeOf<DeleteResult>();
    expectTypeOf(del).toBeCallableWith("table",
        { pk1: "a", pk3: new Decimal(1) });
    expectTypeOf(del).toBeCallableWith("table",
        { pk1: "val1", pk3: new Decimal(123.456) },
        { timeout: 1, durability: Durabilities.COMMIT_NO_SYNC });

    let res = await client.delete("table", { pk1: "a", pk3: new Decimal(1) });
    expectTypeOf(res).toEqualTypeOf<DeleteResult>();

    res = await client.delete("table", { pk1: "", pk3: new Decimal(123.456) },
        { compartment: "compartment", timeout: 5000 });

    let res2: DeleteResult<MyRow> = await client.delete("table",
        { "pk1": "a" });
    
    // @ts-expect-error Missing table name.
    client.delete();
    // @ts-expect-error Missing key.
    client.delete("table");
    // @ts-expect-error Invalid table name.
    client.delete(1, { pk2: 1 });
    // @ts-expect-error Invalid option.
    client.delete("table", { pk2: 1 }, { timeou: 10000 });
    
    // @ts-expect-error Invalid type for key when TRow is inferred as MyRow
    res2 = await client.delete("table", { "pk5": "a" });
}

async function testDeleteIfVersionTyped(ver: RowVersion) {
    const delIfVersion = (client.deleteIfVersion)<MyRow>;
    let res: DeleteResult<MyRow>;

    expectTypeOf(delIfVersion).toBeFunction();
    expectTypeOf<Length<Parameters<typeof delIfVersion>>>()
        .toEqualTypeOf<3|4>();
    expectTypeOf(delIfVersion).parameter(0).toBeString();
    expectTypeOf(delIfVersion).parameter(1).toMatchTypeOf<DerivedKey>();
    expectTypeOf(delIfVersion).parameter(2).toMatchTypeOf<RowVersion>();
    expectTypeOf(delIfVersion).parameter(3)
        .toEqualTypeOf<DeleteIfOpt|undefined>();
    expectTypeOf(delIfVersion).returns.not
        .toEqualTypeOf<DeleteResult<MyRow>>();
    expectTypeOf(delIfVersion).returns.resolves
        .toEqualTypeOf<DeleteResult<MyRow>>();
    expectTypeOf(delIfVersion).toBeCallableWith("table",
        { pk1: "a", pk3: new Decimal(1) }, ver);
    expectTypeOf(delIfVersion).toBeCallableWith("table",
        { pk1: "val1", col2: new Date() }, ver,
        { timeout: 1, durability: Durabilities.COMMIT_NO_SYNC });

    res = await client.deleteIfVersion<MyRow>("table",
        { pk2: 10, pk3: new Decimal(1), col6: false }, ver);
    res = await client.deleteIfVersion<MyRow>("table",
        { pk1: "", pk2: 1, col2: new Date() }, ver,
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing table name.
    client.deleteIfVersion<MyRow>();
    // @ts-expect-error Missing key.
    client.deleteIfVersion<MyRow>("table", ver);
    // @ts-expect-error Missing row version.
    client.deleteIfVersion<MyRow>("table", { pk1: ""});
    // @ts-expect-error Invalid table name.
    client.deleteIfVersion<MyRow>(1, { pk1: "a" }, ver);
    // @ts-expect-error Invalid type for key
    client.deleteIfVersion<MyRow>("table", 1, ver);
    // @ts-expect-error Invalid type for key
    client.deleteIfVersion<MyRow>("table", "a", ver);
    // @ts-expect-error Invalid type for key
    client.deleteIfVersion<MyRow>("table", new Date(), ver);
    // @ts-expect-error Invalid type for key, missing fields pk1 and pk3
    client.deleteIfVersion<MyRow>("table", { x: 1 }, ver);
    // @ts-expect-error Invalid type for key, invalid field pk5
    client.deleteIfVersion<MyRow>("table", { pk1: "a", pk5: 1 }, ver);
    // @ts-expect-error Invalid type for key, invalid type for pk3
    client.deleteIfVersion<MyRow>("table", { pk1: "a", pk3: 10 }, ver);
    // @ts-expect-error Invalid type for key, invalid type for pk1
    client.deleteIfVersion<MyRow>("table", { pk1: 1, pk3: new Decimal(1) },
        ver);
    // @ts-expect-error Invalid type for key, invalid type for col6
    client.deleteIfVersion<MyRow>("table", { col6: 1 }, ver);
    client.deleteIfVersion<MyRow>("table", { pk2: 1 }, ver,
        // @ts-expect-error Invalid option.
        { timeou: 10000 });
}

async function testDeleteIfVersionUntyped(ver: RowVersion) {
    const delIfVersion = (client.deleteIfVersion)<AnyRow>;
    let res: DeleteResult;

    expectTypeOf(delIfVersion).toBeFunction();
    expectTypeOf<Length<Parameters<typeof delIfVersion>>>()
        .toEqualTypeOf<3|4>();
    expectTypeOf(delIfVersion).parameter(0).toBeString();
    expectTypeOf(delIfVersion).parameter(1).toMatchTypeOf<DerivedKey>();
    expectTypeOf(delIfVersion).parameter(2).toMatchTypeOf<RowVersion>();
    expectTypeOf(delIfVersion).parameter(3)
        .toEqualTypeOf<DeleteIfOpt|undefined>();
    expectTypeOf(delIfVersion).returns.not.toEqualTypeOf<DeleteResult>();
    expectTypeOf(delIfVersion).returns.resolves.toEqualTypeOf<DeleteResult>();
    expectTypeOf(delIfVersion).toBeCallableWith("table", { x: 1 }, ver);
    expectTypeOf(delIfVersion).toBeCallableWith("table", { x: "a" }, ver,
        { timeout: 1, durability: Durabilities.COMMIT_NO_SYNC });

    res = await client.deleteIfVersion<MyRow>("table",
        { pk2: 10, pk3: new Decimal(1), col6: false }, ver);
    res = await client.deleteIfVersion<MyRow>("table",
        { pk1: "", pk2: 1, col2: new Date() }, ver,
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing table name.
    client.deleteIfVersion();
    // @ts-expect-error Missing key.
    client.deleteIfVersion("table", ver);
    // @ts-expect-error Missing row version.
    client.deleteIfVersion("table", { pk1: ""});
    // @ts-expect-error Invalid table name.
    client.deleteIfVersion(1, { pk1: "a" }, ver);
    // @ts-expect-error Invalid type for key
    client.deleteIfVersion("table", 1, ver);
    // @ts-expect-error Invalid type for key
    client.deleteIfVersion("table", "a", ver);
    // @ts-expect-error Invalid option.
    client.deleteIfVersion("table", { pk2: 1 }, ver, { timeou: 10000 });

    let res2: DeleteResult<MyRow> = await client.deleteIfVersion("table",
        { "pk1": "a" }, ver);

    // @ts-expect-error Invalid type for key when TRow is inferred as MyRow
    res2 = await client.deleteIfVersion("table", { "pk5": "a" }, ver);
}
