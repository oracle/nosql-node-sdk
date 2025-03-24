/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

// Taken from here:
// https://stackoverflow.com/questions/59535995/parameters-generic-of-overloaded-function-doesnt-contain-all-options/59538756#59538756

export type Overloads<T> =
    T extends {
        (...args: infer A1): infer R1;
        (...args: infer A2): infer R2;
        (...args: infer A3): infer R3;
        (...args: infer A4): infer R4;
    } ? [
        (...args: A1) => R1,
        (...args: A2) => R2,
        (...args: A3) => R3,
        (...args: A4) => R4
    ] : T extends {
        (...args: infer A1): infer R1;
        (...args: infer A2): infer R2;
        (...args: infer A3): infer R3;
    } ? [
        (...args: A1) => R1,
        (...args: A2) => R2,
        (...args: A3) => R3
    ] : T extends {
        (...args: infer A1): infer R1;
        (...args: infer A2): infer R2;
    } ? [
        (...args: A1) => R1,
        (...args: A2) => R2
    ] : T extends {
        (...args: infer A1): infer R1
    } ? [
        (...args: A1) => R1
    ] : any;

export type OverloadedParameters<T> =
    Overloads<T> extends infer O ?
    { [K in keyof O]: Parameters<Extract<O[K], (...args: any) => any>> } :
    never;

export type OverloadedReturnType<T> =
    Overloads<T> extends infer O ?
    { [K in keyof O]: ReturnType<Extract<O[K], (...args: any) => any>> } :
    never;

// Taken from here:
// https://dev.to/sarmunbustillo/typescript-series-length-of-a-tuple-4d8m

export type Length<T extends readonly unknown[]> = T["length"];
