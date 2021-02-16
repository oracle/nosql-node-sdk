/*
 * Copyright (c) 2018, 2021 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

const assert = require('assert');

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

module.exports = MinHeap;
