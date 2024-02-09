/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const util = require('util');
const EMPTY_VALUE = require('../constants').EMPTY_VALUE;
const isNumeric = require('./utils').isNumeric;
const isPlainObject = require('../utils').isPlainObject;
const compare = require('../utils').compare;
const sortMapEntries = require('../utils').sortMapEntries;

function _compVal(val1, val2) {
    if (typeof val1 === 'number') {
        //NaN is equal to itself and is greater than everything else
        if (isNaN(val1)) {
            return (typeof val2 === 'number' && isNaN(val2)) ? 0 : 1;
        }
        if (typeof val2 === 'number' && isNaN(val2)) {
            return -1;
        }
    }
    return compare(val1, val2);
}

//For comparison of different types we assume:
//numerics < timestamps < strings < booleans
//This function assumes the arguments are not null or EMPTY
function compareNonNullAtomics(ctx, val1, val2) {
    switch(typeof val1) {
    case 'number': case 'bigint':
        if (typeof val2 === 'number' || typeof val2 === 'bigint') {
            return _compVal(val1, val2);
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val2)) {
            //3rd party number library may not support any operations with
            //bigint, going through string ensures precision is preserved.
            if (typeof val1 === 'bigint') {
                val1 = ctx._dbNumber.create(val1.toString());
            }
            return -ctx._dbNumber.compare(val2, val1);
        }
        if (typeof val2 === 'string' || typeof val2 === 'boolean' ||
            val2 instanceof Date) {
            return -1;
        }
        break;
    case 'string': case 'boolean':
        if (typeof val1 === typeof val2) {
            return _compVal(val1, val2);
        }
        if (typeof val2 === 'string' || isNumeric(ctx, val2) ||
            val2 instanceof Date) {
            return 1;
        }
        if (typeof val2 === 'boolean') {
            return -1;
        }
        break;
    case 'object':
        if (val1 instanceof Date) {
            if (val2 instanceof Date) {
                return _compVal(val1.getTime(), val2.getTime());
            }
            if (typeof val2 === 'string' || typeof val2 === 'boolean') {
                return -1;
            }
            if (isNumeric(ctx, val2)) {
                return 1;
            }
            break;
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val1)) {
            if (typeof val2 === 'bigint') {
                val2 = ctx._dbNumber.create(val2.toString());
            }
            if (ctx._dbNumber.isInstance(val2) || typeof val2 === 'number') {
                return ctx._dbNumber.compare(val1, val2);
            }
            if (typeof val2 === 'string' || typeof val2 === 'boolean' ||
                val2 instanceof Date) {
                return -1;
            }
            break;
        }
    default:
        throw ctx.unsupportedComp(val1);
    }
    throw ctx.unsupportedComp(val2);
}

//compare in ascending order only
//compareRows() will reverse for descending order
//undefined is used for SQL NULL, null for JSON NULL
function compareAtomics(ctx, val1, val2, nullRank) {
    if (val1 === undefined) {
        switch(val2) {
        case undefined:
            return 0;
        case null: case EMPTY_VALUE:
            return 1;
        default:
            return nullRank;
        }
    } else if (val1 === null) {
        switch(val2) {
        case undefined:
            return -1;
        case null:
            return 0;
        case EMPTY_VALUE:
            return 1;
        default:
            return nullRank;
        }
    } else if (val1 === EMPTY_VALUE) {
        switch(val2) {
        case undefined: case null:
            return -1;
        case EMPTY_VALUE:
            return 0;
        default:
            return nullRank;
        }
    } else if (val2 == null || val2 === EMPTY_VALUE) {
        return -nullRank;
    }
    return compareNonNullAtomics(ctx, val1, val2);
}

//Same as compareAtomics() but allows comparison of binary values. See
//compareFieldValuesTotalOrder().
function compareAtomicsTotalOrder(ctx, val1, val2, nullRank) {
    if (Buffer.isBuffer(val1)) {
        return Buffer.isBuffer(val2) ?
            Buffer.compare(val1, val2) :
            ((val2 == null || val2 === EMPTY_VALUE) ? -nullRank : 1);
    }
    if (Buffer.isBuffer(val2)) {
        return (val1 == null || val1 === EMPTY_VALUE) ? nullRank : -1;
    }
    return compareAtomics(ctx, val1, val2, nullRank);
}

function compareRows(ctx, row1, row2, sortSpecs) {
    for(let ss of sortSpecs) {
        let compRes = compareAtomics(ctx, row1[ss.fieldName],
            row2[ss.fieldName], ss.nullRank);
        if (ss.isDesc) {
            compRes = -compRes;
        }
        if (compRes) {
            return compRes;
        }
    }
    return 0;
}

function _compareArrays(ctx, arr1, arr2, nullRank) {
    const len = Math.min(arr1.length, arr2.length);
    for(let i = 0; i < len; i++) {
        const res = compareFieldValuesTotalOrder(ctx, arr1[i],
            arr2[i], nullRank);
        if (res !== 0) {
            return res;
        }
    }
    return compare(arr1.length, arr2.length);
}

function _compareMapEntries(ctx, ents1, ents2, nullRank) {
    ents1 = sortMapEntries(ents1);
    ents2 = sortMapEntries(ents2);
    const len = Math.min(ents1.length, ents2.length);
    for(let i = 0; i < len; i++) {
        let res = compare(ents1[i][0], ents2[i][0]);
        if (res !== 0) {
            return res;
        }
        res = compareFieldValuesTotalOrder(ctx, ents1[i][1], ents2[i][1],
            nullRank);
        if (res !== 0) {
            return res;
        }
    }
    return compare(ents1.length, ents2.length);
}

//Includes comparison of complex types, such as arrays and maps, as well as
//binary. The order between different types is:
//Arrays > Maps > Atomic values, and Binary values (which are atomic) are
//greater than any other atomic values except special values (Null, Json Null
//and Empty), for which nullRank is used. Other than that, the order is the
//same as in compareAtomics().
function compareFieldValuesTotalOrder(ctx, val1, val2, nullRank = 1) {
    if (Array.isArray(val1)) {
        return Array.isArray(val2) ?
            _compareArrays(ctx, val1, val2, nullRank) : 1;
    }
    if (val1 instanceof Map || isPlainObject(val1)) {
        if (Array.isArray(val2)) {
            return -1;
        }
        if (!(val2 instanceof Map) && !isPlainObject(val2)) {
            return 1;
        }
        return _compareMapEntries(ctx,
            val1 instanceof Map ? val1.entries() : Object.entries(val1),
            val2 instanceof Map ? val2.entries() : Object.entries(val2),
            nullRank);
    }
    if (Array.isArray(val2) || val2 instanceof Map || isPlainObject(val2)) {
        return -1;
    }
    return compareAtomicsTotalOrder(ctx, val1, val2, nullRank);
}

//We assume the values can be either Map of object, although Map is not
//currently used in protocol when reading field values.
function _mapValuesEqual(ctx, val1, val2) {
    let ents1;
    let size1;
    if (val1 instanceof Map) {
        ents1 = val1.entries();
        size1 = val1.size;
    } else {
        ents1 = Object.entries(val1);
        size1 = ents1.length;
    }
    const isMap2 = val2 instanceof Map;
    const size2 = isMap2 ? val2.size : Object.keys(val2).length;
    if (size1 !== size2) {
        return false;
    }
    for(let [k1, v1] of ents1) {
        const v2 = isMap2 ? val2.get(k1) : val2[k1];
        if (!fieldValuesEqual(ctx, v1, v2)) {
            return false;
        }
    }
    return true;
}

//Compare field values for grouping in SFWIterator.
//Note that for efficiency the type checking of val2 is not done, since these
//are the values deserialized while reading records.
function fieldValuesEqual(ctx, val1, val2) {
    if (val1 == null) { //NULL (undefined) or JSON NULL (null)
        return val1 === val2;
    }
    switch(typeof val1) {
    case 'number': case 'bigint':
        if (typeof val2 === 'number' || typeof val2 === 'bigint') {
            return val1 == val2;
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val2)) {
            if (typeof val1 === 'bigint') {
                val1 = ctx._dbNumber.create(val1.toString());
            }
            return ctx._dbNumber.valuesEqual(val2, val1);
        }
        return false;
    case 'string': case 'boolean':
        return val1 === val2;
    case 'object':
        if (val1 instanceof Date) {
            return val2 instanceof Date && val1.getTime() === val2.getTime();
        }
        if (Buffer.isBuffer(val1)) {
            return Buffer.isBuffer(val2) && val1.equals(val2);
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val1)) {
            if (typeof val2 === 'bigint') {
                val2 = ctx._dbNumber.create(val2.toString());
            }
            return (ctx._dbNumber.isInstance(val2) ||
                typeof val2 === 'number') &&
                ctx._dbNumber.valuesEqual(val1, val2);
        }
        if (Array.isArray(val1)) {
            return Array.isArray(val2) && val1.reduce((acc, curr, idx) =>
                acc && fieldValuesEqual(curr, val2[idx]), true);
        }
        return _mapValuesEqual(val1, val2);
    default:
        throw ctx.illegalState(`Unexpected field value for equality \
comparison: ${util.inspect(val1)}`);
    }
}

module.exports = {
    compareNonNullAtomics,
    compareAtomics,
    compareAtomicsTotalOrder,
    compareRows,
    compareFieldValuesTotalOrder,
    fieldValuesEqual
};
