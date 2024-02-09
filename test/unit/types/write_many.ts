/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";
import { Overloads, OverloadedParameters, OverloadedReturnType, Length }
    from "./utils";

import { NoSQLClient, Durability, PutOpt, DeleteOpt, RowKey, AnyKey,
    RowVersion, PutResult, ConsumedCapacity, FieldValue, Durabilities,
    TTLUtil, SyncPolicy, ReplicaAckPolicy, DeleteResult,
    WriteOperation, WriteMultipleOpt, WriteMultipleResult,
    PutOpResult, DeleteOpResult, PutManyOpt, DeleteManyOpt, AnyRow }
    from "../../../";

import Decimal from "decimal.js";

const client = new NoSQLClient("nosuchfile.json");

function testWriteMultipleOpt(ver: RowVersion) {
    let opt: WriteMultipleOpt = {};
    opt.compartment = "c";
    opt.namespace = "n";
    opt.timeout = 10000;
    opt.durability = Durabilities.COMMIT_NO_SYNC;
    opt.ttl = 1;
    opt.ttl = TTLUtil.ofDays(1);
    opt.ttl = TTLUtil.ofHours(10);
    opt.ttl = { days: 1 };
    opt.returnExisting = true;
    opt.updateTTLToDefault = false;
    opt.exactMatch = true;
    opt.identityCacheSize = 100;
    opt.ifAbsent = true;
    opt.ifPresent = true;
    opt.matchVersion = ver;
    opt.abortOnFail = true;

    // @ts-expect-error Invalid type for compartment.
    opt.compartment = 1;
    // @ts-expect-error Invalid type for namespace.
    opt.namespace = 1;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid type for durability.
    opt.durability = "COMMIT_SYNC";
    // @ts-expect-error Invalid type for ttl.
    opt.ttl = "2 DAYS";

    // TODO: enable when have exclusive properties
    // ts-expect-error Empty object for ttl.
    opt.ttl = {};
    // ts-expect-error Cannot specify both days and hours in ttl.
    opt.ttl = { days: 2, hours: 3 };
    // @ts-expect-error Invalid property for ttl.
    
    opt.ttl = { day: 5 };
    // @ts-expect-error Invalid extra property for ttl.
    opt.ttl = { hours: 1, hour: 2 };
    // @ts-expect-error Invalid type for returnExisting.
    opt.returnExisting = 1;
    // @ts-expect-error Invalid type for updateTTLToDefault.
    opt.updateTTLToDefault = 0;
    // @ts-expect-error Invalid type for exactMatch.
    opt.exactMatch = "true";
    // @ts-expect-error Invalid type for identityCacheSize.
    opt.identityCacheSize = "100";

    // @ts-expect-error Invalid extra property.
    opt.consistency = ver;

    // @ts-expect-error Invalid type for ifAbsent.
    opt.ifAbsent = 1;
    // @ts-expect-error Invalid type for ifPresent.
    opt.ifPresent = 0;
    // @ts-expect-error Invalid type for matchVersion.
    opt.matchVersion = {};
    // @ts-expect-error Invalid type for matchVersion.
    opt.matchVersion = Buffer.alloc(10);
}

function testPutManyOpt() {
    // Assignability test will disregard optional properties so we have to
    // test types with required properties.
    expectTypeOf<Required<PutManyOpt>>()
        .toMatchTypeOf<Required<PutOpt>>();
    expectTypeOf<Required<PutOpt>>()
        .not.toMatchTypeOf<Required<PutManyOpt>>();

    let opt: PutManyOpt = {};
    opt.abortOnFail = true;

    // @ts-expect-error Invalid option.
    opt.abort = true;
}

function testDeleteManyOpt() {
    // Assignability test will disregard optional properties so we have to
    // test types with required properties.
    expectTypeOf<Required<DeleteManyOpt>>()
        .toMatchTypeOf<Required<DeleteOpt>>();
    expectTypeOf<Required<DeleteOpt>>()
        .not.toMatchTypeOf<Required<DeleteManyOpt>>();

    let opt: PutManyOpt = {};
    opt.abortOnFail = true;

    // @ts-expect-error Invalid option.
    opt.abort = true;
}

import { MyRow, MyKey, DerivedKey } from "./get";

const myRow1 = { pk1: "a", pk2: 1, pk3: new Decimal(1), col1: Buffer.alloc(1),
    col2: new Date(), col3: [1, 2], col4: {}, col5: new Map<string,Date[]>,
    col6: true };

const myRow2 = { pk1: "a", pk2: 1, pk3: new Decimal(1), col6: true };

const myKey1 = { pk1: "a", pk2: 1 };
const myKey2 = { pk2: -10, col6: true };

// To simulate calling writeMany with multiple tables
interface MyRow2 {
    x: number;
    col1?: boolean;
    col2?: string;
}

function testWriteOperationTyped(ver: RowVersion) {
    let op: WriteOperation<MyRow>;
    
    op = { put: myRow1 };
    op = { delete: myKey1 };
    op = {
        put: myRow2,
        ttl: TTLUtil.ofDays(5),
        returnExisting: true,
        matchVersion: ver
    };
    op = {
        delete: { pk2: 1 },
        returnExisting: true,
        matchVersion: ver
    };
    op = {
        put: myRow1,
        abortOnFail: true,
        returnExisting: true,
        ifAbsent: true,
        updateTTLToDefault: true,
        exactMatch: true,
        identityCacheSize: 1000
    };

    // TODO: enable when have exclusive properties
    // ts-expect-error Invalid empty object.
    op = {};
    // ts-expect-error Cannot have put and delete in the same op.
    op = { put: myRow1, delete: myKey1 };

    // @ts-expect-error Invalid row.
    op = { put: 1 };
    // @ts-expect-error Invalid key.
    op = { delete: Buffer.alloc(10) };
    // @ts-expect-error Invalid abortOnFail option.
    op = { put: myRow1, abortOnFail: 1 }
    // @ts-expect-error Invalid abortOnFail option.
    op = { delete: myKey1, abortOnFail: 1 }
    // @ts-expect-error Invalid returnExisting option.
    op = { put: myRow2, returnExisting: 1 }
    // @ts-expect-error Invalid returnExisting option.
    op = { delete: myKey1, returnExisting: 1 }
    // @ts-expect-error Invalid matchVersion option.
    op = { put: myRow2, matchVersion: Buffer.alloc(100) }
    // @ts-expect-error Invalid matchVersion option.
    op = { delete: myKey1, matchVersion: Buffer.alloc(100) }
    // @ts-expect-error Invalid ifAbsent option.
    op = { put: myRow1, ifAbsent: 1 }
    // @ts-expect-error Invalid ifPresent option.
    op = { put: myRow1, ifPresent: "true" }
    // @ts-expect-error Invalid ttl option.
    op = { put: myRow1, ttl: { days: "1" } }
    // @ts-expect-error Invalid updateTTLToDefault option.
    op = { put: myRow1, updateTTLToDefault: 0 };
    // @ts-expect-error Invalid exactMatch option.
    op = { put: myRow1, exactMatch: 0 };
    // @ts-expect-error Invalid identityCacheSize option.
    op = { put: myRow1, identityCacheSize: false };
    // @ts-expect-error Invalid extra option.
    op = { put: myRow1, version: ver };
    // @ts-expect-error Invalid extra option.
    op = { put: myRow1, abort: true };

    // @ts-expect-error Cannot specify compartment in WriteOperation.
    op = { put: myRow1, compartment: "c" };
    // @ts-expect-error Cannot specify namespace in WriteOperation.
    op = { put: myRow1, namespace: "n" };
    // @ts-expect-error Cannot specify timeout in WriteOperation.
    op = { put: myRow1, timeout: 10000 };
    // @ts-expect-error Cannot specify durability in WriteOperation.
    op = { put: myRow1, durability: Durabilities.COMMIT_NO_SYNC };
    // @ts-expect-error Cannot specify compartment in WriteOperation.
    op = { delete: myKey1, compartment: "c" };
    // @ts-expect-error Cannot specify timeout in WriteOperation.
    op = { delete: myKey1, timeout: 10000 };
    // @ts-expect-error Cannot specify durability in WriteOperation.
    op = { delete: myKey1, durability: Durabilities.COMMIT_NO_SYNC };

    // TODO: enable when have exclusive properties
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, ifAbsent: true };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, ifPresent: true };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, ttl: TTLUtil.ofHours(10) };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, updateTTLToDefault: true };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, exactMatch: true };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, identityCacheSize: 100 };

    // TODO: enable when have exclusive properties
    // ts-expect-error Mutually exclusive options for put operation.
    op = { put: myRow1, ifAbsent: true, ifPresent: true };
    // ts-expect-error Mutually exclusive options for put operation.
    op = { put: myRow1, ifAbsent: true, matchVersion: ver };
    // ts-expect-error Mutually exclusive options for put operation.
    op = { put: myRow1, ifPresent: true, matchVersion: ver };

    // @ts-expect-error Invalid row, missing required field col6
    op = { put: { pk1: "a", pk2: 1, pk3: new Decimal(1) } };
    // @ts-expect-error Invalid row, wrong type for pk3
    op = { put: { pk1: "a", pk2: 1, pk3: 1.1, col6: false } };
    op = { put: { pk1: "a", pk2: 1, pk3: new Decimal(1), col6: true,
        // @ts-expect-error Invalid row, invalid extra property
        col7: 1 } }

    // @ts-expect-error Invalid type for key, invalid field pk5
    op = { delete: { pk1: "a", pk5: 1 } };
    // @ts-expect-error Invalid type for key, invalid type for pk3
    op = { delete: { pk1: "a", pk3: 10 } };
    // @ts-expect-error Invalid type for key, invalid type for col6
    op = { delete: { col6: 1 } };
}

function testWriteOperationUntyped(ver: RowVersion) {
    let op: WriteOperation;
    
    op = { put: myRow1 };
    op = { delete: myKey1 };
    op = {
        put: myRow2,
        ttl: TTLUtil.ofDays(5),
        returnExisting: true,
        matchVersion: ver
    };
    op = {
        delete: { pk2: 1 },
        returnExisting: true,
        matchVersion: ver
    };
    op = {
        put: myRow1,
        abortOnFail: true,
        returnExisting: true,
        ifAbsent: true,
        updateTTLToDefault: true,
        exactMatch: true,
        identityCacheSize: 1000
    };

    // TODO: enable when have exclusive properties
    // ts-expect-error Invalid empty object.
    op = {};
    // ts-expect-error Cannot have put and delete in the same op.
    op = { put: myRow1, delete: myKey1 };

    // @ts-expect-error Invalid row.
    op = { put: 1 };
    // @ts-expect-error Invalid key.
    op = { delete: true };
    // @ts-expect-error Invalid abortOnFail option.
    op = { put: myRow1, abortOnFail: 1 }
    // @ts-expect-error Invalid abortOnFail option.
    op = { delete: myKey1, abortOnFail: 1 }
    // @ts-expect-error Invalid returnExisting option.
    op = { put: myRow2, returnExisting: 1 }
    // @ts-expect-error Invalid returnExisting option.
    op = { delete: myKey1, returnExisting: 1 }
    // @ts-expect-error Invalid matchVersion option.
    op = { put: myRow2, matchVersion: Buffer.alloc(100) }
    // @ts-expect-error Invalid matchVersion option.
    op = { delete: myKey1, matchVersion: Buffer.alloc(100) }
    // @ts-expect-error Invalid ifAbsent option.
    op = { put: myRow1, ifAbsent: 1 }
    // @ts-expect-error Invalid ifPresent option.
    op = { put: myRow1, ifPresent: "true" }
    // @ts-expect-error Invalid ttl option.
    op = { put: myRow1, ttl: { days: "1" } }
    // @ts-expect-error Invalid updateTTLToDefault option.
    op = { put: myRow1, updateTTLToDefault: 0 };
    // @ts-expect-error Invalid exactMatch option.
    op = { put: myRow1, exactMatch: 0 };
    // @ts-expect-error Invalid identityCacheSize option.
    op = { put: myRow1, identityCacheSize: false };
    // @ts-expect-error Invalid extra option.
    op = { put: myRow1, version: ver };
    // @ts-expect-error Invalid extra option.
    op = { put: myRow1, abort: true };

    // @ts-expect-error Cannot specify compartment in WriteOperation.
    op = { put: myRow1, compartment: "c" };
    // @ts-expect-error Cannot specify namespace in WriteOperation.
    op = { put: myRow1, namespace: "n" };
    // @ts-expect-error Cannot specify timeout in WriteOperation.
    op = { put: myRow1, timeout: 10000 };
    // @ts-expect-error Cannot specify durability in WriteOperation.
    op = { put: myRow1, durability: Durabilities.COMMIT_NO_SYNC };
    // @ts-expect-error Cannot specify compartment in WriteOperation.
    op = { delete: myKey1, compartment: "c" };
    // @ts-expect-error Cannot specify timeout in WriteOperation.
    op = { delete: myKey1, timeout: 10000 };
    // @ts-expect-error Cannot specify durability in WriteOperation.
    op = { delete: myKey1, durability: Durabilities.COMMIT_NO_SYNC };

    // TODO: enable when have exclusive properties
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, ifAbsent: true };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, ifPresent: true };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, ttl: TTLUtil.ofHours(10) };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, updateTTLToDefault: true };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, exactMatch: true };
    // ts-expect-error Option only valid for put operation.
    op = { delete: myKey1, identityCacheSize: 100 };

    // TODO: enable when have exclusive properties
    // ts-expect-error Mutually exclusive options for put operation.
    op = { put: myRow1, ifAbsent: true, ifPresent: true };
    // ts-expect-error Mutually exclusive options for put operation.
    op = { put: myRow1, ifAbsent: true, matchVersion: ver };
    // ts-expect-error Mutually exclusive options for put operation.
    op = { put: myRow1, ifPresent: true, matchVersion: ver };
}

function testTypedWriteMultipleResult(res: WriteMultipleResult<MyRow>) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.results)
        .toEqualTypeOf<(PutOpResult<MyRow>|DeleteOpResult<MyRow>)[]
        |undefined>();
    expectTypeOf(res.failedOpIndex).toEqualTypeOf<number|undefined>();
    expectTypeOf(res.failedOpResult)
        .toEqualTypeOf<PutOpResult<MyRow>|DeleteOpResult<MyRow>|undefined>();
    
    // all properties of WriteMultipleResult must be read-only
    expectTypeOf<Readonly<WriteMultipleResult<MyRow>>>()
        .toEqualTypeOf<WriteMultipleResult<MyRow>>();

    // @ts-expect-error Invalid property in WriteMultipleResult.
    res.version;
}

function testUntypedWriteMultipleResult(res: WriteMultipleResult) {
    expectTypeOf(res.consumedCapacity)
        .toEqualTypeOf<ConsumedCapacity|undefined>();
    expectTypeOf(res.results)
        .toEqualTypeOf<(PutOpResult|DeleteOpResult)[]|undefined>();
    expectTypeOf(res.failedOpIndex).toEqualTypeOf<number|undefined>();
    expectTypeOf(res.failedOpResult)
        .toEqualTypeOf<PutOpResult|DeleteOpResult|undefined>();
    
    // all properties of WriteMultipleResult must be read-only
    expectTypeOf<Readonly<WriteMultipleResult>>()
        .toEqualTypeOf<WriteMultipleResult>();

    // @ts-expect-error Invalid property in WriteMultipleResult.
    res.version;
}

async function testWriteManyTyped(ver: RowVersion) {
    let res: WriteMultipleResult<MyRow>;
    // expectTypeOf(function) does not currently support overloads, so we
    // use Overloads defined in utils.
    type WMOverloads = Overloads<typeof client.writeMany<MyRow>>;
    expectTypeOf<Length<WMOverloads>>().toEqualTypeOf<2>();
    expectTypeOf(client.writeMany).toBeFunction();

    expectTypeOf<WMOverloads[0]>().toBeFunction();
    expectTypeOf<WMOverloads[0]>().parameters
        .toMatchTypeOf<[string, WriteOperation<MyRow>[],
        WriteMultipleOpt?]>();
    expectTypeOf<WMOverloads[0]>().parameter(0).toBeString();
    expectTypeOf<WMOverloads[0]>().parameter(1)
        .toEqualTypeOf<WriteOperation<MyRow>[]>();
    expectTypeOf<WMOverloads[0]>().parameter(2)
        .toEqualTypeOf<WriteMultipleOpt|undefined>();
    expectTypeOf<WMOverloads[0]>().returns.not
        .toEqualTypeOf<WriteMultipleResult<MyRow>>();
    expectTypeOf<WMOverloads[0]>().returns.resolves
        .toEqualTypeOf<WriteMultipleResult<MyRow>>();

    expectTypeOf<WMOverloads[1]>().toBeFunction();
    expectTypeOf<WMOverloads[1]>().parameters
        .toEqualTypeOf<[WriteOperation<MyRow>[], WriteMultipleOpt?]>();
    expectTypeOf<WMOverloads[1]>().parameter(0)
        .toEqualTypeOf<WriteOperation<MyRow>[]>();
    expectTypeOf<WMOverloads[1]>().parameter(1)
        .toEqualTypeOf<WriteMultipleOpt|undefined>();
    expectTypeOf<WMOverloads[1]>().returns.not
        .toEqualTypeOf<WriteMultipleResult<MyRow>>();
    expectTypeOf<WMOverloads[1]>().returns.resolves
        .toEqualTypeOf<WriteMultipleResult<MyRow>>();

    res = await client.writeMany<MyRow>("table", [ { put: myRow1 } ]);
    res = await client.writeMany<MyRow>("table", [ { delete: myKey1 } ]);
    res = await client.writeMany<MyRow>("table", [
        { put: myRow1, ifAbsent: true },
        { delete: myKey1, matchVersion: ver } ],
        { compartment: "compartment", timeout: 5000, abortOnFail: true,
        ttl: TTLUtil.ofDays(1) });
    res = await client.writeMany<MyRow>("table", [ { put: myRow2 },
        { delete: myKey1 } ],
        { timeout: 5000, abortOnFail: true, returnExisting: true,
            ifAbsent: true });

    res = await client.writeMany<MyRow>(
        [ { tableName: "table", put: myRow2 } ]);
    res = await client.writeMany<MyRow>(
        [ { tableName: "table", delete: myKey1 } ]);
    res = await client.writeMany<MyRow>([ { tableName: "t", put: myRow1 },
        { tableName: "t2", delete: myKey1 } ],
        { compartment: "compartment", timeout: 5000, abortOnFail: true,
        ttl: TTLUtil.ofDays(1) });
    res = await client.writeMany<MyRow>(
        [ { tableName: "t", put: myRow1, ttl: { hours: 10 } },
        { tableName: "t", delete: myKey1 } ],
        { timeout: 5000, abortOnFail: true, returnExisting: true,
            ifAbsent: true });

    // @ts-expect-error Missing table name and operations array.
    client.writeMany<MyRow>();
    // @ts-expect-error Missing operations array.
    client.writeMany<MyRow>("table");
    // @ts-expect-error Invalid table name.
    client.writeMany<MyRow>(1, [ { put: myRow1 } ]);
    // @ts-expect-error Invalid put operation option.
    client.writeMany<MyRow>("table", [ { put: myRow1, ttl: "1" } ]);
    // @ts-expect-error Invalid put operation option.
    client.writeMany<MyRow>("table", [ { put: myRow1, abortOnFail: 1 } ]);

    // TODO: enable when have exclusive properties
    client.writeMany<MyRow>(
        // ts-expect-error Wrong option for delete operation.
        [ { tableName: "t", delete: myKey1, updateTTLToDefault: true } ]);
    // ts-expect-error Wrong option for delete operation.
    client.writeMany<MyRow>([ { delete: myKey1, ifAbsent: true } ]);

    // @ts-expect-error Invalid put operation.
    client.writeMany<MyRow>("table", [ { put: "a" } ]);
    // @ts-expect-error Invalid put operation.
    client.writeMany<MyRow>([ { tableName: "t", put: "a" } ]);
    // @ts-expect-error Invalid delete operation.
    client.writeMany<MyRow>("table", [ { delete: true } ]);
    // @ts-expect-error Invalid delete operation.
    client.writeMany<MyRow>([ { tableName: "t", delete: false } ]);

    // @ts-expect-error Invalid row for put operation, unknown field
    client.writeMany<MyRow>("table", [ { put: { x: 1 } } ]);
    // @ts-expect-error Invalid row for put operation, unknown field
    client.writeMany<MyRow>([ { tableName: "t", put: { x: 1 } } ]);
    // @ts-expect-error Invalid row for put operation, missing required col6
    client.writeMany<MyRow>("table", [ { put: { pk1: "a", pk2: 1,
        pk3: new Decimal(1) } } ]);
    // @ts-expect-error Invalid row for put operation, missing required col6
    client.writeMany<MyRow>([ { tableName: "t", put: { pk1: "a", pk2: 1,
        pk3: new Decimal(1) } } ]);
    // @ts-expect-error Invalid row for put operation, wrong type for pk3
    client.writeMany<MyRow>("table", [ { put: { pk1: "a", pk2: 1,
        pk3: 1, col6: true } } ]);
    client.writeMany<MyRow>(
        // @ts-expect-error Invalid row for put operation, wrong type for pk3
        [ { tableName: "t", put: { pk1: "a", pk2: 1, pk3: 1,
        col6: true } } ]);
    // @ts-expect-error Invalid row for put operation, invalid extra col7
    client.writeMany<MyRow>("table", [ { put: { pk1: "a", pk2: 1,
        pk3: new Decimal(1), col6: true, col7: 1 } } ]);
    client.writeMany<MyRow>([ { tableName: "t", put: { pk1: "a", pk2: 1,
        // @ts-expect-error Invalid row for put operation, invalid extra col7
        pk3: new Decimal(1), col6: true, col7: 1 } } ]);

    // @ts-expect-error Invalid key for delete operation, missing pk1 and pk3
    client.writeMany<MyRow>("table", [ { delete: { x: 1 } } ]);
    // @ts-expect-error Invalid key for delete operation, missing pk1 and pk3
    client.writeMany<MyRow>([ { tableName: "t", delete: { x: 1 } } ]);
    // @ts-expect-error Invalid key for delete operation, invalid field pk5
    client.writeMany<MyRow>("table", [ { delete: { pk1: "a", pk5: 1 } } ]);
    client.writeMany<MyRow>(
    // @ts-expect-error Invalid key for delete operation, invalid field pk5
        [ { tableName: "t", delete: { pk1: "a", pk5: 1 } } ]);
    // @ts-expect-error Invalid key for delete operation, invalid type for pk3
    client.writeMany<MyRow>("table", [ { delete: { pk1: "a", pk3: 1 } } ]);
    client.writeMany<MyRow>(
    // @ts-expect-error Invalid key for delete operation, invalid type for pk3
        [ { tableName: "t", delete: { pk1: "a", pk3: 1 } } ]);

    // writeMany with multiple tables
    let res2 = await client.writeMany<MyRow|MyRow2>([
        { tableName: "t", put: myRow1 },
        { tableName: "t2", put: { x: 1 } },
        { tableName: "t", delete: myKey1 },
        { tableName: "t2", delete: { col1: true } }
    ]);
    expectTypeOf(res2).toEqualTypeOf<WriteMultipleResult<MyRow|MyRow2>>();

    let res3 = await client.writeMany<MyRow|MyRow2>([
        { tableName: "t", put: myRow1 },
        // @ts-expect-error Invalid type for col1 for this row
        { tableName: "t2", put: { x: 1, col1: Buffer.alloc(10) } },
        { tableName: "t", delete: myKey1 },
        { tableName: "t2", delete: { col1: true } }
    ]);
}

async function testWriteManyUntyped(ver: RowVersion) {
    let res: WriteMultipleResult;
    // expectTypeOf(function) does not currently support overloads, so we
    // use Overloads defined in utils.
    type WMOverloads = Overloads<typeof client.writeMany<AnyRow>>;
    expectTypeOf<Length<WMOverloads>>().toEqualTypeOf<2>();
    expectTypeOf(client.writeMany).toBeFunction();

    expectTypeOf<WMOverloads[0]>().toBeFunction();
    expectTypeOf<WMOverloads[0]>().parameters
        .toMatchTypeOf<[string, WriteOperation<AnyRow>[],
        WriteMultipleOpt?]>();
    expectTypeOf<WMOverloads[0]>().parameter(0).toBeString();
    expectTypeOf<WMOverloads[0]>().parameter(1)
        .toEqualTypeOf<WriteOperation<AnyRow>[]>();
    expectTypeOf<WMOverloads[0]>().parameter(2)
        .toEqualTypeOf<WriteMultipleOpt|undefined>();
    expectTypeOf<WMOverloads[0]>().returns.not
        .toEqualTypeOf<WriteMultipleResult<AnyRow>>();
    expectTypeOf<WMOverloads[0]>().returns.resolves
        .toEqualTypeOf<WriteMultipleResult<AnyRow>>();

    expectTypeOf<WMOverloads[1]>().toBeFunction();
    expectTypeOf<WMOverloads[1]>().parameters
        .toEqualTypeOf<[WriteOperation<AnyRow>[], WriteMultipleOpt?]>();
    expectTypeOf<WMOverloads[1]>().parameter(0)
        .toEqualTypeOf<WriteOperation<AnyRow>[]>();
    expectTypeOf<WMOverloads[1]>().parameter(1)
        .toEqualTypeOf<WriteMultipleOpt|undefined>();
    expectTypeOf<WMOverloads[1]>().returns.not
        .toEqualTypeOf<WriteMultipleResult<AnyRow>>();
    expectTypeOf<WMOverloads[1]>().returns.resolves
        .toEqualTypeOf<WriteMultipleResult<AnyRow>>();

    res = await client.writeMany("table", [ { put: { x: 1} } ]);
    res = await client.writeMany("table", [ { delete: { x: true } } ]);
    res = await client.writeMany("table", [
        { put: myRow1, ifAbsent: true },
        { delete: { pk1: "a" }, matchVersion: ver } ],
        { compartment: "compartment", timeout: 5000, abortOnFail: true,
        ttl: TTLUtil.ofDays(1) });
    res = await client.writeMany("table", [ { put: { x: 1 } },
        { delete: { x: 1 } } ],
        { timeout: 5000, abortOnFail: true, returnExisting: true,
            ifAbsent: true });

    res = await client.writeMany(
        [ { tableName: "table", put: myRow2 } ]);
    res = await client.writeMany(
        [ { tableName: "table", delete: myKey1 } ]);
    res = await client.writeMany([ { tableName: "t", put: myRow1 },
        { tableName: "t2", delete: myKey1 } ],
        { compartment: "compartment", timeout: 5000, abortOnFail: true,
        ttl: TTLUtil.ofDays(1) });
    res = await client.writeMany(
        [ { tableName: "t", put: myRow1, ttl: { hours: 10 } },
        { tableName: "t", delete: myKey1 } ],
        { timeout: 5000, abortOnFail: true, returnExisting: true,
            ifAbsent: true });

    // @ts-expect-error Missing table name and operations array.
    client.writeMany();
    // @ts-expect-error Missing operations array.
    client.writeMany("table");
    // @ts-expect-error Invalid table name.
    client.writeMany(1, [ { put: myRow1 } ]);
    // @ts-expect-error Invalid put operation option.
    client.writeMany("table", [ { put: myRow1, ttl: "1" } ]);
    // @ts-expect-error Invalid put operation option.
    client.writeMany("table", [ { put: myRow1, abortOnFail: 1 } ]);

    // TODO: enable when have exclusive properties
    client.writeMany(
        // ts-expect-error Wrong option for delete operation.
        [ { tableName: "t", delete: myKey1, updateTTLToDefault: true } ]);
    // ts-expect-error Wrong option for delete operation.
    client.writeMany([ { delete: myKey1, ifAbsent: true } ]);

    // @ts-expect-error Invalid put operation.
    client.writeMany("table", [ { put: "a" } ]);
    // @ts-expect-error Invalid put operation.
    client.writeMany([ { tableName: "t", put: "a" } ]);
    // @ts-expect-error Invalid delete operation.
    client.writeMany("table", [ { delete: true } ]);
    // @ts-expect-error Invalid delete operation.
    client.writeMany([ { tableName: "t", delete: false } ]);

    let res2 = await client.writeMany([ { put: myRow1 },
        { delete: { x: 1 } }]);
    expectTypeOf(res2).toEqualTypeOf<WriteMultipleResult>();

    let res3: WriteMultipleResult<MyRow> = await client.writeMany(
        [ { put: myRow1 }, { put: myRow2 }]);
    
    // @ts-expect-error Cannot reduce the row type to MyRow
    res3 = await client.writeMany([ { put: myRow1 }, { put: myRow2 },
        { put: { x: 1 } }]);
}

async function testPutManyTyped(ver: RowVersion) {
    const putMany = (client.putMany)<MyRow>;
    let res: WriteMultipleResult<MyRow> = {} as WriteMultipleResult<MyRow>;

    expectTypeOf(putMany).toBeFunction();
    expectTypeOf(putMany).parameters
        .toEqualTypeOf<[string, MyRow[], PutManyOpt?]>();
    expectTypeOf(putMany).parameter(0).toBeString();
    expectTypeOf(putMany).parameter(1).toEqualTypeOf<MyRow[]>();
    expectTypeOf(putMany).parameter(2)
        .toEqualTypeOf<PutManyOpt|undefined>();
    expectTypeOf(putMany).returns.not.toEqualTypeOf(res);
    expectTypeOf(putMany).returns.resolves.toEqualTypeOf(res);
    expectTypeOf(putMany).toBeCallableWith("table", [ myRow1 ]);
    expectTypeOf(putMany).toBeCallableWith("table", [ myRow2 ],
        { timeout: 1, ttl: TTLUtil.ofHours(24), matchVersion: ver,
            exactMatch: true, identityCacheSize: 100 });

    res = await client.putMany<MyRow>("table", [ myRow1 ]);
    res = await client.putMany<MyRow>("table",
        [ myRow1, myRow2 ],
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing table name and rows array.
    client.putMany<MyRow>();
    // @ts-expect-error Missing rows array.
    client.putMany<MyRow>("table");
    // @ts-expect-error Invalid table name.
    client.putMany<MyRow>(1, [ myRow1 ]);
    // @ts-expect-error Invalid option.
    client.putMany<MyRow>("table", [ myRow1 ], { timeou: 10000 });

    // @ts-expect-error Invalid row
    client.putMany<MyRow>("table", [ myRow1, 1 ]);
    // @ts-expect-error Invalid row, unknown field
    client.putMany<MyRow>("table", [ { x: 1 } ]);
    // @ts-expect-error Invalid row, missing required col6
    client.putMany<MyRow>("table", [ { pk1: "a", pk2: 1,
        pk3: new Decimal(1) } ]);
    // @ts-expect-error Invalid row for put operation, wrong type for pk3
    client.putMany<MyRow>("table", [ { pk1: "a", pk2: 1, pk3: 1,
        col6: true } ]);
    client.putMany<MyRow>("table", [ { pk1: "a", pk2: 1, pk3: new Decimal(1),
        // @ts-expect-error Invalid row for put operation, invalid extra col7
        col6: true, col7: 1 } ]);
}

async function testPutManyUntyped(ver: RowVersion) {
    const putMany = (client.putMany)<AnyRow>;
    let res: WriteMultipleResult = {} as WriteMultipleResult;

    expectTypeOf(putMany).toBeFunction();
    expectTypeOf(putMany).parameters
        .toEqualTypeOf<[string, AnyRow[], PutManyOpt?]>();
    expectTypeOf(putMany).parameter(0).toBeString();
    expectTypeOf(putMany).parameter(1).toEqualTypeOf<AnyRow[]>();
    expectTypeOf(putMany).parameter(2)
        .toEqualTypeOf<PutManyOpt|undefined>();
    expectTypeOf(putMany).returns.not.toEqualTypeOf(res);
    expectTypeOf(putMany).returns.resolves.toEqualTypeOf(res);
    expectTypeOf(putMany).toBeCallableWith("table", [ { col1: true } ]);
    expectTypeOf(putMany).toBeCallableWith("table", [ { col2: 3 } ],
        { timeout: 1, ttl: TTLUtil.ofHours(24), matchVersion: ver,
            exactMatch: true, identityCacheSize: 100 });

    res = await client.putMany("table", [ { col1: 1 }, { col1: "ab" } ]);
    res = await client.putMany("table",
        [ { x: 1 }, { y: new Decimal(2) }, { x: "a" } ],
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing table name and rows array.
    client.putMany();
    // @ts-expect-error Missing rows array.
    client.putMany("table");
    // @ts-expect-error Invalid table name.
    client.putMany(1, [ myRow1 ]);
    // @ts-expect-error Invalid option.
    client.putMany("table", [ myRow1 ], { timeou: 10000 });

    let res2: WriteMultipleResult<MyRow> = await client.putMany("table",
        [ myRow1, myRow2 ]);
 
    // Below, type for row should be inferred from res2 as MyRow.

    // @ts-expect-error Invalid type for row
    res2 = await client.putMany("table", [ new Map<string, any>() ]);
    // @ts-expect-error Invalid row, missing required field col6
    res2 = await client.putMany("table", [ { pk1: "a", pk2: 1,
        pk3: new Decimal(1) } ]);
    // @ts-expect-error Invalid row, wrong type for pk3
    res2 = await client.putMany("table", [ { pk1: "a", pk2: 1, pk3: 1.1,
        col6: false } ]);
}

async function testDeleteManyTyped(ver: RowVersion) {
    const deleteMany = (client.deleteMany)<MyRow>;
    let res: WriteMultipleResult<MyRow> = {} as WriteMultipleResult<MyRow>;

    expectTypeOf(deleteMany).toBeFunction();
    expectTypeOf(deleteMany).parameters
        .toEqualTypeOf<[string, DerivedKey[], DeleteManyOpt?]>();
    expectTypeOf(deleteMany).parameter(0).toBeString();
    expectTypeOf(deleteMany).parameter(1).toEqualTypeOf<DerivedKey[]>();
    expectTypeOf(deleteMany).parameter(2)
        .toEqualTypeOf<DeleteManyOpt|undefined>();
    expectTypeOf(deleteMany).returns.not.toEqualTypeOf(res);
    expectTypeOf(deleteMany).returns.resolves.toEqualTypeOf(res);
    expectTypeOf(deleteMany).toBeCallableWith("table",
        [ myKey1, myKey2 ]);
    expectTypeOf(deleteMany).toBeCallableWith("table",
        [ myKey1 ],
        { timeout: 1, durability: Durabilities.COMMIT_WRITE_NO_SYNC,
            matchVersion: ver });

    res = await client.deleteMany<MyRow>("table", [ myKey2 ]);
    res = await client.deleteMany<MyRow>("table",
        [ { pk1: "a" }, { pk2: -1, col6: true }],
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing table name and keys array.
    client.deleteMany<MyRow>();
    // @ts-expect-error Missing keys array.
    client.deleteMany<MyRow>("table");
    // @ts-expect-error Invalid table name.
    client.deleteMany<MyRow>(1, [ myKey1 ]);
    // @ts-expect-error Invalid option
    client.deleteMany<MyRow>("table", [ myKey1 ], { timeou: 10000 });
    // @ts-expect-error Invalid key
    client.deleteMany<MyRow>("table", [ myKey1, "a" ]);
    // @ts-expect-error Invalid key, unknown field
    client.deleteMany<MyRow>("table", [ { x: 1 } ]);
    // @ts-expect-error Invalid key, wrong type for pk3
    client.deleteMany<MyRow>("table", [ { pk1: "a", pk2: 1, pk3: 10,
        col6: true } ]);
    client.deleteMany<MyRow>("table", [ { pk1: "a", pk2: 1,
        // @ts-expect-error Invalid key, invalid extra col7
        pk3: new Decimal(1), col6: true, col7: 1 } ]);
}

async function testDeleteManyUntyped(ver: RowVersion) {
    const deleteMany = (client.deleteMany)<AnyRow>;
    let res: WriteMultipleResult = {} as WriteMultipleResult;

    expectTypeOf(deleteMany).toBeFunction();
    expectTypeOf(deleteMany).parameters
        .toEqualTypeOf<[string, AnyKey[], PutManyOpt?]>();
    expectTypeOf(deleteMany).parameter(0).toBeString();
    expectTypeOf(deleteMany).parameter(1).toEqualTypeOf<AnyKey[]>();
    expectTypeOf(deleteMany).parameter(2)
        .toEqualTypeOf<DeleteManyOpt|undefined>();
    expectTypeOf(deleteMany).returns.not.toEqualTypeOf(res);
    expectTypeOf(deleteMany).returns.resolves.toEqualTypeOf(res);
    expectTypeOf(deleteMany).toBeCallableWith("table", [ { col1: true } ]);
    expectTypeOf(deleteMany).toBeCallableWith("table", [ { col2: 3 } ],
        { timeout: 1, matchVersion: ver,
            durability: Durabilities.COMMIT_SYNC });

    res = await client.deleteMany("table", [ { col1: 1 }, { col1: "ab" } ]);
    res = await client.deleteMany("table",
        [ { x: 1 }, { y: new Decimal(2) }, { x: "a" } ],
        { compartment: "compartment", timeout: 5000 });

    // @ts-expect-error Missing table name and rows array.
    client.deleteMany();
    // @ts-expect-error Missing rows array.
    client.deleteMany("table");
    // @ts-expect-error Invalid table name.
    client.deleteMany(1, [ myRow1 ]);
    // @ts-expect-error Invalid option.
    client.deleteMany("table", [ myRow1 ], { timeou: 10000 });

    let res2: WriteMultipleResult<MyRow> = await client.deleteMany("table",
        [ myKey1, myKey2 ]);
 
    // Below, type for row should be inferred from res2 as MyRow.

    // @ts-expect-error Invalid type for row
    res2 = await client.deleteMany("table", [ new Map<string, any>() ]);
    // @ts-expect-error Invalid row, invalid column pk5
    res2 = await client.deleteMany("table", [ { pk1: "a", pk5: "a" } ]);
    // @ts-expect-error Invalid row, wrong type for pk3
    res2 = await client.deleteMany("table", [ { pk1: "a", pk2: 1, pk3: 1.1,
        col6: false } ]);
}
