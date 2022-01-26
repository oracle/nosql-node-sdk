/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const TABLE_NAME_PFX = require('./common').TABLE_NAME_PFX;
const DEF_TABLE_LIMITS = require('./common').DEF_TABLE_LIMITS;
const enumColValues = require('./common').enumColValues;
const _id = require('./common')._id;

const SIMPLE_TABLE = {
    name: TABLE_NAME_PFX + 'T1',
    limits: DEF_TABLE_LIMITS,
    fields: [
        {
            name: 'id',
            type: 'INTEGER'
        },
        {
            name: 'lastName',
            type: 'STRING'
        },
        {
            name: 'firstName',
            type: 'STRING'
        },
        {
            name: 'info',
            type: 'JSON',
        },
        {
            name: 'startDate',
            type: 'TIMESTAMP',
            typeSpec: 'TIMESTAMP(3)'
        }
    ],
    primaryKey: [ 'id' ]
};

const SIMPLE_TABLE_INDEXES = [
    {
        name: 'idx_name',
        fields: [ 'lastName', 'firstName' ]
    },
    {
        name: 'idx_start_date',
        fields: [ 'startDate' ]
    }
];

const TABLE_DDL_TESTS = [
    {
        desc: 'Table DDL test 1',
        table: SIMPLE_TABLE,
        add_indexes: SIMPLE_TABLE_INDEXES,
        drop_indexes: [
            {
                name: 'idx_name'
            }
        ],
        add_fields: [
            {
                name: 'salary',
                type: 'DOUBLE'
            }
        ],
        drop_fields: [
            {
                name: 'info'
            }
        ],
        alter_ttls: [ { days: 7 } ],
        alter_limits: [
            {
                readUnits: 2000,
                writeUnits: 1000,
                storageGB: 200
            }
        ]
    }
];

const ADMIN_DDL_TESTS = [
    {
        desc: 'Admin DDL test 1',
        ddls: [
            {
                stmt: 'CREATE NAMESPACE N1DDLTEST',
                cleanupStmt: 'DROP NAMESPACE IF EXISTS N1DDLTEST'
            },
            {
                stmt: 'SHOW USERS'
            }
        ]
    }
];

const GET_INDEXES_TESTS = [
    {
        desc: 'getIndexes test 1',
        table: SIMPLE_TABLE,
        indexes: SIMPLE_TABLE_INDEXES
    }
];

const GET_TABLE_TESTS = [
    {
        desc: 'getTable test 1',
        table: SIMPLE_TABLE
    }
];

const LIST_TABLES_TESTS = [
    {
        desc: 'listTables test 1',
        tables: Array.from({ length: 5 }, (_, i) => ({
            name: `${TABLE_NAME_PFX}${i < 3 ? 'T' : 't'}${i+1}`,
            limits: DEF_TABLE_LIMITS,
            fields: SIMPLE_TABLE.fields,
            primaryKey: SIMPLE_TABLE.primaryKey
        }))
    }
];

const TABLE_USAGE_TESTS = [
    {
        desc: 'getTableUsage test 1',
        table: SIMPLE_TABLE,
        row: {
            id: 1,
            lastName: 'Smith',
            firstName: 'John',
            info: { blah: 'blah' },
            startDate: new Date() 
        }
    }
];

//typeSpec must be present if type is object or DB type has additional info
//(precision, default, constraint, etc.)
//We have to describe the structure of nested types as this will give us
//information on the format in which value will be received from the server
//(Utils.toExpectedRow())

const ALL_TYPES_TABLE = {
    name: TABLE_NAME_PFX + 'AllTypes',
    limits: DEF_TABLE_LIMITS,
    enumColValues,
    fields: [
        {
            name: 'shardId',
            type: 'INTEGER'
        },
        {
            name: 'pkString',
            type: 'STRING'
        },
        {
            name: 'colBoolean',
            type: 'BOOLEAN',
        },
        {
            name: 'colInteger',
            type: 'INTEGER'
        },
        {
            name: 'colLong',
            type: 'LONG'
        },
        {
            name: 'colFloat',
            type: 'FLOAT'
        },
        {
            name: 'colDouble',
            type: 'DOUBLE'
        },
        {
            name: 'colNumber',
            type: 'NUMBER'
        },
        {
            name: 'colNumber2',
            type: 'NUMBER'
        },
        {
            name: 'colBinary',
            type: 'BINARY',
        },
        {
            name: 'colFixedBinary',
            type: 'BINARY',
            typeSpec: 'BINARY(64)'
        },
        {
            name: 'colEnum',
            type: 'ENUM',
            typeSpec: `ENUM(${enumColValues.join(', ')})`
        },
        {
            name: 'colTimestamp',
            type: 'TIMESTAMP',
            typeSpec: 'TIMESTAMP(9)'
        },
        {
            name: 'colRecord',
            type: {
                name: 'RECORD',
                fields: [
                    {
                        name: 'fldString',
                        type: 'STRING'
                    },
                    {
                        name: 'fldNumber',
                        type: 'NUMBER'
                    },
                    {
                        name: 'fldArray',
                        type: {
                            name: 'ARRAY',
                            elemType: 'INTEGER'
                        }
                    }
                ]
            },
            typeSpec: 'RECORD(fldString STRING, fldNumber NUMBER, fldArray \
ARRAY(INTEGER))'
        },
        {
            name: 'colArray',
            type: {
                name: 'ARRAY',
                elemType: 'TIMESTAMP'
            },
            typeSpec: 'ARRAY(TIMESTAMP(6))'
        },
        {
            name: 'colArray2',
            type: {
                name: 'ARRAY',
                elemType: 'JSON'
            },
            typeSpec: 'ARRAY(JSON)'
        },
        {
            name: 'colMap',
            type: {
                name: 'MAP',
                elemType: 'LONG'
            },
            typeSpec: 'MAP(LONG)'
        },
        {
            name: 'colMap2',
            type: {
                name: 'MAP',
                elemType: 'BINARY'
            },
            typeSpec: 'MAP(BINARY)'
        },
        {
            name: 'colJSON',
            type: 'JSON'
        },
        {
            name: 'colJSON2',
            type: 'JSON'
        },
        {
            name: 'colIden',
            type: 'LONG',
            typeSpec: 'LONG GENERATED ALWAYS AS IDENTITY',
            isId: true,
            idVal: row => row[_id] + 1
        }
    ],
    primaryKey: [ 'shardId', 'pkString' ],
    shardKeyLength: 1,
    ttl: { days: 3 }
};

//We set last field as identity column
ALL_TYPES_TABLE.idFld =
    ALL_TYPES_TABLE.fields[ALL_TYPES_TABLE.fields.length  - 1];

module.exports = {
    TABLE_NAME_PFX,
    DEF_TABLE_LIMITS,
    SIMPLE_TABLE,
    TABLE_DDL_TESTS,
    ADMIN_DDL_TESTS,
    GET_INDEXES_TESTS,
    GET_TABLE_TESTS,
    LIST_TABLES_TESTS,
    TABLE_USAGE_TESTS,
    ALL_TYPES_TABLE
};
