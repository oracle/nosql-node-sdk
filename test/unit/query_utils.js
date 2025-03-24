/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */
 
'use strict';

//Advanced query utility functions.

//Current limitation: we cannot verify partial sorting order of query results
//(where results are sorted on some fields but within any group of rows
//with a given value of those fields the ordering is arbitrary).  This also
//means that we usually cannot verify queries containing group by / distinct
//and order by unless sorting columns are the same as grouping columns.

const expect = require('chai').expect;
const assert = require('assert');
const getDistance = require('geolib').getPreciseDistance;
const computeDestinationPoint = require('geolib').computeDestinationPoint;
const Utils = require('./utils');
const NumberUtils = require('./number_utils');
const EMPTY_VALUE = require('../../lib/constants').EMPTY_VALUE;
const isPlainObject = require('../../lib/utils').isPlainObject;

const CompTypeRank = {
    NUMERIC: 0,
    TIMESTAMP: 1,
    STRING: 2,
    BOOLEAN: 3,
    //The following are only used for sorting used to verify undordered query
    //cases.  The sorting order for these doesn't matter as long as it is
    //deterministic with respect to the contained data.
    BINARY: 10,
    ARRAY: 11,
    //Objects are compared without regard to the order of keys, so the keys
    //are sorted before the comparsion.
    OBJECT: 12
};

function compTypeRank(val) {
    if (NumberUtils.isNumber(val)) {
        return CompTypeRank.NUMERIC;
    }
    if (val instanceof Date) {
        return CompTypeRank.TIMESTAMP;
    }
    if (typeof val === 'string') {
        return CompTypeRank.STRING;
    }
    if (typeof val === 'boolean') {
        return CompTypeRank.BOOLEAN;
    }
    if (Buffer.isBuffer(val)) {
        return CompTypeRank.BINARY;
    }
    if (Array.isArray(val)) {
        return CompTypeRank.ARRAY;
    }
    if (val instanceof Map || isPlainObject(val)) {
        return CompTypeRank.OBJECT;
    }
    assert(false, 'Unexpected type of value for comparison');
}

class QueryUtils extends Utils {

    static getFieldValue(row, field) {
        if (typeof field === 'function') {
            return field(row);
        }
        if (typeof field === 'object') {
            if (field.name) {
                field = field.name;
            } else {
                //test self-checks
                expect(field.args).to.be.an('array');
                expect(field.expr).to.be.a('function');
                const args = field.args.map(arg =>
                    QueryUtils.getFieldValue(row, arg));
                return args.includes(undefined) || args.includes(null) ||
                    args.includes(EMPTY_VALUE) ?
                    undefined : field.expr(args);
            }
        }
        const fs = field.split('.');
        
        expect(fs.length).to.be.greaterThan(0);
        //allow only the last field step to be array/map element using []
        let key;
        let i = fs[fs.length - 1].indexOf('[');
        if (i !== -1) {
            key = fs[fs.length - 1].substring(i + 1);
            fs[fs.length - 1] = fs[fs.length - 1].substring(0, i);
            i = key.indexOf(']');
            expect(i).to.be.greaterThan(0);
            key = key.substring(0, i);
        }

        let v = row;
        for(let i = 0; i < fs.length; i++) {
            const f = fs[i];
            if (!(f in v)) { //EMPTY value
                return EMPTY_VALUE;
            }
            v = v[f];
            if (v === undefined) {
                return undefined;
            }
            if (v === null) {
                //subfield of JSON null is EMPTY
                return i < fs.length - 1 ? EMPTY_VALUE : null;
            }
        }
        return key != null ? v[key] : v;
    }

    static fieldAs(field) {
        if (typeof field === 'object') {
            expect(field.as).to.be.a('string'); //test self-check
            return field.as;
        }
        expect(field).to.be.a('string');
        const i = field.lastIndexOf('.');
        if (i !== -1) {
            //Note that the portion after '.' should not equal other
            //returned field names for this to work.  Otherwise use 'as'.
            field = field.substring(i + 1);
        }
        return field;
    }

    static projectRow(row, ...fields) {
        expect(fields.length).to.be.greaterThan(0);
        if (Array.isArray(fields[0])) {
            fields = fields[0];
        }
        const pRow = {};
        fields.forEach(fld => {
            pRow[QueryUtils.fieldAs(fld)] =
                QueryUtils.getFieldValue(row, fld);
        });
        return pRow;
    }

    static projectRows(rows, ...fields) {
        expect(fields.length).to.be.greaterThan(0);
        if (Array.isArray(fields[0])) {
            fields = fields[0];
        }
        return rows.map(row => QueryUtils.projectRow(row, fields));
    }

    static _chkConvMap(val) {
        return val instanceof Map ? Utils.map2object(val) : val;
    }

    //This always compares in ascending order.
    //nullRank: nulls last = 1 (default), nulls first = -1
    static compareFieldValues(val1, val2, nullRank = 1) {
        if (val1 === undefined) {
            return val2 === undefined ? 0 :
                ((val2 === null || val2 === EMPTY_VALUE) ? 1 : nullRank);
        } else if (val1 === null) {
            return val2 === undefined ? -1 : (val2 === null ?
                0 : (val2 === EMPTY_VALUE ? 1 : nullRank));
        } else if (val1 === EMPTY_VALUE) {
            return val2 == null ? -1 : (val2 === EMPTY_VALUE ? 0 : nullRank);
        } else if (val2 == null || val2 === EMPTY_VALUE) {
            return -nullRank;
        }

        const compTR1 = compTypeRank(val1);
        const compTR2 = compTypeRank(val2);
        expect(compTR1).to.be.at.least(0);
        expect(compTR2).to.be.at.least(0);
        
        if (compTR1 !== compTR2) {
            return compTR1 > compTR2 ? 1 : -1;
        }

        switch(compTR1) {
        case CompTypeRank.BINARY:
            val1 = val1.toString('base64');
            val2 = val2.toString('base64');
            break;
        case CompTypeRank.TIMESTAMP:
            val1 = val1.getTime();
            val2 = val2.getTime();
            break;
        case CompTypeRank.ARRAY:
            if (val1.length != val2.length) {
                return val1.length - val2.length;
            }
            return QueryUtils.compareRows(val1, val2, Object.keys(val1),
                nullRank);
        case CompTypeRank.OBJECT: {
            //compareRows() assumes values are objects so we have to convert
            //maps, if any, to objects.
            val1 = QueryUtils._chkConvMap(val1);
            val2 = QueryUtils._chkConvMap(val2);

            const keys1 = Object.keys(val1).sort();
            const keys2 = Object.keys(val2).sort();
            const keyRes = QueryUtils.compareFieldValues(keys1, keys2,
                nullRank);
            if (keyRes) {
                return keyRes;
            }
            return QueryUtils.compareRows(val1, val2, keys1, nullRank);
        }
        case CompTypeRank.NUMERIC:
            //NaN is equal to itself and is greater than everything else
            if (NumberUtils.isNaN(val1)) {
                return NumberUtils.isNaN(val2) ? 0 : 1;
            }
            if (NumberUtils.isNaN(val2)) {
                return -1;
            }
            return NumberUtils.cmp(val1, val2);
        default:
            break;
        }

        return val1 > val2 ? 1 : (val1 === val2 ? 0 : -1);
    }

    static compareRows(row1, row2, fields, nullRank) {
        for(let field of fields) {
            let compRes = QueryUtils.compareFieldValues(
                QueryUtils.getFieldValue(row1, field),
                QueryUtils.getFieldValue(row2, field),
                nullRank);
            if (compRes) {
                return compRes;
            }
        }
        return 0;
    }
    
    static _sortRows(rows, fields, nullRank = 1) {
        rows = rows.slice(0); //make a copy, we do not want to modify original
        return rows.sort((row1, row2) => QueryUtils.compareRows(row1, row2,
            fields, nullRank));
    }

    static sortRows(rows, ...fields) {
        return QueryUtils._sortRows(rows, fields);
    }

    static sortRowsNullsFirst(rows, ...fields) {
        return QueryUtils._sortRows(rows, fields, -1);
    }

    //SQL NULL, JSON NULL or EMPTY
    static _isAnyNullOrEmpty(val) {
        return val == null || val === EMPTY_VALUE;
    }

    //SQL NULL or EMPTY
    static _isNullOrEmpty(val) {
        return val === undefined || val === EMPTY_VALUE;
    }

    static _skipForMinMax(val) {
        return QueryUtils._isAnyNullOrEmpty(val);
    }

    static _aggregate(rows, field, skipFunc, aggrFunc, initVal) {
        let ret = initVal;
        for(let row of rows) {
            const val = QueryUtils.getFieldValue(row, field);
            if (skipFunc(val)) {
                continue;
            }
            //Fits our existing aggregate functions, since we never aggregate
            //with undefined, but may need to be revised.
            ret = (ret === undefined) ? val : aggrFunc(ret, val);
        }
        return ret;
    }

    //shortcut for use in group by
    static count(rows, field) {
        return field == null ? rows.length :
            QueryUtils._aggregate(rows, field, QueryUtils._isAnyNullOrEmpty,
                v1 => v1 + 1, 0);
    }

    static min(rows, field) {
        return QueryUtils._aggregate(rows, field, QueryUtils._skipForMinMax,
            (v1, v2) => QueryUtils.compareFieldValues(v1, v2) < 0 ? v1 : v2);
    }

    static max(rows, field) {
        return QueryUtils._aggregate(rows, field, QueryUtils._skipForMinMax,
            (v1, v2) => QueryUtils.compareFieldValues(v1, v2) > 0 ? v1 : v2);
    }

    static sum(rows, field) {
        return QueryUtils._aggregate(rows, field,
            v => !NumberUtils.isNumber(v),
            (v1, v2) => NumberUtils.add(v1, v2));
    }

    static avg(rows, field) {
        const res = QueryUtils._aggregate(rows, field,
            v => !NumberUtils.isNumber(v), (v1, v2) => {
                if (NumberUtils.isNumber(v1)) {
                    v1 = { cnt: 1, val: v1 };
                }
                return {
                    cnt: v1.cnt + 1,
                    val: NumberUtils.add(v1.val, v2)
                };
            });
        //handle cases of only one row or multiple rows
        return res === undefined || NumberUtils.isNumber(res) ?
            res : NumberUtils.div(res.val, res.cnt);
    }

    static collect(rows, field) {
        return QueryUtils._aggregate(rows, field, QueryUtils._isNullOrEmpty,
            (arr, val) => { arr.push(val); return arr; }, []);
    }

    static collectDistinct(rows, field) {
        rows = QueryUtils._sortRows(rows, [ field ]);
        return QueryUtils._aggregate(rows, field, QueryUtils._isNullOrEmpty,
            (arr, val) => {
                if (arr.length === 0 || QueryUtils.compareFieldValues(
                    val, arr[arr.length - 1])) {
                    arr.push(val);
                }
                return arr;
            }, []);
    }

    static countDistinct(rows, field) {
        return QueryUtils.collectDistinct(rows, field).length;
    }

    //create array of arrays where each element array contains rows for
    //particular values of grouping fields
    static _groupBy(rows, fields) {
        const ret = [];
        for(let row of rows) {
            let found = false;
            //using hashtable may be more efficient but this is enough
            //for testing purposes (no need to use another 3rd party library)
            for(let group of ret) {
                if (!QueryUtils.compareRows(row, group[0], fields)) {
                    group.push(row);
                    found = true;
                    break;
                }
            }
            if (!found) {
                ret.push([ row ]);
            }
        }
        return ret;
    }

    //Each returned row contains grouping fields followed by aggregates
    //Use projectRows() on top of this function to project out fields or
    //change their order.
    //If aggrs == null, then this is DISTINCT instead of group by.
    //For group by without agggregates, use aggrs = [] instead.
    static groupBy(rows, fields, aggrs) {
        const res = [];
        const groups = QueryUtils._groupBy(rows, fields);
        for(let group of groups) {
            let row = QueryUtils.projectRow(group[0], fields);
            if (Object.values(row).includes(EMPTY_VALUE)) {
                //skip rows with empty grouping values per group by semantics
                if (aggrs != null) {
                    continue;
                }
                //for DISTINCT convert empty to null
                row = Object.fromEntries(Object.entries(row).map(ent =>
                    ent[1] === EMPTY_VALUE ? [ ent[0], undefined ] : ent));
            }
            if (aggrs != null) {
                for(let aggr of aggrs) {
                    row[aggr.as] = aggr.func(group, aggr.field);
                }
            }
            res.push(row);
        }
        //res records already have target property names
        fields = fields.map(fld => QueryUtils.fieldAs(fld));
        return QueryUtils.sortRows(res, ...fields);
    }

    static distinct(rows, fields) {
        return this.groupBy(rows, fields);
    }

    static geoDistance(p1, p2) {
        return getDistance({
            longitude: p1.coordinates[0],
            latitude: p1.coordinates[1]
        }, {
            longitude: p2.coordinates[0],
            latitude: p2.coordinates[1]
        });
    }

    static geoWithinDistance(rows, field, target, dist) {
        return rows.filter(row => {
            const val = QueryUtils.getFieldValue(row, field);
            return val != null && val !== EMPTY_VALUE &&
                QueryUtils.geoDistance(val, target) <= dist;
        });
    }

    static geoNear(rows, field, target, dist) {
        rows = QueryUtils.geoWithinDistance(rows, field, target, dist);
        return rows.sort((row1, row2) => {
            const d1 = QueryUtils.geoDistance(QueryUtils.getFieldValue(
                row1, field), target);
            const d2 = QueryUtils.geoDistance(QueryUtils.getFieldValue(
                row2, field), target);
            return d1 - d2;
        });
    }

    static geoDestination(src, dist, bearing) {
        const dp = computeDestinationPoint({
            longitude: src.coordinates[0],
            latitude: src.coordinates[1]
        }, dist, bearing);
        return {
            type: 'point',
            coordinates: [ dp.longitude, dp.latitude ]
        };
    }

    //LOJ of 2 tables
    static loj(alias1, rows1, alias2, rows2, fields) {
        //It seems that using O(n^2) algorithm is too slow for large sets of
        //rows (~10000), so we sort them first so that we can compute the
        //result in O(n).
        rows1 = QueryUtils._sortRows(rows1, fields);
        rows2 = QueryUtils._sortRows(rows2, fields);

        const res = [];
        let j = 0;
        for (const row1 of rows1) {
            let found = false;
            for(; j < rows2.length; j++) {
                const row2 = rows2[j];
                if (QueryUtils.compareRows(row1, row2, fields) === 0) {
                    found = true;
                    res.push({
                        [alias1]: row1,
                        [alias2]: row2
                    });
                } else if (found) {
                    //No more rows from rows2 match with row1's key, for next
                    //key we can start with the current value of j.
                    break;
                }
            }
            if (!found) {
                res.push({
                    [alias1]: row1,
                    [alias2]: undefined
                });
            }
        }

        return res;
    }
}

module.exports = QueryUtils;
