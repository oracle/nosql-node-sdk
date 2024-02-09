/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import { expectTypeOf } from "expect-type";

import { NoSQLClient, AdminResult, AdminDDLOpt, AdminState, AdminStatusOpt,
    AdminListOpt, UserInfo } from "../../../";

const client = new NoSQLClient("nosuchfile.json");

function testAdminDDLOpt(res: AdminResult) {
    let opt: AdminDDLOpt = {};

    opt.timeout = 10000;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    opt.complete = true;
    opt.complete = undefined;
    // @ts-expect-error Invalid type for complete.
    opt.complete = 1;
    opt.delay = 1000;
    // @ts-expect-error Invalid type for delay.
    opt.delay = "1000";
    // @ts-expect-error Invalid extra property in opt.
    opt.compartment = "c";
    // @ts-expect-error Invalid extra property in opt.
    opt.namespace = "n";
}

function testAdminResult(res: AdminResult) {
    // check result types
    expectTypeOf(res.state).toEqualTypeOf<AdminState>();
    expectTypeOf(res.operationId).toEqualTypeOf<string|undefined>();
    expectTypeOf(res.statement).toBeString();
    expectTypeOf(res.output).toEqualTypeOf<string|undefined>();
    
    // all properties of TableResult must be read-only
    expectTypeOf<Readonly<AdminResult>>().toEqualTypeOf<AdminResult>();
    
    // @ts-expect-error Invalid extra property.
    res.sql;
}

async function testAdminDDL() {
    expectTypeOf(client.adminDDL).toBeFunction();
    expectTypeOf(client.adminDDL).parameters
        .toEqualTypeOf<[string|Buffer, AdminDDLOpt?]>();
    expectTypeOf(client.adminDDL).parameter(0)
        .toEqualTypeOf<string|Buffer>();
    expectTypeOf(client.adminDDL).parameter(1)
        .toEqualTypeOf<AdminDDLOpt|undefined>();
    expectTypeOf(client.adminDDL).returns.not.toEqualTypeOf<AdminResult>();
    expectTypeOf(client.adminDDL).returns.resolves
        .toEqualTypeOf<AdminResult>();
    expectTypeOf(client.adminDDL).toBeCallableWith("stmt");
    expectTypeOf(client.adminDDL).toBeCallableWith(Buffer.alloc(10),
        { timeout: 1 });
    expectTypeOf(client.adminDDL).toBeCallableWith("stmt",
        { complete: true, delay: 1000 });

    let res: AdminResult = await client.adminDDL("stmt");
    res = await client.adminDDL(Buffer.alloc(10));
    
    // @ts-expect-error Missing arguments.
    client.adminDDL();
    // @ts-expect-error Invalid type for statement.
    client.adminDDL(1);
    // @ts-expect-error Invalid type for statement.
    client.adminDDL({ statement: "stmt" });
    // @ts-expect-error Invalid type for options.
    client.adminDDL("stmt", 1);
    // @ts-expect-error Invalid type for options.
    client.adminDDL("stmt", "opt");
    // @ts-expect-error Invalid extra argument.
    client.adminDDL("stmt", {}, "extra");
    // @ts-expect-error Invalid extra arguments.
    client.adminDDL("stmt", {}, {}, {});
}

function testAdminStatusOpt() {
    let opt: AdminStatusOpt = {};
    opt.timeout = 10000;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    // @ts-expect-error Invalid extra property.
    opt.delay = 1000;
    // @ts-expect-error Invalid extra property.
    opt.namespace = "n";
}

async function testAdminStatus(res: AdminResult) {
    expectTypeOf(client.adminStatus).toBeFunction();
    expectTypeOf(client.adminStatus).parameters
        .toEqualTypeOf<[AdminResult, AdminStatusOpt?]>();
    expectTypeOf(client.adminStatus).parameter(0)
        .toEqualTypeOf<AdminResult>();
    expectTypeOf(client.adminStatus).parameter(1)
        .toEqualTypeOf<AdminStatusOpt|undefined>();
    expectTypeOf(client.adminStatus).returns.not.toEqualTypeOf<AdminResult>();
    expectTypeOf(client.adminStatus).returns.resolves
        .toEqualTypeOf<AdminResult>();
    expectTypeOf(client.adminStatus).toBeCallableWith(res);
    expectTypeOf(client.adminStatus).toBeCallableWith(res, { timeout: 1 });

    res = await client.adminStatus(res);
    res = await client.adminStatus(res, { timeout: 5000 });

    // @ts-expect-error Missing arguments.
    client.adminStatus();
    // @ts-expect-error Invalid admin status argument.
    client.adminStatus({ timeout: 1 });
    // @ts-expect-error Invalid admin status argument.
    client.adminStatus(123);
    // @ts-expect-error Invalid option.
    client.adminStatus(res, { delay: 1000 });
}

function testAdminListOpt() {
    let opt: AdminListOpt = {};
    opt.timeout = 10000;
    // @ts-expect-error Invalid type for timeout.
    opt.timeout = "10000";
    opt.delay = 1000;
    // @ts-expect-error Invalid type for delay.
    opt.delay = "1000";
    // @ts-expect-error Invalid extra property in opt.
    opt.complete = true;
    // @ts-expect-error Invalid extra option.
    opt.namespace = "n";
}

async function testListNamespaces() {
    expectTypeOf(client.listNamespaces).toBeFunction();
    expectTypeOf(client.listNamespaces).parameters
        .toEqualTypeOf<[AdminListOpt?]>();
    expectTypeOf(client.listNamespaces).parameter(0)
        .toEqualTypeOf<AdminListOpt|undefined>();
    expectTypeOf(client.listNamespaces).returns.not
        .toEqualTypeOf<string[]>();
    expectTypeOf(client.listNamespaces).returns.resolves
        .toEqualTypeOf<string[]>();
    expectTypeOf(client.listNamespaces).toBeCallableWith();
    expectTypeOf(client.listNamespaces).toBeCallableWith(
        { timeout: 1, delay: 1 });

    let res: string[] = await client.listNamespaces();
    res = await client.listNamespaces({ timeout: 10000 });
    res = await client.listNamespaces({ delay: 1000 });

    // @ts-expect-error Invalid option.
    client.listNamespaces(1);
    // @ts-expect-error Invalid option.
    client.listNamespaces({ timeout: "1 hour" });
    // @ts-expect-error Invalid option.
    client.listNamespaces({ complete: 1 });
    // @ts-expect-error Invalid extra argument.
    client.listNamespaces({ delay: 1 }, {});
}

async function testListRoles() {
    expectTypeOf(client.listRoles).toBeFunction();
    expectTypeOf(client.listRoles).parameters
        .toEqualTypeOf<[AdminListOpt?]>();
    expectTypeOf(client.listRoles).parameter(0)
        .toEqualTypeOf<AdminListOpt|undefined>();
    expectTypeOf(client.listRoles).returns.not
        .toEqualTypeOf<string[]>();
    expectTypeOf(client.listRoles).returns.resolves
        .toEqualTypeOf<string[]>();
    expectTypeOf(client.listRoles).toBeCallableWith();
    expectTypeOf(client.listRoles).toBeCallableWith(
        { timeout: 1, delay: 1 });

    let res: string[] = await client.listRoles();
    res = await client.listRoles({ timeout: 10000 });
    res = await client.listRoles({ delay: 1000 });

    // @ts-expect-error Invalid option.
    client.listRoles(1);
    // @ts-expect-error Invalid option.
    client.listRoles({ timeout: "1 hour" });
    // @ts-expect-error Invalid option.
    client.listRoles({ complete: 1 });
    // @ts-expect-error Invalid extra argument.
    client.listRoles({ delay: 1 }, {});
}

function testUserInfo(ui: UserInfo) {
    expectTypeOf(ui.id).toBeString();
    expectTypeOf(ui.name).toBeString();
    // all properties of TableResult must be read-only
    expectTypeOf<Readonly<UserInfo>>().toEqualTypeOf<UserInfo>();

    // @ts-expect-error Invalid property name.
    ui.userId;
}

async function testListUsers() {
    expectTypeOf(client.listUsers).toBeFunction();
    expectTypeOf(client.listUsers).parameters
        .toEqualTypeOf<[AdminListOpt?]>();
    expectTypeOf(client.listUsers).parameter(0)
        .toEqualTypeOf<AdminListOpt|undefined>();
    expectTypeOf(client.listUsers).returns.not
        .toEqualTypeOf<UserInfo[]>();
    expectTypeOf(client.listUsers).returns.resolves
        .toEqualTypeOf<UserInfo[]>();
    expectTypeOf(client.listUsers).toBeCallableWith();
    expectTypeOf(client.listUsers).toBeCallableWith(
        { timeout: 1, delay: 1 });

    let res: UserInfo[] = await client.listUsers();
    res = await client.listUsers({ timeout: 10000 });
    res = await client.listUsers({ delay: 1000 });

    // @ts-expect-error Invalid option.
    client.listUsers(1);
    // @ts-expect-error Invalid option.
    client.listUsers({ timeout: "1 hour" });
    // @ts-expect-error Invalid option.
    client.listUsers({ complete: 1 });
    // @ts-expect-error Invalid extra argument.
    client.listUsers({ delay: 1 }, {});
}
