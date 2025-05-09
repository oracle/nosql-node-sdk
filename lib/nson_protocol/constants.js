/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const Fields = {

    //request fields
    ABORT_ON_FAIL: 'a',
    BATCH_COUNTER: 'bc',
    BIND_VARIABLES: 'bv',
    COMPARTMENT_OCID: 'cc',
    CONSISTENCY: 'co',
    CONTINUATION_KEY: 'ck',
    DATA: 'd',
    DEFINED_TAGS: 'dt',
    DURABILITY: 'du',
    END: 'en',
    ETAG: 'et',
    EXACT_MATCH: 'ec',
    FIELDS: 'f',
    FREE_FORM_TAGS: 'ff',
    GET_QUERY_PLAN: 'gq',
    GET_QUERY_SCHEMA: 'gs',
    HEADER: 'h',
    IDEMPOTENT: 'ip',
    IDENTITY_CACHE_SIZE: 'ic',
    INCLUSIVE: 'in',
    INDEX: 'i',
    INDEXES: 'ix',
    IS_JSON: 'j',
    IS_PREPARED: 'is',
    IS_SIMPLE_QUERY: 'iq',
    KEY: 'k',
    KV_VERSION: 'kv',
    LAST_INDEX: 'li',
    LIST_MAX_TO_READ: 'lx',
    LIST_START_INDEX: 'ls',
    MATCH_VERSION: 'mv',
    MAX_READ_KB: 'mr',
    MAX_SHARD_USAGE_PERCENT: 'ms',
    MAX_WRITE_KB: 'mw',
    NAME: 'm',
    NAMESPACE: 'ns',
    NUMBER_LIMIT: 'nl',
    NUM_OPERATIONS: 'no',
    OPERATIONS: 'os',
    OPERATION_ID: 'od',
    OP_CODE: 'o',
    PATH: 'pt',
    PAYLOAD: 'p',
    PREPARE: 'pp',
    PREPARED_QUERY: 'pq',
    PREPARED_STATEMENT: 'ps',
    QUERY: 'q',
    QUERY_VERSION: 'qv',
    QUERY_ID: 'qn',
    RANGE: 'rg',
    RANGE_PATH: 'rp',
    READ_THROTTLE_COUNT: 'rt',
    REGION: 'rn',
    RETURN_ROW: 'rr',
    SERVER_MEMORY_CONSUMPTION: 'sm',
    SHARD_ID: 'si',
    START: 'sr',
    STATEMENT: 'st',
    STORAGE_THROTTLE_COUNT: 'sl',
    TABLES: 'tb',
    TABLE_DDL: 'td',
    TABLE_NAME: 'n',
    TABLE_OCID: 'to',
    TABLE_USAGE: 'u',
    TABLE_USAGE_PERIOD: 'pd',
    TIMEOUT: 't',
    TOPO_SEQ_NUM: 'ts',
    TRACE_LEVEL: 'tl',
    TRACE_TO_LOG_FILES: 'tf',
    TTL: 'tt',
    TYPE: 'y',
    UPDATE_TTL: 'ut',
    VALUE: 'l',
    VERSION: 'v',
    WRITE_MULTIPLE: 'wm',
    WRITE_THROTTLE_COUNT: 'wt',

    //response fields
    ERROR_CODE: 'e',
    EXCEPTION: 'x',
    NUM_DELETIONS: 'nd',
    RETRY_HINT: 'rh',
    SUCCESS: 'ss',
    TOPOLOGY_INFO: 'tp',
    WM_FAILURE: 'wf',
    WM_FAIL_INDEX: 'wi',
    WM_FAIL_RESULT: 'wr',
    WM_SUCCESS: 'ws',

    //table metadata
    INITIALIZED: 'it',
    REPLICAS: 'rc',
    SCHEMA_FROZEN: 'sf',
    TABLE_SCHEMA: 'ac',
    TABLE_STATE: 'as',

    //system request
    SYSOP_RESULT: 'rs',
    SYSOP_STATE: 'ta',

    //throughput used and limits
    CONSUMED: 'c',
    LIMITS: 'lm',
    LIMITS_MODE: 'mo',
    READ_KB: 'rk',
    READ_UNITS: 'ru',
    STORAGE_GB: 'sg',
    WRITE_KB: 'wk',
    WRITE_UNITS: 'wu',

    //row metadata
    EXPIRATION: 'xp',
    MODIFIED: 'md',
    ROW: 'r',
    ROW_VERSION: 'rv',

    //operation metadata
    EXISTING_MOD_TIME: 'em',
    EXISTING_VALUE: 'el',
    EXISTING_VERSION: 'ev',
    GENERATED: 'gn',
    RETURN_INFO: 'ri',

    //query response fields
    DRIVER_QUERY_PLAN: 'dq',
    MATH_CONTEXT_CODE: 'mc',
    MATH_CONTEXT_ROUNDING_MODE: 'rm',
    MATH_CONTEXT_PRECISION: 'cp',
    NOT_TARGET_TABLES: 'nt',
    NUM_RESULTS: 'nr',
    PROXY_TOPO_SEQNUM: 'pn',
    QUERY_OPERATION: 'qo',
    QUERY_PLAN_STRING: 'qs',
    QUERY_RESULTS: 'qr',
    QUERY_RESULT_SCHEMA: 'qc',
    REACHED_LIMIT: 're',
    SHARD_IDS: 'sa',
    SORT_PHASE1_RESULTS: 'p1',
    TABLE_ACCESS_INFO: 'ai',
    QUERY_BATCH_TRACES: 'qts',

    //query virtual scan-related fields
    VIRTUAL_SCAN: 'vs',
    VIRTUAL_SCANS: 'vssa',
    VIRTUAL_SCAN_SID: 'vssid',
    VIRTUAL_SCAN_PID: 'vspid',
    VIRTUAL_SCAN_PRIM_KEY: 'vspk',
    VIRTUAL_SCAN_SEC_KEY: 'vssk',
    VIRTUAL_SCAN_MOVE_AFTER: 'vsma',
    VIRTUAL_SCAN_JOIN_DESC_RESUME_KEY: 'vsjdrk',
    VIRTUAL_SCAN_JOIN_PATH_TABLES: 'vsjpt',
    VIRTUAL_SCAN_JOIN_PATH_KEY: 'vsjpk',
    VIRTUAL_SCAN_JOIN_PATH_SEC_KEY: 'vsjpsk',
    VIRTUAL_SCAN_JOIN_PATH_MATCHED: 'vsjpm',

    //replica stats response fields
    NEXT_START_TIME: 'ni',
    REPLICA_STATS: 'ra',
    REPLICA_LAG: 'rl',
    TIME: 'tm'
};

module.exports = {
    Fields
};
