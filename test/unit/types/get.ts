/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, GetOpt, Consistency, RowKey, RowVersion, GetResult,
    ConsumedCapacity, FieldValue, AnyRow, AnyKey } from "../../../";
import { Decimal } from "decimal.js";
import { Length } from "./utils";

declare module "../../../" {
    interface CustomFieldTypes {
        dbNumber: Decimal;
    }
}

const client = new NoSQLClient("nosuchfile.json");

function testFieldValue() {
    let val: FieldValue;

    val = "abcde";
    val = 10.1;
    val = 100n;
    val = new Decimal(1);
    val = true;
    val = Buffer.alloc(16);
    val = new Date();
    val = null;
    val = undefined;
    val = [];
    val = [ 1, 2, 3 ];
    val = [ 1, { a: 1 }, false ];
    val = [ undefined, [[], []] ];
    val = { a: 1, b: null };
    val = { a: [ 1, 2, 3 ], b: { x: [ { y: undefined, z: {} } ] } };

    // @ts-expect-error Cannot use symbol as field value.
    val = Symbol("symbol");
    // @ts-expect-error Invalid field value type.
    val = {} as GetOpt;
    // @ts-expect-error Invalid field value type.
    val = {} as GetResult;
    // @ts-expect-error Invalid field value type.
    val = {} as ConsumedCapacity;
    // @ts-expect-error Invalid field value type.
    val = client;
    class Foo {}
    // @ts-expect-error Invalid field value type.
    val = new Foo();
    // @ts-expect-error Invalid field value type.
    val = Buffer.alloc(16) as RowVersion;
}

function testGetOpt(ver: RowVersion) {
    let opt: GetOpt = {};

    opt.compartment = "c";
    opt.timeout = 10000;
    opt.consistency = Consistency.ABSOLUTE;

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid type for consistency.
    opt.consistency = 0;
    // @ts-expect-error Invalid type for consistency.
    opt.consistency = "ABSOLUTE";
    // @ts-expect-error Invalid extra property.
    opt.matchVersion = ver;
}

declare let ver1: RowVersion;
declare let ver2: RowVersion;

function testConsumedCapacity(cc: ConsumedCapacity) {
    expectTypeOf(cc.readKB).toBeNumber();
    expectTypeOf(cc.writeKB).toBeNumber();
    expectTypeOf(cc.readUnits).toBeNumber();
    expectTypeOf(cc.writeUnits).toBeNumber();
    expectTypeOf(cc.readRateLimitDelay).toEqualTypeOf<number|undefined>();
    expectTypeOf(cc.writeRateLimitDelay).toEqualTypeOf<number|undefined>();
    // all properties of ConsumedCapacity must be read-only
    expectTypeOf<Readonly<ConsumedCapacity>>()
        .toEqualTypeOf<ConsumedCapacity>();

    // @ts-expect-error Invalid property in ConsumedCapacity.
    cc.version;
}

export interface MyRow {
    pk1: string;
    pk2: number;
    pk3: Decimal;
    col1?: Buffer;
    col2?: Date;
    col3?: number[];
    col4?: { [key: string]: MyRow };
    col5?: Map<string,Date[]>;
    col6: boolean;
}

export interface MyKey {
    pk1: string;
    pk3: Decimal;
}

export interface DerivedKey {
    pk1?: string;
    pk2?: number;
    pk3?: Decimal;
    col2?: Date;
    col6?: boolean;
}

function testTypedGetResult(res: GetResult<MyRow>) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.row).toEqualTypeOf<MyRow|null>();
    expectTypeOf(res.expirationTime).toEqualTypeOf<Date|undefined>();
    expectTypeOf(res.modificationTime).toEqualTypeOf<Date|undefined>();
    expectTypeOf(res.version).toEqualTypeOf<RowVersion|undefined>();

    // all properties of GetResult must be read-only
    expectTypeOf<Readonly<GetResult<MyRow>>>()
        .toEqualTypeOf<GetResult<MyRow>>();

    // @ts-expect-error Invalid property in GetResult.
    res.success;

    ver2 = ver1;
    // @ts-expect-error RowVersion is an opaque type.
    ver1 = Buffer.alloc(10);
}

function testUntypedGetResult(res: GetResult) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.row).toEqualTypeOf<AnyRow|null>();
    expectTypeOf(res.expirationTime).toEqualTypeOf<Date|undefined>();
    expectTypeOf(res.modificationTime).toEqualTypeOf<Date|undefined>();
    expectTypeOf(res.version).toEqualTypeOf<RowVersion|undefined>();

    // all properties of GetResult must be read-only
    expectTypeOf<Readonly<GetResult<MyRow>>>()
        .toEqualTypeOf<GetResult<MyRow>>();

    // @ts-expect-error Invalid property in GetResult.
    res.success;
}

async function testGetTyped() {
    const get = (client.get)<MyRow>;
    let res: GetResult<MyRow>;

    expectTypeOf(get).toBeFunction();
    // expectTypeOf(get).parameters.toEqualTypeOf somehow does not work here
    expectTypeOf<Length<Parameters<typeof get>>>().toEqualTypeOf<2|3>();
    expectTypeOf(get).parameter(0).toBeString();
    expectTypeOf(get).parameter(1).toMatchTypeOf<DerivedKey>();
    expectTypeOf(get).parameter(2).toEqualTypeOf<GetOpt|undefined>();
    expectTypeOf(get).returns.not.toEqualTypeOf<GetResult<MyRow>>();
    expectTypeOf(get).returns.resolves.toEqualTypeOf<GetResult<MyRow>>();
    expectTypeOf(get).toBeCallableWith("table",
        { pk1: "a", pk3: new Decimal(1) });
    expectTypeOf(get).toBeCallableWith("table",
        { pk1: "val1", col2: new Date() },
        { timeout: 1, consistency: Consistency.EVENTUAL });

    res = await client.get<MyRow>("table",
        { pk2: 10, pk3: new Decimal(1), col6: false });
    res = await client.get<MyRow>("table",
        { pk1: "", pk2: 1, col2: new Date() },
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing key.
    client.get<MyRow>("table");
    // @ts-expect-error Invalid table name.
    client.get<MyRow>(1, { "pk1": "" });
    // @ts-expect-error Invalid type for key
    client.get<MyRow>("table", 1);
    // @ts-expect-error Invalid type for key
    client.get<MyRow>("table", "a");
    // @ts-expect-error Invalid type for key
    client.get<MyRow>("table", new Date());
    // @ts-expect-error Invalid type for key, missing fields pk1 and pk3
    client.get<MyRow>("table", { x: 1 });
    // @ts-expect-error Invalid type for key, invalid field pk5
    client.get<MyRow>("table", { pk1: "a", pk5: 1 });
    // @ts-expect-error Invalid type for key, invalid type for pk3
    client.get<MyRow>("table", { pk1: "a", pk3: 10 });
    // @ts-expect-error Invalid type for key, invalid type for pk1
    client.get<MyRow>("table", { pk1: 1, pk3: new Decimal(1) });
    // @ts-expect-error Invalid type for key, invalid type for col6
    client.get<MyRow>("table", { col6: 1 });
    // @ts-expect-error Invalid option.
    client.get<MyRow>("table", { pk2 : 1 }, { timeou: 10000 });
}

type AnyRowKey = RowKey<AnyRow>;
expectTypeOf<AnyRowKey>().toEqualTypeOf<AnyKey>();

async function testGetUntyped() {
    const get = (client.get)<AnyRow>;

    expectTypeOf(get).toBeFunction();
    expectTypeOf(get).parameters.toEqualTypeOf<[string, any, GetOpt?]>();
    expectTypeOf(get).parameter(0).toBeString();
    expectTypeOf(get).parameter(1).toEqualTypeOf<AnyKey>();
    expectTypeOf(get).parameter(2).toEqualTypeOf<GetOpt|undefined>();
    expectTypeOf(get).returns.not.toEqualTypeOf<GetResult>();
    expectTypeOf(get).returns.resolves.toEqualTypeOf<GetResult>();
    expectTypeOf(get).toBeCallableWith("table",
        { pk1: "a", pk3: new Decimal(1) });
    expectTypeOf(get).toBeCallableWith("table",
        { pk1: "val1", pk3: new Decimal(123.456) },
        { timeout: 1, consistency: Consistency.EVENTUAL });

    let res = await client.get("table", { pk1: "a", pk3: new Decimal(1) });
    expectTypeOf(res).toEqualTypeOf<GetResult>();

    res = await client.get("table", { pk1: "", pk3: new Decimal(123.456) },
        { compartment: "compartment", timeout: 5000 });

    let res2: GetResult<MyRow> = await client.get("table", { "pk1": "a" });
    
    // @ts-expect-error Missing key.
    client.get("table");
    // @ts-expect-error Invalid table name.
    client.get(1, { pk1: "a" });
    // @ts-expect-error Invalid option.
    client.get("table", { pk2: 1 }, { timeou: 10000 });
    
    // @ts-expect-error Invalid type for key when TRow is inferred as MyRow
    res2 = await client.get("table", { "pk5": "a" });
}
