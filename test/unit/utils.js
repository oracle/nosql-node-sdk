/*-
 * Copyright (c) 2018, 2020 Oracle and/or its affiliates.  All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const chai = require('chai');
chai.use(require('chai-as-promised'));

const expect = require('chai').expect;
const _ = require('lodash');

const util = require('util');
const fs = require('fs');
const Path = require('path');
const ServiceType = require('../../index').ServiceType;
const TableState = require('../../index').TableState;
const EMPTY_VALUE = require('../../lib/constants').EMPTY_VALUE;
const isPosInt32OrZero = require('../../lib/utils').isPosInt32OrZero;
const isPosInt = require('../../lib/utils').isPosInt;
const Consistency = require('../../index').Consistency;
const TTLUtil = require('../../index').TTLUtil;
const TestConfig = require('../utils').TestConfig;

//Symbols for hidden row object keys used by the tests
const _id = Symbol('id');
const _version = Symbol('version');
const _putTime = Symbol('putTime');
const _ttl = Symbol('ttl');
const _originalTTL = Symbol('originalTTL');

//Maximum accuracy of normalized binary single precision floating point number
const FLOAT_DELTA = Math.pow(2, -24);
const DOUBLE_DELTA = Math.pow(2, -52);

const NOSQL_CONFIG_ARG = '--nosql-config';

const DEFAULT_TIMEOUT = 120000;

let NumberUtils;

class Utils {

    static getArgVal(arg, def) {
        let val = def;
        for(let i = 2; i < process.argv.length; i++) {
            if (process.argv[i] === arg && i < process.argv.length - 1) {
                val = process.argv[i + 1];
                break;
            }
        }
        return val;
    }

    static get config() {
        if (this._config) {
            return this._config;
        }
        const config = this.getArgVal(NOSQL_CONFIG_ARG);
        return this._config = TestConfig.getConfigObj(config);
    }

    static get isOnPrem() {
        return Utils.config.serviceType === ServiceType.KVSTORE;
    }

    static get isSecureOnPrem() {
        return Utils.isOnPrem &&
        Utils.config.auth != null &&
        Utils.config.auth.kvstore != null &&
        (Utils.config.auth.kvstore.user ||
        Utils.config.auth.kvstore.credentials);
    }

    static get isCloudSim() {
        return Utils.config.serviceType === ServiceType.CLOUDSIM;
    }

    static get isCloud() {
        return Utils.config.serviceType === ServiceType.CLOUD;
    }

    static log() {
        if (this._printDebug == null) {
            this._printDebug = this.getArgVal('--print-debug');
        }
        if (this._printDebug) {
            console.log(...arguments);
        }
    }

    //When testing with cloud service or on-prem with rep-factor > 1
    //we may have failures if we are using eventual consistency and the
    //record is retrieved from the replica (e.g. version Buffer may be
    //different).  In this case the tests should only use absolute
    //consistency, which can be indicated by setting it in the initial config.
    static get testEventualConsistency() {
        if (typeof Utils.config.consistency === 'string') {
            return Utils.config.consistency.toUpperCase() !== 'ABSOLUTE';
        }
        return Utils.config.consistency !== Consistency.ABSOLUTE;
    }

    static sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    static deepCopy(obj) {
        //cloneDeep has a bug in that it doesn't actually clone Buffers.
        return _.cloneDeepWith(obj, val => {
            if (Buffer.isBuffer(val)) {
                return _.clone(val);
            }
        });
    }

    static rimrafSync(path) {
        if (!fs.existsSync(path)) {
            return;
        }
        if (fs.lstatSync(path).isDirectory()) {
            const ents = fs.readdirSync(path);
            for(let ent of ents) {
                Utils.rimrafSync(Path.join(path, ent));
            }
            fs.rmdirSync(path);
        } else {
            fs.unlinkSync(path);
        }
    }

    static moduleExists(path) {
        try {
            require.resolve(path);
            return true;
        } catch(err) {
            return false;
        }
    }

    static ttl2string(ttl) {
        return ttl.days ? `${ttl.days} DAYS` : `${ttl.hours} HOURS`;
    }

    static map2object(map) {
        const obj = {};
        for(let [key, val] of map) {
            expect(key).to.be.a('string');
            obj[key] = val;
        }
        return obj;
    }

    //Server returns date strings in ISO8601 format in UTC but without
    //trailing 'Z'
    static date2string(d) {
        const s = d.toISOString();
        return s.endsWith('Z') ? s.substring(0, s.length - 1) : s;
    }

    //Extract binary mantissa and exponent
    static numberParts(val) {
        const ret = { e: val ? Math.floor(Math.log2(Math.abs(val))) : 0 };
        ret.m = val / Math.pow(2, ret.e);
        return ret;
    }

    static projectRow(row, fields) {
        //each field can be either a string or an object of the form
        //{ name: fieldName, as: alias } to allow aliases
        const pRow = {};
        fields.forEach(fld => {
            if(typeof fld === 'object') {
                pRow[fld.as] = row[fld.name];
            } else {
                pRow[fld] = row[fld];
            }
        });
        return pRow;
    }

    static makeNullRow(tbl) {
        const ret =  Object.fromEntries(tbl.fields.map(f =>
            [ f.name, undefined ]));
        //this row will be used to construct expected row, so we do not
        //include identity columns
        if (tbl.idFld) { 
            delete ret[tbl.idFld.name];
        }
        return ret;
    }

    static makeCreateTable(tbl, ifNotExists) {
        const flds = tbl.fields.map(f =>
            `${f.name} ${f.typeSpec ? f.typeSpec : f.type}`).join(', ');
        
        let pk;
        if (!tbl.shardKeyLength) {
            pk = tbl.primaryKey.join(', ');    
        } else {
            const sk = tbl.primaryKey.slice(0, tbl.shardKeyLength).join(', ');
            const pk2 = tbl.primaryKey.slice(tbl.shardKeyLength,
                tbl.primaryKey.length).join(', ');
            pk = `SHARD(${sk}), ${pk2}`;
        }
        ifNotExists = ifNotExists ? 'IF NOT EXISTS ' : '';
        return `CREATE TABLE ${ifNotExists}${tbl.name}(${flds}, \
PRIMARY KEY(${pk}))` + (tbl.ttl ? ' USING TTL ' + this.ttl2string(tbl.ttl) :
            '');
    }

    static makeDropTable(tbl, ifExists) {
        ifExists = ifExists ? 'IF EXISTS ' : '';
        return `DROP TABLE ${ifExists}${tbl.name}`;
    }

    static makeCreateIndex(tbl, idx) {
        const flds = idx.fields.join(', ');
        return `CREATE INDEX ${idx.name} ON ${tbl.name}(${flds})`;
    }

    static makeDropIndex(tbl, idx) {
        return `DROP INDEX ${idx.name} ON ${tbl.name}`;
    }

    static makeAddField(tbl, fld) {
        return `ALTER TABLE ${tbl.name} (ADD ${fld.name} \
${fld.typeSpec ? fld.typeSpec : fld.type})`;
    }

    static makeDropField(tbl, fld) {
        return `ALTER TABLE ${tbl.name} (DROP ${fld.name})`;
    }

    static makeAlterTTL(tbl, ttl) {
        return `ALTER TABLE ${tbl.name} USING TTL ${this.ttl2string(ttl)}`;
    }

    static makePrimaryKey(tbl, row) {
        const pk = { [_id]: row[_id] };
        tbl.primaryKey.forEach(k => {
            expect(k in row).to.equal(true);
            pk[k] = row[k];
        });
        return pk;
    }

    static verifyJSON(val, val0) {
        //test self-check since SQL NULLs should already be handled
        expect(val0).to.not.equal(undefined);
        if (val0 === null) { //JSON NULL
            return expect(val).to.be.null;
        }
        if (val0 instanceof Date) {
            val0 = Utils.date2string(val0);
        }
        expect(typeof val).to.equal(typeof val0);
        if ([ 'string', 'boolean', 'number' ].includes(typeof val)) {
            return expect(val).to.equal(val0);
        }
        expect(typeof val).to.equal('object');
        if (Array.isArray(val0)) {
            expect(val).to.be.an('array');
            expect(val.length).to.equal(val0.length);
            for(let i = 0; i < val.length; i++) {
                Utils.verifyJSON(val[i], val0[i]);
            }
            return;
        }
        expect(Object.keys(val).sort()).to.deep.equal(
            Object.keys(val0).sort());
        for(let k in val) {
            Utils.verifyJSON(val[k], val0[k]);
        }
    }

    static verifyRecord(rec, rec0, fields) {
        expect(rec).to.be.an('object');
        expect(Object.keys(rec).length).to.be.at.most(fields.length);
        expect(rec0).to.be.an('object');
        //verify field order
        expect(Object.keys(rec)).to.deep.equal(Object.keys(rec0));
        //verify field values
        for(let f of fields) {
            if (f.isId) {
                continue;
            }
            if (!(f.name in rec0)) {
                expect(rec).to.not.have.property(f.name);
                continue;
            }
            expect(rec).to.have.property(f.name);
            this.verifyFieldValue(rec[f.name], rec0[f.name], f.type);
        }
    }

    static verifyFP(val, val0, delta) {
        //expect(val).to.equal(val0); - will fail
        expect(val).to.be.a('number');
        expect(val0).to.be.a('number');
        if (Number.isFinite(val0)) {
            const p = this.numberParts(val);
            const p0 = this.numberParts(val0);
            expect(p.e).to.equal(p0.e);
            expect(p.m).to.be.closeTo(p0.m, delta);
        } else {
            expect(val).to.deep.equal(val0);
        }
    }

    static verifyFloat(val, val0) {
        this.verifyFP(val, val0, FLOAT_DELTA);
    }

    static verifyDouble(val, val0) {
        this.verifyFP(val, val0, DOUBLE_DELTA);
    }

    static verifyNumber(val, val0, info) {
        if (!NumberUtils) {
            NumberUtils = require('./number_utils');
        }
        NumberUtils.verifyNumber(val, val0, info);
    }

    //Check the value returned from the server.  It should be of correct type
    //and equal to the value we sent to the server (after being properly type
    //converted)  The equality may not be exact for types Double and Float.
    //val - the value received from the server
    //val0 - the value initially sent to the server
    static verifyFieldValue(val, val0, type) {
        expect(type).to.exist; //test self-check
        if (val0 === undefined || val0 === EMPTY_VALUE) {
            //It is possible for expected advanced query results contain
            //EMPTY_VALUE, which sould become SQL NULL in actual query
            //results.
            return expect(val).to.be.undefined; //SQL NULL
        }
        if (typeof type === 'string') {
            type = { name: type };
        }
        switch(type.name) {
        case 'BOOLEAN':
            expect(val).to.be.a('boolean');
            return expect(val).to.equal(!!val0);
        case 'TIMESTAMP':
            expect(val).to.be.instanceOf(Date);
            return expect(val.getTime()).to.equal((val0 instanceof Date ?
                val0 : new Date(val0)).getTime());
        case 'FLOAT':
            return this.verifyFloat(val, val0);
        case 'DOUBLE':
            return this.verifyDouble(val, val0);
        case 'NUMBER':
            return this.verifyNumber(val, val0, type);
        case 'JSON':
            return this.verifyJSON(val, val0);
        case 'ARRAY':
            expect(val).to.be.an('array');
            expect(val0).to.be.an('array');
            expect(val.length).to.equal(val0.length);
            val.forEach((v, i) => {
                this.verifyFieldValue(v, val0[i], type.elemType);
            });
            return;
        case 'MAP': {
            expect(val).to.be.an('object');
            if (val0 instanceof Map) {
                val0 = this.map2object(val0);
            }
            const ents0 = Object.entries(val0);
            expect(Object.keys(val).length).to.equal(ents0.length);
            for(let [k, v] of ents0) {
                this.verifyFieldValue(val[k], v, type.elemType);
            }
            return;
        }
        case 'RECORD':
            return this.verifyRecord(val, val0, type.fields);
        default:
            return expect(val).to.deep.equal(val0);
        }
    }

    //Check the row returned from the server.  It should have correct fields
    //and be equal to the value we sent to the server (after being properly type
    //converted).
    //row - the value received from the server
    //row0 - the value initially sent to the server
    //fields - for queries, we may have projections with aliases and
    //expressions so expected fields will be different from orininal fields
    //in the table; the query test needs to specify result fields if
    //using aliases or expressions
    static verifyRow(row, row0, tbl, fields) {
        if (tbl.idFld) {
            //Skip verification of id column since its expected value is not
            //known here.  It will be verified in verifyPut().
            row = Object.assign({}, row);
            delete row[tbl.idFld.name];
        }
        this.verifyRecord(row, row0, fields ? fields : tbl.fields);
    }

    static verifyTableResult(res, tbl, opt) {
        expect(res).to.be.an('object');
        expect(res.tableName).to.equal(tbl.name);
        expect(res.tableState).to.be.an.instanceOf(TableState);
        if (opt && opt._state) {
            expect(res.tableState).to.equal(opt._state);
        }
        if (Utils.isOnPrem) {
            expect(res.tableLimits).to.not.exist;
        } else {
            if (!opt || !opt._ignoreTableLimits) {
                const limits = opt && opt.tableLimits ?
                    opt.tableLimits : tbl.limits;
                expect(res.tableLimits).to.deep.equal(limits);
            }
        }
        if (!opt || !opt._verifySchema) {
            return;
        }
        let s;
        expect(() => s = JSON.parse(res.schema)).to.not.throw();
        if (!s) {
            return;
        }
        expect(s.name).to.equal(tbl.name);
        expect(s.limits).to.be.an('object');
        expect(s.limits.readLimit).to.equal(tbl.limits.readUnits);
        expect(s.limits.writeLimit).to.equal(tbl.limits.writeUnits);
        expect(s.limits.sizeLimit).to.equal(tbl.limits.storageGB);
        expect(s.primaryKey).to.deep.equal(tbl.primaryKey);
        expect(s.fields).to.be.an('array');
        expect(s.fields.map(f => ({ name: f.name, type: f.type }))).to
            .deep.equal(tbl.fields);
        if (tbl.indexes && tbl.indexes.length) {
            expect(s.indexes).to.be.an('array');
            expect(s.indexes.map(idx => ({ name: idx.name, fields: idx.fields})))
                .to.deep.equal(tbl.indexes);
        } else if (s.indexes) {
            expect(s.indexes).to.be.an('array');
            expect(s.indexes.length).to.equal(0);
        }
        if (tbl.ttl) {
            expect(s.ttl).to.equal(tbl.ttl);
        }
    }

    static verifyActiveTable(res, tbl, opt) {
        if (!opt) {
            opt = {};
        }
        this.verifyTableResult(res, tbl, Object.assign({}, opt, {
            _state: TableState.ACTIVE,
            _veritySchema: true
        }));
    }

    static verifyConsumedCapacity(cc) {
        if (!Utils.isOnPrem) {
            expect(cc).to.be.an('object');
            expect(cc.readKB).to.satisfy(isPosInt32OrZero);
            expect(cc.readUnits).to.satisfy(isPosInt32OrZero);
            expect(cc.writeKB).to.satisfy(isPosInt32OrZero);
            expect(cc.writeUnits).to.satisfy(isPosInt32OrZero);

            if (Utils.config.rateLimiter != null) {
                if (cc.readUnits > 0 || cc.readRateLimitDelay != null) {
                    expect(cc.readRateLimitDelay).to.be.at.least(0);
                }
                if (cc.writeUnits > 0 || cc.writeRateLimitDelay != null) {
                    expect(cc.writeRateLimitDelay).to.be.at.least(0);
                }
            }
        } else {
            expect(cc).to.not.exist;
        }
    }

    //We assume that if row[_ttl] doesn't exist, then the row's TTL is table
    //default TTL, or if table does not have default TTL, then the row
    //does not expire.  If table has default TTL but we want the row not to
    //expire, we must have row[_ttl] = TTLUtil.DO_NOT_EXPIRE (days = Infinity)
    static verifyExpirationTime(tbl, row, expirationTime) {
        const ttl = row[_ttl] ? row[_ttl] : tbl.ttl;
        if (!ttl || TTLUtil.toDays(ttl) === Infinity) {
            expect(expirationTime).to.not.exist;
        } else {
            expect(row[_putTime]).to.be.instanceOf(Date); //test verification
            expect(expirationTime).to.be.instanceOf(Date);
            expect(expirationTime.getTime()).to.satisfy(isPosInt);
            const expectedTTL = TTLUtil.fromExpirationTime(expirationTime,
                row[_putTime], ttl.hours);
            let diff;
            //Here we also verify the result of TTLUtil.fromExpirationTime()
            if (ttl.hours) {
                expect(expectedTTL.hours).to.satisfy(isPosInt);
                expect(expectedTTL.days).to.not.exist;
                diff = expectedTTL.hours - ttl.hours;
            } else {
                expect(expectedTTL.days).to.satisfy(isPosInt);
                expect(expectedTTL.hours).to.not.exist;
                diff = expectedTTL.days - ttl.days;
            }
            //For now allow to differ +- 1 days or hours.  We can make it more
            //precise by considering whether the put time is within certain
            //threshold of hour or day boundary
            expect(Math.abs(diff)).to.be.at.most(1);
        }
    }

    static verifyGetResult(res, tbl, row, opt) {
        if (!opt) {
            opt = {};
        }
        expect(res).to.be.an('object');
        this.verifyConsumedCapacity(res.consumedCapacity);
        if (!Utils.isOnPrem) {
            expect(res.consumedCapacity.writeKB).to.equal(0);
            expect(res.consumedCapacity.writeUnits).to.equal(0);
            expect(res.consumedCapacity.readKB).to.be.at.least(1);
            expect(res.consumedCapacity.readUnits).to.be.at.least(
                opt.consistency === Consistency.ABSOLUTE ? 2 : 1);
        }
        if (!row) {
            expect(res.row).to.equal(null);
            expect(res.expirationTime).to.not.exist;
            expect(res.version).to.not.exist;
            return;
        }
        this.verifyExpirationTime(tbl, row, res.expirationTime);
        expect(res.version).to.be.instanceOf(Buffer);
        //For update queries (unlike puts) we don't know the row's
        //current version.
        if (!opt._skipVerifyVersion) {
            expect(res.version).to.deep.equal(row[_version]);
        }
        this.verifyRow(res.row, row, tbl);
    }

    //existingRow argument is to verify returned existing row when
    //putIfAbsent or putIfVersion fails
    //isSub - whether this is a sub-operation of writeMany
    static async verifyPut(res, client, tbl, row, opt, success = true,
        existingRow, isSub) {
        if (!opt) {
            opt = {};
        }

        expect(res).to.be.an('object');
        
        if (!isSub) {
            this.verifyConsumedCapacity(res.consumedCapacity);
            if (!Utils.isOnPrem) {
                if (success) {
                    expect(res.consumedCapacity.writeKB).to.be.at.least(1);
                    expect(res.consumedCapacity.writeUnits).to.be.at.least(1);
                } else {
                    expect(res.consumedCapacity.writeKB).to.equal(0);
                    expect(res.consumedCapacity.writeUnits).equal(0);
                }
                if (opt.ifAbsent || opt.ifPresent || opt.matchVersion) {
                    expect(res.consumedCapacity.readKB).to.be.at.least(1);
                    expect(res.consumedCapacity.readUnits).to.be.at.least(1);
                } else {
                    expect(res.consumedCapacity.readKB).to.equal(0);
                    expect(res.consumedCapacity.readUnits).equal(0);
                }
            }
        }

        expect(res.success).to.equal(success);
        if (res.success) {
            expect(res.version).to.be.instanceOf(Buffer);
            expect(res.version).to.not.deep.equal(row[_version]);
            expect(res.existingRow).to.not.exist;
            expect(res.existingVersion).to.not.exist;
            /*
            if (tbl.idFld) {
                //We expect id value only for new rows (_version is null).
                //Here we assume that identity column is "GENERATED ALWAYS",
                //so the generated value should be present for new puts.
                expect(res.generatedValue != null).to.equal(
                    row[_version] == null);
            }*/
            row[_version] = res.version;
            //We update put time if ttl is indicated in options or if this is
            //new row, in this case unless opt.ttl is set, the row's ttl will
            //become undefined and only table ttl, if any, would be used for
            //verification.
            if (opt.ttl || opt.updateTTLToDefault || !row[_putTime]) {
                row[_ttl] = opt.ttl;
                row[_putTime] = new Date();
            }
        } else {
            expect(res.version).to.not.exist;
            //expect(res.generatedValue).to.not.exist;
            if (opt.returnExisting && existingRow) {
                this.verifyRow(res.existingRow, existingRow, tbl);
                expect(res.existingVersion).to.be.instanceOf(Buffer);
                if (opt.ifAbsent) {
                    expect(res.existingVersion).to.deep.equal(row[_version]);
                } else if (opt.matchVersion) {
                    expect(res.existingVersion).to.deep.equal(
                        existingRow[_version]);
                }
            } else {
                expect(res.existingRow).to.not.exist;
                expect(res.existingVersion).to.not.exist;    
            }
        }

        //This will verify that we get the same row as we put, including its
        //version and expiration time
        const getRes = await client.get(tbl.name, this.makePrimaryKey(
            tbl, row));
        this.verifyGetResult(getRes, tbl, success ? row : existingRow);
        if (success && res.generatedValue != null) {
            expect(tbl.idFld).to.exist; //test self-check
            expect(getRes.row).to.exist;
            this.verifyFieldValue(res.generatedValue,
                getRes.row[tbl.idFld.name], tbl.idFld.type);
        }
    }

    //existingRow argument is to verify returned existing row when
    //deleteIfVersion fails
    static async verifyDelete(res, client, tbl, key, opt, success = true,
        existingRow, isSub) {
        if (!opt) {
            opt = {};
        }

        expect(res).to.be.an('object');
        
        if (!isSub) {
            Utils.verifyConsumedCapacity(res.consumedCapacity);
            if (!Utils.isOnPrem) {
                expect(res.consumedCapacity.readKB).to.be.at.least(1);
                expect(res.consumedCapacity.readUnits).to.be.at.least(1);
                if (success) {
                    expect(res.consumedCapacity.writeKB).to.be.at.least(1);
                    expect(res.consumedCapacity.writeUnits).to.be.at.least(1);
                } else {
                    expect(res.consumedCapacity.writeKB).to.equal(0);
                    expect(res.consumedCapacity.writeUnits).equal(0);
                }
            }
        }
        
        expect(res.success).to.equal(success);
        if (!res.success && opt.matchVersion && opt.returnExisting &&
            existingRow) {
            this.verifyRow(res.existingRow, existingRow, tbl);
            expect(res.existingVersion).to.deep.equal(existingRow[_version]);
        } else {
            expect(res.existingRow).to.not.exist;
            expect(res.existingVersion).to.not.exist;
        }

        //This will verify that row does not exist after successful delete
        //or delete on non-existent row, or that the row is the same as
        //existingRow if deleteIfVersion fails on existing row
        const getRes = await client.get(tbl.name, key);
        Utils.verifyGetResult(getRes, tbl, success ? null : existingRow);
    }

    static async createTable(client, tbl, indexes) {
        const sql = this.makeCreateTable(tbl, true);
        let res = await client.tableDDL(sql, { tableLimits: tbl.limits });
        await client.forCompletion(res);
        
        if (indexes) {
            for(let idx of indexes) {
                await this.createIndex(client, tbl, idx);
            }
        }
    }

    static async dropTable(client, tbl) {
        const sql = this.makeDropTable(tbl, true);
        let res = await client.tableDDL(sql);
        await client.forCompletion(res);
    }

    static async createIndex(client, tbl, idx) {
        const sql = this.makeCreateIndex(tbl, idx);
        let res = await client.tableDDL(sql);
        await client.forCompletion(res);
    }

    //Put row exactly as specified by row object including row[_ttl],
    //update version and row[_putTime].  This should completely overwrite
    //any existing row with the same primary key.
    static async putRow(client, tbl, row) {
        let opt = {};
        if (row[_ttl]) {
            opt.ttl = row[_ttl];
        } else if (tbl.ttl) {
            opt.updateTTLToDefault = true;
        } else {
            opt.ttl = TTLUtil.DO_NOT_EXPIRE;
        }
        let res = await client.put(tbl.name, row, opt);
        expect(res.success).to.equal(true);
        row[_putTime] = new Date();
        row[_version] = res.version;
    }

    static async deleteRow(client, tbl, row) {
        await client.delete(tbl.name, Utils.makePrimaryKey(tbl, row));
        delete row[_version];
        delete row[_putTime];
    }

    static runSequential(desc, testFunc, tests) {
        describe(`Running ${desc} using configuration \
${util.inspect(Utils.config)}`,
        function() {
            this.timeout(DEFAULT_TIMEOUT);
            before(async function() {
                if (client._doAsyncInit) {
                    await client._doAsyncInit();
                }
            });
            after(function() {
                client.close();
            });
            //This line has to be executed before the tests are created so
            //we can't put it into the "before" block
            const client = TestConfig.createNoSQLClientNoInit(
                Utils.config);
            tests.forEach(test => testFunc(client, test));
            //Mocha will not run before/after hooks unless at least one
            //"it" block is present within the "describe".  Seems like a
            //bug to me. Workaround is to add a fake test here.
            it('', () => {});
        });
    }

}

Utils.range = _.range;

Utils._id = _id;
Utils._ttl = _ttl;
Utils._putTime = _putTime;
Utils._version = _version;
Utils._originalTTL = _originalTTL;

module.exports = Utils;
