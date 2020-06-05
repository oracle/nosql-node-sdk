/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const TTLTimeUnit = {
    HOURS: 1,
    DAYS: 2
};

const Type = {
    ARRAY: 0,
    BINARY: 1,
    BOOLEAN: 2,
    DOUBLE: 3,
    INTEGER: 4,
    LONG: 5,
    MAP: 6,
    STRING: 7,
    TIMESTAMP: 8,
    NUMBER: 9,
    JSON_NULL: 10,
    NULL: 11,
    EMPTY: 12
};

const OpCode = {
    DELETE: 0,
    DELETE_IF_VERSION: 1,
    GET: 2,
    PUT: 3,
    PUT_IF_ABSENT: 4,
    PUT_IF_PRESENT: 5,
    PUT_IF_VERSION: 6,
    QUERY: 7,
    PREPARE: 8,
    WRITE_MULTIPLE: 9,
    MULTI_DELETE: 10,
    GET_TABLE: 11,
    GET_INDEXES: 12,
    GET_TABLE_USAGE: 13,
    LIST_TABLES: 14,
    TABLE_REQUEST: 15,
    SCAN: 16,
    INDEX_SCAN: 17,
    CREATE_TABLE: 18,
    ALTER_TABLE: 19,
    DROP_TABLE: 20,
    CREATE_INDEX: 21,
    DROP_INDEX: 22,
    /* added in V2 */
    SYSTEM_REQUEST: 23,
    SYSTEM_STATUS_REQUEST: 24    
};

const MathContext = {
    NONE: 0,
    DECIMAL32: 1,
    DECIMAL64: 2,
    DECIMAL128: 3,
    UNLIMITED: 4,
    CUSTOM: 5
};

MathContext.DEFAULT = MathContext.DECIMAL64;

module.exports = {
    TTLTimeUnit,
    Type,
    OpCode,
    MathContext
};
