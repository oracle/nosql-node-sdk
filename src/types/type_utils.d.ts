/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

// Taken from:
// https://stackoverflow.com/questions/57683303/how-can-i-see-the-full-expanded-contract-of-a-typescript-type

export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

// Based on:
// https://dev.to/tiagof/opaque-branded-types-in-typescript-59fd
// https://stackoverflow.com/questions/76277426/opaque-type-and-index-signatures

declare const opaqueTypeKey: unique symbol;

declare type Tag<T> = {
    readonly [opaqueTypeKey]: T;
    // Prevent opaque type to be assignable to other index signature types.
    readonly [key: PropertyKey]: unknown;
};

export type OpaqueType<BaseType, T> = (BaseType & Tag<T>) | Tag<T>;

// Based on:
// https://stackoverflow.com/questions/46583883/typescript-pick-properties-with-a-defined-type

export type ExtractByType<T, PType> = {
    [P in keyof T as T[P] extends PType | undefined ? P : never]: T[P]
}
