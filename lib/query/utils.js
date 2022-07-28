/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;

function isNumeric(ctx, val) {
    return typeof val === 'number' || typeof val === 'bigint' ||
        (ctx._dbNumber != null && ctx._dbNumber.isInstance(val));
}

function resBuf2MapKey(buf) {
    //to be improved
    return buf.buffer.toString('latin1', 0, buf.length);
}

function sizeof(ctx, val) {
    if (val == null || val == EMPTY_VALUE) {
        return 0;
    }
    switch(typeof val) {
    case 'boolean':
        return 4;
    case 'number':
        return 8;
    case 'bigint':
        //From here:
        //https://stackoverflow.com/questions/54297544/v8-bigint-size-in-memory
        //We should not have any bigint greater than 64 bits.
        return 24;
    case 'string':
        return 2 * val.length;
    case 'object': {
        if (Buffer.isBuffer(val)) {
            return val.length;
        }
        if (val instanceof Date) {
            return 8; //rough estimate from testing
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val)) {
            //rough estimate for now, can be improved
            return sizeof(ctx, ctx._dbNumber.stringValue(val));
        }
        let size = 0;
        if (Array.isArray(val)) {
            for(let i = 0; i < val.length; i++) {
                size += sizeof(ctx, val[i]);
            }
        } else {
            let ents = val instanceof Map ? val.entries() :
                Object.entries(val);
            for(let ent of ents) {
                const key = ent[0];
                assert(typeof key === 'string');
                size += 2 * key.length + sizeof(ctx, ent[1]);
            }
        }
        return size;
    }
    default:
        assert(false);
    }
}

//Ideally we should iterate only over sorting columns, but currently the
//server does not convert EMPTY to null in any column when sorting takes
//place, so we have to check all the columns.
//We use undefined for SQL NULL.
function convertEmptyToNull(row) {
    for(let key in row) {
        if (row[key] === EMPTY_VALUE) {
            row[key] = undefined;
        }
    }
}

module.exports = {
    isNumeric,
    resBuf2MapKey,
    sizeof,
    convertEmptyToNull
};
