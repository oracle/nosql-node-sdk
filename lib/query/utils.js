/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const assert = require('assert');
const util = require('util');

class MinHeap {
    
    constructor(cmp, arr) {
        this._cmp = cmp;
        if (arr) {
            this._a = arr;
            this._build();
        } else {
            this._a = [];
        }
    }

    _parent(i) {
        return Math.floor((i - 1) / 2);
    }

    _left(i) {
        return 2 * i + 1;
    }

    _right(i) {
        return 2 * i + 2;
    }

    _comp(i, j) {
        return this._cmp(this._a[i], this._a[j]);
    }

    _swap(i, j) {
        const val = this._a[i];
        this._a[i] = this._a[j];
        this._a[j] = val;
    }

    _filterDown(i) {
        for(;;) {
            const l = this._left(i);
            const r = this._right(i);
            let min = l < this.size && this._comp(l, i) < 0 ? l : i;
            if (r < this.size && this._comp(r, min) < 0) {
                min = r;
            }
            if (i === min) {
                break;
            }
            this._swap(i, min);
            i = min;
        }
    }

    _filterUp(i) {
        while(i > 0) {
            let p = this._parent(i);
            if (this._comp(p, i) <= 0) {
                break;
            }
            this._swap(i, p);
            i = p;
        }
    }

    _build() {
        for(let i = Math.floor(this.size / 2); i >= 0; i--) {
            this._filterDown(i);
        }
    }

    _remove(i) {
        assert(i < this._a.length);
        this._a[i] = this._a.pop();
        if (!i || this._comp(this._parent(i), i) < 0) {
            this._filterDown(i);
        } else {
            this._filterUp(i);
        }
    }

    get size() {
        return this._a.length;
    }

    peek() {
        return this._a[0];
    }

    pop() {
        if (!this._a.length) {
            return;
        }
        const min = this._a[0];
        const last = this._a.pop();
        if (this._a.length) {
            this._a[0] = last;
            this._filterDown(0);
        }
        return min;
    }

    add(val) {
        this._a.push(val);
        this._filterUp(this._a.length - 1);
    }

    filter(cb) {
        return new MinHeap(this._cmp, this._a.filter(cb));
    }

}

function _isAtomic(val) {
    return typeof val === 'number' || typeof val === 'string' ||
        typeof val === 'boolean' || (typeof val === 'object' &&
        val instanceof Date || Buffer.isBuffer(val));
}

function _notAtomic(ctx, val) {
    throw ctx.illegalState(`Value is not atomic: ${util.inspect(val)}`);
}

function atomicsEqual(ctx, val1, val2) {
    if (val1 === null) {
        return val2 === null;
    }
    switch(typeof val1) {
    case 'number':
        if (typeof val2 === 'number') {
            return val1 === val2;
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val2)) {
            return ctx._dbNumber.valuesEqual(val2, val1);
        }
        break;
    case 'string': case 'boolean':
        if (typeof val1 === typeof val2) {
            return val1 === val2;
        }
        break;
    case 'object':
        if (val1 instanceof Date) {
            if (val2 instanceof Date) {
                return val1.getTime() === val2.getTime();
            }
            break;
        }
        if (Buffer.isBuffer(val1)) {
            if (Buffer.isBuffer(val2)) {
                return val1.equals(val2);
            }
            break;
        }
        if (ctx._dbNumber != null && ctx._dbNumber.isInstance(val1)) {
            if (ctx._dbNumber.isInstance(val2) || typeof val2 === 'number') {
                return ctx._dbNumber.valuesEqual(val1, val2);
            }
            break;
        }
    default:
        throw _notAtomic(ctx, val1);
    }
    if (!_isAtomic(val2)) {
        throw _notAtomic(ctx, val2);
    }
    return false;
}

function sizeof(ctx, val) {
    if (val == null) {
        return 0;
    }
    switch(typeof val) {
    case 'boolean':
        return 4;
    case 'number':
        return 8;
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

module.exports = {
    MinHeap,
    atomicsEqual,
    sizeof
};
