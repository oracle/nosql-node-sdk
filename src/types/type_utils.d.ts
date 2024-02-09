/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

// Allow to display properties of the type in VSCode.
export type Expand<T> = T extends infer O ? { [K in keyof O]: O[K] } : never;

declare const opaqueTypeKey: unique symbol;

declare type Tag<T> = {
    readonly [opaqueTypeKey]: T;
    // Prevent opaque type to be assignable to other index signature types.
    readonly [key: PropertyKey]: unknown;
};

// Define opaque type that can be explicitly cast to its BaseType.
export type OpaqueType<BaseType, T> = (BaseType & Tag<T>) | Tag<T>;

// Construct a new type by picking only properties of specified type.
export type ExtractByType<T, PType> = {
    [P in keyof T as T[P] extends PType | undefined ? P : never]: T[P]
}
