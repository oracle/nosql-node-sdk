/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const readline = require('readline');
const NoSQLArgumentError = require('./error').NoSQLArgumentError;

//Test if integer is 32 bit signed integer.
function isInt32(n) {
    return (n & 0xFFFFFFFF) == n;
}

function isPosInt(val) {
    return Number.isSafeInteger(val) && val > 0;
}

function isPosIntOrZero(val) {
    return Number.isSafeInteger(val) && val >= 0;
}

function isPosInt32(val) {
    return isPosInt(val) && isInt32(val);
}

function isPosInt32OrZero(val) {
    return isPosIntOrZero(val) && isInt32(val);
}

function isPlainObject(val) {
    if (val == null || typeof val !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(val);
    return proto === Object.prototype || !proto;
}

function promisified(context, method, ...args) {
    return new Promise((resolve, reject) => {
        method.call(context, ...args, (err, res) => {
            if (err) {
                return reject(err);
            }
            return resolve(res);
        });
    });
}

function mapToObj(map) {
    const obj = {};
    for(let [key, val] of map) {
        assert(typeof key === 'string');
        obj[key] = val;
    }
    return obj;
}

//Server seems to send the timestamp in the ISO format, but without
//the ending 'Z', so we add it here.  This may need more work if different
//formats are used.
function stringToUTCDate(s) {
    if (!s.endsWith('Z')) {
        s += 'Z';
    }
    return new Date(s);
}

//Nested property by string
function propertyByString(obj, prop) {
    if (!prop) {
        return obj;
    }
    prop = prop.split('.');
    let val = obj;
    for(let p of prop) {        
        if (val == null) {
            return val; //null or undefined
        }
        val = val[p];
    }
    return val;
}

const HttpConstants = {
    POST: 'POST',
    GET: 'GET',
    DELETE: 'DELETE',
    PUT: 'PUT',
    CONTENT_TYPE: 'Content-Type',
    APPLICATION_JSON: 'application/json; charset=UTF-8',
    CONNECTION: 'Connection',
    ACCEPT: 'Accept',
    AUTHORIZATION: 'Authorization',
    CONTENT_LENGTH: 'Content-Length',
    CACHE_CONTROL: 'cache-control',
    HOST: 'host',
    DATE: 'date',
    REQUEST_ID: 'x-nosql-request-id',
    DATA_PATH_NAME: 'data',
    NOSQL_VERSION: 'V2',
    NOSQL_PATH_NAME: 'nosql',
    COMPARTMENT_ID: 'x-nosql-compartment-id',
    REQUEST_TARGET: '(request-target)',
    HTTP_OK: 200,
    HTTP_BAD_REQUEST: 400,
    HTTP_UNAUTHORIZED: 401,
    HTTP_NOT_FOUND: 404,
    HTTP_CONFLICT: 409,
    HTTP_SERVER_ERROR: 500,
    HTTP_UNAVAILABLE: 503
};

HttpConstants.NOSQL_PREFIX = HttpConstants.NOSQL_VERSION + '/' +
    HttpConstants.NOSQL_PATH_NAME;
HttpConstants.NOSQL_DATA_PATH = HttpConstants.NOSQL_PREFIX + '/' +
    HttpConstants.DATA_PATH_NAME;

//One-liner to clear multiple data
function clearData(...args) {
    for(let arg of args) {
        if (Buffer.isBuffer(arg) || Array.isArray(arg)) {
            arg.fill(0);
        } else if (arg && typeof arg === 'object') {
            clearData(...Object.values(arg));
        }
    }
}

//asynchronous sleep
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function _processProfileLine(line, callback) {
    line = line.trim();
    if (!line.length || line[0] === '#') {
        return;
    }
    if (line[0] === '[' && line[line.length - 1] === ']') {
        line = line.substring(1, line.length - 1);
        if (this.profile == null && line === this.profileName) {
            this.profile = {};
        } else if (this.profile != null) {
            //finished reading the profile, don't need to read the rest
            this.finished = true;
            callback();
        }
        return;
    }
    if (this.profile == null || this.finished) {
        return;
    }
    let i = line.indexOf('=');
    if (i == -1) {
        return callback(new NoSQLArgumentError(`Invalid line in config \
file ${this.configFile} (no key-value): ${line}`));
    }
    const key = line.substring(0, i).trim();
    if (!key.length) {
        return callback(new NoSQLArgumentError(`Invalid line in config \
file ${this.configFile} (empty key): ${line}`));
    }
    this.profile[key] = line.substring(i + 1).trim();
}

function _readProfile(configFile, profileName, callback) {
    const input = fs.createReadStream(configFile).on('error',
        err => callback(err));
    const ri = readline.createInterface({ input });
    const ctx = {
        profileName,
        _processProfileLine
    };
    ri.on('line', line => ctx._processProfileLine(line, err => {
        if (err) {
            return callback(err);
        }
        ri.close();
        //we are not interested in any more events
        ri.removeAllListeners();
        //ri.close() will relinguish the stream so we need to
        //destroy it explicitly
        input.destroy();
    }));
    ri.on('close', () => { callback(null, ctx.profile); });
    ri.on('error', err => callback(err));
}

//read section of an ini file
function readProfile(configFile, profileName) {
    return promisified(null, _readProfile, configFile, profileName);
}

function readProfileSync(configFile, profileName) {
    let data = fs.readFileSync(configFile, 'utf8');
    const ctx = {
        profileName,
        _processProfileLine
    };
    data = data.split(/\r\n|\r|\n/);
    for(let line of data) {
        ctx._processProfileLine(line, (err) => {
            if (err) {
                throw err;
            }
        });
        if (ctx.finished) {
            break;
        }
    }
    return ctx.profile;
}

//Use hasOwnProperty(obj, prop) instead of obj.hasOwnProperty(prop)
//because plain obj could be created with no prototype
const hasOwnProperty = Function.prototype.call.bind(
    Object.prototype.hasOwnProperty);

module.exports = {
    isInt32,
    isPosInt,
    isPosIntOrZero,
    isPosInt32,
    isPosInt32OrZero,
    isPlainObject,
    promisified,
    mapToObj,
    stringToUTCDate,
    propertyByString,
    HttpConstants,
    clearData,
    sleep,
    readProfile,
    readProfileSync,
    hasOwnProperty
};
