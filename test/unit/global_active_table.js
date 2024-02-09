/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const expect = require('chai').expect;
const util = require('util');
const compareVersions = require('compare-versions').compareVersions;

const NoSQLClient = require('../../index').NoSQLClient;
const Region = require('../../index').Region;
const ErrorCode = require('../../index').ErrorCode;
const NoSQLError = require('../../index').NoSQLError;
const NoSQLArgumentError = require('../../index').NoSQLArgumentError;
const NoSQLTimeoutError = require('../../index').NoSQLTimeoutError;
const CapacityMode = require('../../index').CapacityMode;
const TableState = require('../../index').TableState;
const isPosInt32 = require('../../lib/utils').isPosInt32;
const isPosInt32OrZero = require('../../lib/utils').isPosInt32OrZero;
const badTblNames = require('./common').badTblNames;
const badMillis = require('./common').badMillis;
const badStrings = require('./common').badStrings;
const badPosInt32NotNull = require('./common').badPosInt32NotNull;
const badDateTimes = require('./common').badDateTimes;
const badNonNegInt32NotNull = require('./common').badNonNegInt32NotNull;
const badOptions = require('./common').badOptions;
const badModifyTableOpts = require('./common').badModifyTableOpts;
const badCompletionOpts = require('./common').badDDLForCompletionOpts;
const Utils = require('./utils');
const SIMPLE_TABLE = require('./test_schemas').SIMPLE_TABLE;

const compartment = Utils.config.compartment;

//Since badStrings does not include Region instances, ok to use this for now.
const badRegionsNotNull = badStrings;
const badRegions = [ undefined, null, ...badRegionsNotNull ];

const badAddReplicaOpts = [
    ...badModifyTableOpts,
    ...badPosInt32NotNull.map(readUnits => ({ readUnits })),
    ...badPosInt32NotNull.map(writeUnits => ({ writeUnits }))
];

const badReplicaStatsOpts = [
    ...badOptions,
    ...badMillis.map(timeout => ({ timeout })),
    ...badRegionsNotNull.map(region => ({ region })),
    ...badDateTimes.map(startTime => ({ startTime })),
    ...badNonNegInt32NotNull.map(limit => ({ limit }))
];

const LOCAL_REGION = Region.US_PHOENIX_1;

const REPLICAS = [
    {
        region: Region.US_ASHBURN_1
    },
    {
        region: Region.AP_MUMBAI_1,
        replicaName: 'ap-mumbai-1',
        createOpt: {
            writeUnits: 6,
            timeout: 20000
        },
        dropOpt: {
            complete: true
        }
    },
    {
        region: Region.UK_LONDON_1,
        createOpt: {
            writeUnits: 4,
            readUnits: 8
        },
        dropOpt: {
            timeout: 8000
        }
    },
    {
        region: Region.EU_FRANKFURT_1,
        replicaName: 'eu-frankfurt-1',
        createOpt: {
            compartment,
            delay: 1200,
            complete: true
        },
        toOnDemand: true,
    },
    {
        region: Region.AP_HYDERABAD_1,
        createOpt: {
            complete: true
        },
        dropOpt: {
            compartment,
            timeout: 120000,
            delay: 2000,
            complete: true
        },
        toOnDemand: true,
    }
];

function configForRegion(region) {
    return Object.assign({}, Utils.config, { region });
}

function testAddReplicaNegative(client, tbl) {
    for(let badTblName of badTblNames) {
        it(`addReplica with invalid table name: ${util.inspect(badTblName)}`,
            async function() {
                return expect(client.addReplica(badTblName,
                    REPLICAS[0].region)).to.be.rejectedWith(
                    NoSQLArgumentError);
            });
    }

    it('addReplica on non-existent table', async function() {
        return expect(client.addReplica('nosuchtable', REPLICAS[0].region))
            .to.eventually.be.rejected.and.satisfy(
                err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    for(let badRegion of badRegions) {
        it(`addReplica with invalid region: ${util.inspect(badRegion)}`,
            async function() {
                return expect(client.addReplica(tbl.name, badRegion))
                    .to.be.rejectedWith(NoSQLArgumentError);
            });
    }

    it('addReplica with non-existent region', async function() {
        return expect(client.addReplica(tbl.name, 'no-such-region-1'))
            .to.eventually.be.rejectedWith(NoSQLArgumentError);
    });

    for(let badOpt of badAddReplicaOpts) {
        it(`addReplica on ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.addReplica(tbl.name, REPLICAS[0].region,
                badOpt)).to.be.rejectedWith(NoSQLArgumentError);
        });
    }
}

function testDropReplicaNegative(client, tbl) {
    for(let badTblName of badTblNames) {
        it(`dropReplica with invalid table name: ${util.inspect(badTblName)}`,
            async function() {
                return expect(client.dropReplica(badTblName,
                    REPLICAS[0].region)).to.be.rejectedWith(
                    NoSQLArgumentError);
            });
    }

    it('dropReplica on non-existent table', async function() {
        return expect(client.dropReplica('nosuchtable', REPLICAS[0].region))
            .to.eventually.be.rejected.and.satisfy(
                err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    for(let badRegion of badRegions) {
        it(`dropReplica with invalid region: ${util.inspect(badRegion)}`,
            async function() {
                return expect(client.dropReplica(tbl.name, badRegion))
                    .to.be.rejectedWith(NoSQLArgumentError);
            });
    }

    it('dropReplica with non-existent region', async function() {
        return expect(client.dropReplica(tbl.name, 'no-such-region-1'))
            .to.eventually.be.rejectedWith(NoSQLArgumentError);
    });

    for(let badOpt of badModifyTableOpts) {
        it(`dropReplica on ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.dropReplica(tbl.name, REPLICAS[0].region,
                badOpt)).to.be.rejectedWith(NoSQLArgumentError);
        });
    }
}

function testGetReplicaStatsNegative(client, tbl) {
    for(let badTblName of badTblNames) {
        it(`getReplicaStats with invalid table name: \
${util.inspect(badTblName)}`, async function() {
            return expect(client.getReplicaStats(badTblName))
                .to.be.rejectedWith(NoSQLArgumentError);
        });
    }

    it('getReplicaStats on non-existent table', async function() {
        return expect(client.getReplicaStats('nosuchtable'))
            .to.eventually.be.rejected.and.satisfy(
                err => err instanceof NoSQLError &&
                err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    it('getReplicaStats with non-existent region', async function() {
        return expect(client.getReplicaStats(tbl.name, {
            region: 'no-such-region-1'
        })).to.eventually.be.rejectedWith(NoSQLArgumentError);
    });

    for(let badOpt of badReplicaStatsOpts) {
        it(`getReplicaStats on ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.getReplicaStats(tbl.name, badOpt))
                .to.be.rejectedWith(NoSQLArgumentError);
        });
    }
}

function verifyActiveRepTable(res, tbl, opt) {
    Utils.verifyActiveTable(res, tbl, opt);
    expect(res.isSchemaFrozen).to.equal(true);
    expect(res.isReplicated).to.equal(true);
    expect(res.isLocalReplicaInitialized).to.equal(true);
    expect(res.replicas).to.be.an('array');
    if (opt && opt._repCnt) {
        expect(res.replicas.length).to.equal(opt._repCnt);
    }
    if (opt && opt._tableOCID) {
        expect(res.tableOCID).to.equal(opt._tableOCID);
    }
}

//rep - element in REPLICAS array above
function verifyRepInfo(repInfo, tbl, rep, isOnDemand) {
    expect(repInfo).to.exist;
    const reg = Region.fromRegionId(repInfo.replicaName);
    expect(reg).to.exist;
    expect(repInfo.region).to.equal(reg);
    expect(repInfo.replicaOCID).to.be.a('string');
    expect(repInfo.capacityMode).to.be.instanceOf(CapacityMode);
    //whether the mode was changed to ON_DEMAND after replica creation
    expect(repInfo.capacityMode).to.equal(isOnDemand ?
        CapacityMode.ON_DEMAND : CapacityMode.PROVISIONED);
    
    if (isOnDemand) {
        expect(repInfo.writeUnits).to.be.a('number');
        expect(repInfo.writeUnits).to.satisfy(isPosInt32);
    } else {
        //whether specified different read/write units when creating replica
        expect(repInfo.writeUnits).to.equal(rep.writeUnits ?
            rep.writeUnits : tbl.limits.writeUnits);
    }

    expect(repInfo.state).to.equal(TableState.ACTIVE);
}

function verifyReplicaStatsResult(res, tbl, opt) {
    opt = opt || {};

    expect(res).to.be.an('object');
    expect(res.tableName).to.equal(tbl.name);
    expect(res.nextStartTime).to.be.an.instanceOf(Date);
    if (!opt._expEmptyResult) {
        //only check approximate bounds to verify the protocol
        expect(res.nextStartTime.getTime()).to.be.lessThanOrEqual(
            Date.now() + 61000);
        expect(res.nextStartTime.getTime()).to.be.greaterThan(
            Date.now() - 600000);
    }

    expect(res.statsRecords).to.be.an('object');

    if (!opt._expEmptyResult) {
        if (opt.region) {
            const replicaName = opt.region instanceof Region ?
                opt.region.regionId : opt.region;
            //This is only true if some time elapsed after the replica was
            //added, don't use for last elements of REPLICAS array.
            expect(res.statsRecords).to.have.all.keys(replicaName);
        } else {
            const replicaNames = REPLICAS.map(rep => rep.region.regionId);
            //It is possible that the replicas added last might not yet have
            //any stats entries, or when limit is specifed, newer replicas
            //may not have entries for same times as older replicas. For
            //simplicity, we only tests that entries for some regions should
            //be present.
            expect(res.statsRecords).to.have.any.keys(...replicaNames);
            expect(Object.keys(res.statsRecords)).to.satisfy(
                keys => keys.every(key => replicaNames.includes(key)));
        }
    }

    const startTime = typeof opt.startTime === 'string' ?
        Date.parse(startTime) : (opt.startTime instanceof Date ?
            opt.startTime.getTime() : opt.startTime);
    
    for(const key in res.statsRecords) {
        const statsRecords = res.statsRecords[key];
        expect(statsRecords).to.be.an('array');
        if (opt._expEmptyResult) {
            expect(statsRecords.length).to.equal(0);
            continue;
        }
        expect(statsRecords.length).to.be.greaterThan(0);
        if (opt.limit) {
            expect(statsRecords.length).to.be.lessThanOrEqual(opt.limit);
        }

        let collTime = 0;
        for(const rec of statsRecords) {
            expect(rec).to.be.an('object');
            expect(rec.collectionTime).to.be.instanceOf(Date);
            if (startTime != null) {
                expect(rec.collectionTime.getTime()).to.be.greaterThanOrEqual(
                    startTime);
            }
            expect(rec.collectionTime.getTime()).to.be.greaterThan(collTime);
            collTime = rec.collectionTime.getTime();

            expect(rec).to.have.any.keys('replicaLag');
            if (rec.replicaLag !== undefined) {
                expect(rec.replicaLag).to.be.a('number');
                expect(rec.replicaLag).to.satisfy(isPosInt32OrZero);
                expect(rec.replicaLag).to.satisfy(Number.isSafeInteger);
                //hopefully the lag won't exceed this value
                expect(rec.replicaLag).to.be.lessThan(3600000);
            }
        }
    }
}

function testAddReplica(clients, tbl, rep, resCnt) {
    it(`addReplica on table: ${tbl.name}, region: ${rep.region}`,
        async function() {
            const client = clients[LOCAL_REGION.regionId];

            let opt = rep.createOpt;
            let res = await client.addReplica(tbl.name, rep.replicaName ?
                rep.replicaName: rep.region, opt);

            opt = opt || {};
            if (!opt.complete) {
                Utils.verifyTableResult(res, tbl, opt);
                await client.forCompletion(res);
            }
            
            opt._repCnt = resCnt;
            verifyActiveRepTable(res, tbl, opt);
            const repInfo = res.replicas.find(
                r => r.replicaName === rep.region.regionId);
            verifyRepInfo(repInfo, tbl, rep);

            const repClient = clients[rep.region.regionId];
            
            //this is somewhat tenuous
            await expect(repClient.get(tbl.name, { id: 0 },
                { timeout: 3000 }))
                .to.eventually.be.rejected.and.satisfy(err =>
                    err instanceof NoSQLTimeoutError && err.cause &&
                err.cause.errorCode == ErrorCode.TABLE_NOT_READY);

            //Make sure the replica is initialized before we proceed with
            //other testcases.
            res = await repClient.forLocalReplicaInit(tbl.name);
            verifyActiveRepTable(res, tbl);

            //Verify that can read data after replica table is initialized.
            res = await repClient.get(tbl.name, { id: NUM_ROWS - 1 });
            expect(res).to.exist;
            expect(res.row).to.exist;
        });
}

function testDropReplica(client, tbl, rep, resCnt) {
    it(`dropReplica on table: ${tbl.name}, region: ${rep.region}`,
        async function() {
            let opt = rep.dropOpt;
            const res = await client.dropReplica(tbl.name, rep.replicaName ?
                rep.replicaName : rep.region, opt);

            opt = opt || {};
            if (!opt.complete) {
                Utils.verifyTableResult(res, tbl, opt);
                await client.forCompletion(res);
            }
            
            if (!resCnt) { //this was last replica dropped
                Utils.verifyActiveTable(res, tbl, opt);
                expect(res.isSchemaFrozen).to.equal(true);
                expect(res.isReplicated).to.equal(false);
                expect(res.isLocalReplicaInitialized).to.equal(false);
                expect(res.replicas).to.not.exist;    
            } else {
                opt._repCnt = resCnt;
                verifyActiveRepTable(res, tbl, opt);
                const repInfo = res.replicas.find(
                    r => r.replicaName === rep.region.regionId);
                expect(repInfo).to.not.exist;
            }
        });
}

function testReplicaInfo(clients, tbl) {
    describe('Verify replica information', function() {
        let replicas;
        before(async function() {
            for(const rep of REPLICAS) {
                //Convert some replicas to on-demand capacity, which should
                //not affect the original table.
                if (rep.toOnDemand) {
                    const res = await clients[rep.region.regionId]
                        .setTableLimits(tbl.name, {
                            mode: CapacityMode.ON_DEMAND,
                            storageGB: tbl.limits.storageGB
                        }, { complete: true });
                    Utils.verifyActiveTable(res, tbl,
                        { _ignoreTableLimits: true });    
                }
            }

            const res = await clients[LOCAL_REGION.regionId].getTable(
                tbl.name);
            verifyActiveRepTable(res, tbl, { _repCnt: REPLICAS.length });
            replicas = res.replicas;
        });

        for(const rep of REPLICAS) {
            it(`Verify replica ${rep.region.regionId}`, async function() {
                const repInfo = replicas.find(
                    r => r.replicaName === rep.region.regionId);
                verifyRepInfo(repInfo, tbl, rep, rep.toOnDemand);

                //All replicas should already be initialized.
                const res = await clients[repInfo.replicaName].getTable(
                    tbl.name);
                
                verifyActiveRepTable(res, tbl, {
                    tableLimits: {
                        readUnits: rep.readUnits ?
                            rep.readUnits : tbl.limits.readUnits,
                        writeUnits: rep.writeUnits ?
                            rep.writeUnits : tbl.limits.writeUnits,
                        storageGB: tbl.limits.storageGB,
                        mode: rep.toOnDemand ? CapacityMode.ON_DEMAND :
                            CapacityMode.PROVISIONED
                    },
                    _repCnt: REPLICAS.length,
                    _tableOCID: repInfo.replicaOCID
                });
            });
        }});
}

async function testGetReplicaStats(client, tbl) {
    const startTime = new Date(Date.now() - 5 * 60000);
    it(`getReplicaStats on table ${tbl.name}`, async function() {
        const res = await client.getReplicaStats(tbl.name);
        verifyReplicaStatsResult(res, tbl);
    });
    it(`getReplicaStats on table ${tbl.name} with timeout`, async function() {
        const opt = {
            timeout: 10000,
            compartment
        };
        const res = await client.getReplicaStats(tbl.name, opt);
        verifyReplicaStatsResult(res, tbl, opt);
    });

    it(`getReplicaStats on table ${tbl.name} with start time`,
        async function() {
            const opt = { startTime };
            const res = await client.getReplicaStats(tbl.name, opt);
            verifyReplicaStatsResult(res, tbl, opt);
        });

    it(`getReplicaStats on table ${tbl.name} with start time as string`,
        async function() {
            const opt = {
                startTime: startTime.toISOString(),
                timeout: 12000
            };
            const res = await client.getReplicaStats(tbl.name, opt);
            verifyReplicaStatsResult(res, tbl, opt);
        });

    it(`getReplicaStats on table ${tbl.name} with start time as number`,
        async function() {
            const opt = {
                startTime: startTime.getTime(),
                compartment
            };
            const res = await client.getReplicaStats(tbl.name, opt);
            verifyReplicaStatsResult(res, tbl, opt);
        });

    it(`getReplicaStats on table ${tbl.name}, expected empty result`,
        async function() {
            const opt = {
                startTime: startTime.getTime() + 1000000,
                _expEmptyResult: true
            };
            const res = await client.getReplicaStats(tbl.name, opt);
            verifyReplicaStatsResult(res, tbl, opt);
        });

    it(`getReplicaStats on table ${tbl.name} with limit`, async function() {
        const opt = {
            limit: 2
        };
        const res = await client.getReplicaStats(tbl.name, opt);
        verifyReplicaStatsResult(res, tbl, opt);
    });

    it(`getReplicaStats on table ${tbl.name} with start time and limit`,
        async function() {
            const opt = {
                startTime,
                limit: 1
            };
            const res = await client.getReplicaStats(tbl.name, opt);
            verifyReplicaStatsResult(res, tbl, opt);
        });

    it(`getReplicaStats on table ${tbl.name} with region`, async function() {
        const opt = {
            region: REPLICAS[0].region
        };
        const res = await client.getReplicaStats(tbl.name, opt);
        verifyReplicaStatsResult(res, tbl, opt);
    });

    it(`getReplicaStats on table ${tbl.name} with region as string`,
        async function() {
            const opt = {
                region: REPLICAS[0].region.regionId,
                timeout: 8000
            };
            const res = await client.getReplicaStats(tbl.name, opt);
            verifyReplicaStatsResult(res, tbl, opt);
        });

    it(`getReplicaStats on table ${tbl.name} with region and start time`,
        async function() {
            const opt = {
                region: REPLICAS[1].region,
                startTime
            };
            const res = await client.getReplicaStats(tbl.name, opt);
            verifyReplicaStatsResult(res, tbl, opt);
        });

    it(`getReplicaStats on table ${tbl.name} with region, expect empty \
result`,
    async function() {
        const opt = {
            region: REPLICAS[1].region,
            startTime: startTime.getTime() + 1000000,
            _expEmptyResult: true
        };
        const res = await client.getReplicaStats(tbl.name, opt);
        verifyReplicaStatsResult(res, tbl, opt);
    });

    it(`getReplicaStats on table ${tbl.name} with region and limit`,
        async function() {
            const opt = {
                region: REPLICAS[1].region.regionId,
                limit: 2
            };
            const res = await client.getReplicaStats(tbl.name, opt);
            verifyReplicaStatsResult(res, tbl, opt);
        });

    it(`getReplicaStats on table ${tbl.name} with region, startTime as \
string and limit`, async function() {
        const opt = {
            region: REPLICAS[2].region,
            startTime: startTime.toUTCString(),
            limit: 1,
            compartment,
            timeout: 7000
        };
        const res = await client.getReplicaStats(tbl.name, opt);
        verifyReplicaStatsResult(res, tbl, opt);
    });

    it(`getReplicaStats on table ${tbl.name} with region, startTime as \
number and limit`, async function() {
        const opt = {
            region: REPLICAS[2].region.regionId,
            startTime: startTime.getTime(),
            limit: 2,
            compartment
        };
        const res = await client.getReplicaStats(tbl.name, opt);
        verifyReplicaStatsResult(res, tbl, opt);
    });
}

function testForLocalReplicaInit(client, tbl) {
    //Negative tests
    for(let badTblName of badTblNames) {
        it(`forLocalReplicaInit with invalid table name: \
${util.inspect(badTblName)}`, async function() {
            return expect(client.forLocalReplicaInit(badTblName))
                .to.be.rejectedWith(NoSQLArgumentError);
        });
    }

    for(let badOpt of badCompletionOpts) {
        it(`forLocalReplicaInit on ${tbl.name} with invalid options: \
${util.inspect(badOpt)}`, async function() {
            return expect(client.forLocalReplicaInit(tbl.name, badOpt))
                .to.be.rejectedWith(NoSQLArgumentError);
        });
    }

    //Test with non-existent table
    it('forLocalReplicaInit on non-existent table', async function() {
        return expect(client.forLocalReplicaInit('nosuchtable'))
            .to.eventually.be.rejected.and.satisfy(err =>
                err instanceof NoSQLError &&
                err.errorCode == ErrorCode.TABLE_NOT_FOUND);
    });

    //Positive test (we also test this API in other places)
    it(`forLocalReplicaInit on ${tbl.name}`, async function() {
        let res = await client.getTable(tbl.name);
        Utils.verifyActiveTable(res, tbl);
        res = await client.forLocalReplicaInit(tbl.name, {
            timeout: 5000,
            delay: 500,
            compartment
        });
        Utils.verifyActiveTable(res, tbl);
    });
}

async function dropAllReplicas(client, tbl) {
    let res;
    try {
        res = await client.forTableState(tbl.name, TableState.ACTIVE,
            { timeout: 30000 });
    } catch(err) {
        if (err.errorCode === ErrorCode.TABLE_NOT_FOUND) {
            return;
        }
        throw err;
    }

    expect(res).to.exist;
    if (res.replicas == null) {
        return;
    }

    expect(res.replicas).to.be.an('array');
    for(const repInfo of res.replicas) {
        await client.dropReplica(tbl.name, repInfo.replicaName,
            { complete: true });
    }
}

const NUM_ROWS = 100;

async function addRows(client, tbl) {
    for(let i = 0; i < NUM_ROWS; i++) {
        const res = await client.put(tbl.name, {
            id: i,
            lastName: 'Last Name',
            firstName: 'First Name',
            info: {
                fld: 'Some Field'
            },
            startDate: new Date()
        });
        expect(res.success).to.equal(true);
    }
}

async function testGATNotSupported(client, tbl) {
    describe(`GAT for ${Utils.config.serviceType} - not supported`,
        function() {
            before(async function() {
                await Utils.createTable(client, tbl);
            });
            after(async function() {
                await Utils.dropTable(client, tbl);
            });
            it('addReplica - not supported', async function() {
                return expect(client.addReplica(tbl.name, REPLICAS[0].region))
                    .to.eventually.be.rejected.and.satisfy(
                        err => err instanceof NoSQLError &&
                        err.errorCode == ErrorCode.OPERATION_NOT_SUPPORTED);
            });
            it('dropReplica - not supported', async function() {
                return expect(client.dropReplica(tbl.name,
                    REPLICAS[0].region)).to.eventually.be.rejected
                    .and.satisfy(
                        err => err instanceof NoSQLError &&
                        err.errorCode == ErrorCode.OPERATION_NOT_SUPPORTED);
            });
            it('getReplicaStats - not supported', async function() {
                //Currently getReplicaStats returns fake record. This will be
                //changed to throw OPERATION_NOT_SUPPORTED, at which time we
                //can update this code.
                try {
                    await client.getReplicaStats(tbl.name);
                } catch(err) {
                    expect(err).to.satisfy(err => err instanceof NoSQLError &&
                        err.errorCode == ErrorCode.OPERATION_NOT_SUPPORTED);
                }
            });
            it('forLocalReplicaInit - not supported', async function() {
                return expect(client.forLocalReplicaInit(tbl.name))
                    .to.eventually.be.rejected.and.satisfy(
                        err => err instanceof NoSQLError &&
                        err.errorCode == ErrorCode.OPERATION_NOT_SUPPORTED);
            });
        });
}

//Normally, the unit tests should not depend on the order of execution.
//However, because these operations are executed by the Cloud Service, to
//minimize resources and time required, we enfoce an order of execution below,
//such that addReplica tests are executed first, dropReplica tests last, and
//all other tests in between (so that they can assume the replicas already
//exist).

if (Utils.isCloud) {
    describe('Global Active Table test', function() {
        this.timeout(0);
        const tbl = Object.assign({}, SIMPLE_TABLE, {
            limits: {
                readUnits: 5,
                writeUnits: 5,
                storageGB: 1
            },
            isSchemaFrozen: true
        });

        const clients = {
            [LOCAL_REGION.regionId]: new NoSQLClient(
                configForRegion(LOCAL_REGION))
        };
        for(const rep of REPLICAS) {
            clients[rep.region.regionId] = new NoSQLClient(
                configForRegion(rep.region));
        }
        const client = clients[LOCAL_REGION.regionId];

        before(async function() {
            await dropAllReplicas(client, tbl);
            await Utils.dropTable(client, tbl);
            await Utils.createTable(client, tbl);
            await addRows(client, tbl);
        });
        after(async function() {
            try {
                await dropAllReplicas(client, tbl);
                await Utils.dropTable(client, tbl);
            } finally {
                for(const repName in clients) {
                    await clients[repName].close();
                }
            }
        });
        
        describe('Testing addReplica', function() {
            testAddReplicaNegative(client, tbl);
            let resCnt = 1;
            for(const rep of REPLICAS) {
                testAddReplica(clients, tbl, rep, resCnt++);
            }
        });

        //Because testReplicaInfo requires inner suite, we have to put all
        //testcases in their inner suites to ensure correct execution order.
        testReplicaInfo(clients, tbl);

        describe('Testing getReplicaStats', function() {
            testGetReplicaStatsNegative(client, tbl);
            testGetReplicaStats(client, tbl);
        });

        describe('Testing forLocalReplicaInit', function() {
            testForLocalReplicaInit(client, tbl);
        });

        describe('Testing dropReplica', function() {
            testDropReplicaNegative(client, tbl);
            let resCnt = REPLICAS.length;
            for(const rep of REPLICAS) {
                testDropReplica(client, tbl, rep, --resCnt);
            }
        });
    });
} else {
    const kvVer = Utils.kvVersion;
    //As of now kv 24.1 doesn't have GAT proxy changes, so not enabling this
    //in default case (without kvVer), this can be changed later.
    const GAT_VERSION = '24.2';
    if (kvVer != null && compareVersions(kvVer, GAT_VERSION) >= 0) {
        Utils.runSequential('GAT non-cloud - not supported',
            (client, test) => testGATNotSupported(client, test.table),
            [ { table: SIMPLE_TABLE } ]);
    }
}
