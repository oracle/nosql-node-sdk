/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const NoSQLArgumentError = require('../error').NoSQLArgumentError;
const TableState = require('../constants').TableState;
const CapacityMode = require('../constants').CapacityMode;
const isPosInt32 = require('../utils').isPosInt32;
const isPosInt32OrZero = require('../utils').isPosInt32OrZero;
const isPlainObject = require('../utils').isPlainObject;
const hasOwnProperty = require('../utils').hasOwnProperty;
const Op = require('./op');
const Region = require('../region');

class TableDDLOp extends Op {

    static applyDefaults(req, def) {
        super.applyDefaults(req, def);
        if (hasOwnProperty(req.opt, 'timeout')) {
            req.opt._ownsTimeout = true;
        } else {
            req.opt.timeout = def.ddlTimeout;
        }
        if (req.opt.complete && !hasOwnProperty(req.opt, 'delay')) {
            req.opt.delay = def.tablePollDelay;
        }
    }

    static _validateTimeout(req) {
        if ((!req.opt.complete || req.opt.timeout !== Infinity) &&
            !isPosInt32(req.opt.timeout)) {
            throw new NoSQLArgumentError(
                `Invalid timeout for table DDL: ${req.opt.timeout}`, req);
        }
    }

    static _validateTableLimits(req) {
        const tl = req.opt.tableLimits;
        if (tl == null || typeof tl !== 'object') {
            throw new NoSQLArgumentError('Invalid table limits', req);
        }
        if (tl.mode != null && !(tl.mode instanceof CapacityMode)) {
            throw new NoSQLArgumentError('Invalid table capacity mode', req);
        }
        if (!isPosInt32(tl.storageGB)) {
            throw new NoSQLArgumentError(
                'Invalid table limits storageGB', req);
        }
        if (tl.mode != null && tl.mode == CapacityMode.ON_DEMAND) {
            if (tl.readUnits != null || tl.writeUnits != null) {
                throw new NoSQLArgumentError(
                    'Cannot specify read units or write units for on demand \
capacity table');
            }
        } else {
            if (!isPosInt32(tl.readUnits) || !isPosInt32(tl.writeUnits)) {
                throw new NoSQLArgumentError(
                    'Invalid table limits field values readUnits or \
writeUnits', req);
            }
        }
    }

    static _validateTableTags(req) {
        this._chkProtoVer('Table tagging', 4, req);
        if (req.opt.definedTags == null && req.opt.freeFormTags == null) {
            throw new NoSQLArgumentError('No tags specified for TableTagsOp',
                req);
        }
        if (req.opt.definedTags != null &&
            typeof req.opt.definedTags !== 'object') {
            throw new NoSQLArgumentError('Invalid value of definedTags', req);
        }
        if (req.opt.freeFormTags != null &&
            typeof req.opt.freeFormTags !== 'object') {
            throw new NoSQLArgumentError('Invalid value of freeFormTags',
                req);
        }
    }

    static _validateETag(req) {
        if (typeof req.opt.matchETag !== 'string' || !req.opt.matchETag) {
            throw new NoSQLArgumentError(
                `Invalid value of ETag: ${req.opt.matchETag}, must be \
non-empty string`);
        }
    }

    static _validateTblReqOpt(req, requireLimits, requireTags) {
        if (requireLimits || req.opt.tableLimits != null) {
            this._validateTableLimits(req);
        }
        if (requireTags || (req.opt.definedTags != null ||
            req.opt.freeFormTags != null)) {
            this._validateTableTags(req);
        }
        if (req.opt.matchETag != null) {
            this._chkProtoVer('Table ETag', 4, req);
            this._validateETag(req);
        }
        if (req.opt.complete) {
            this._validateDelay(req);
        }
    }

    static validate(req) {
        this._validateRequest(req);
        if (typeof req.stmt !== 'string' || !req.stmt.length) {
            throw new NoSQLArgumentError('Missing or invalid statement', req);
        }
        this._validateTblReqOpt(req);
    }

    static onResult(client, req, res) {
        GetTableOp.onResult(client, req, res);
        res._stmt = req.stmt;
    }

    static shouldRetry() {
        return false;
    }

    static needsContentSigned() {
        return true;
    }
}

class TableLimitsOp extends TableDDLOp {

    static validate(req) {
        this._validateRequest(req);
        this._chkTblName(req);
        this._validateTblReqOpt(req, true);
    }

}

class TableTagsOp extends TableDDLOp {

    static validate(req) {
        this._validateRequest(req);
        this._chkTblName(req);
        this._validateTblReqOpt(req, false, true);
    }

}

class ReplicaOpBase extends TableDDLOp {
    //Same as for _validateDateField(), convert Region to string to avoid
    //checking during serialization.
    static _validateRegionField(obj, req) {
        let region = obj.region;
        if (region instanceof Region) {
            obj.region = region = region.regionId;
        }
        if (!(region instanceof Region) &&
            (typeof region !== 'string' || !region)) {
            throw new NoSQLArgumentError(`Invalid region: ${region}`, req);
        }
    }

    static validate(req) {
        this._chkProtoVer(req.api.name, 4, req);
        this._validateRequest(req);
        this._chkTblName(req);
        if (req.region == null) {
            throw new NoSQLArgumentError('Missing region', req);
        }
        this._validateRegionField(req, req);
        if (req.opt.matchETag != null) {
            this._validateETag(req);
        }
        if (req.opt.complete) {
            this._validateDelay(req);
        }
    }

    static needsContentSigned() {
        return true;
    }
}

class AddReplicaOp extends ReplicaOpBase {

    static validate(req) {
        super.validate(req);
        if (req.opt.readUnits != null && !isPosInt32(req.opt.readUnits)) {
            throw new NoSQLArgumentError(
                `Invalid read units: ${req.opt.readUnits}`);
        }
        if (req.opt.writeUnits != null && !isPosInt32(req.opt.writeUnits)) {
            throw new NoSQLArgumentError(
                `Invalid write units: ${req.opt.writeUnits}`);
        }
    }
}

class DropReplicaOp extends ReplicaOpBase {}

class GetTableOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        if (!req.tableName) {
            if (req.table == null) {
                throw new NoSQLArgumentError('Missing table argument', req);
            }
            if (typeof req.table === 'string') {
                req.tableName = req.table;
            } else if (isPlainObject(req.table) &&
                req.table.tableName != null) {
                req.tableName = req.table.tableName;
                req.opt.operationId = req.table.operationId;
            } else {
                throw new NoSQLArgumentError('Invalid table argument', req);
            }
        }
        if (req.opt.operationId != null &&
            (typeof req.opt.operationId !== 'string' ||
            !req.opt.operationId.length)) {
            throw new NoSQLArgumentError('Invalid operation id', req);
        }
        this._chkTblName(req);
    }

    static onResult(client, req, res) {
        super.onResult(client, req, res);
        client.emit('tableState', res.tableName, res.tableState);
        if (client._rlClient != null) {
            client._rlClient.updateLimiters(res);
        }
    }

}

class PollTableOp extends GetTableOp {
    
    static applyDefaults(req, def) {
        super.applyDefaults(req, def);
        if (!hasOwnProperty(req.opt, 'timeout')) {
            req.opt.timeout = def.tablePollTimeout;
        }
        if (!hasOwnProperty(req.opt, 'delay')) {
            req.opt.delay = def.tablePollDelay;
        }
    }

    static _validateTimeout(req) {
        if (req.opt.timeout !== Infinity && !isPosInt32(req.opt.timeout)) {
            throw new NoSQLArgumentError(
                `Invalid timeout for table poll: ${req.opt.timeout}`, req);
        }
    }

    static validate(req) {
        super.validate(req);
        this._validateDelay(req);
    }
}

class PollTableStateOp extends PollTableOp {
    static validate(req) {
        super.validate(req);
        if (!(req.tableState instanceof TableState)) {
            throw new NoSQLArgumentError('Invalid table state', req);
        }
    }
}

class TableUsageOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        this._chkTblName(req);
        this._validateDateField(req, req.opt, 'startTime');
        this._validateDateField(req, req.opt, 'endTime');
        if (req.opt.startIndex != null) {
            this._chkProtoVer('Paging of table usage records', 4, req);
            if (!isPosInt32OrZero(req.opt.startIndex)) {
                throw new NoSQLArgumentError('Invalid start index', req);
            }
        }
        if (req.opt.limit != null && !isPosInt32(req.opt.limit)) {
            throw new NoSQLArgumentError('Invalid limit', req);
        }
    }

    static shouldRetry() {
        return false;
    }

}

class ReplicaStatsOp extends Op {

    static validate(req) {
        this._chkProtoVer(req.api.name, 4, req);
        this._validateRequest(req);
        this._chkTblName(req);
        //We have to add this because req.opt inherits config, and config
        //already has property "region".
        if (!hasOwnProperty(req.opt, 'region')) {
            req.opt.region = undefined;
        }
        if (req.opt.region != null) {
            ReplicaOpBase._validateRegionField(req.opt, req);
        }
        this._validateDateField(req, req.opt, 'startTime');
        if (req.opt.limit != null && !isPosInt32(req.opt.limit)) {
            throw new NoSQLArgumentError(`Invalid limit: ${req.opt.limit}`,
                req);
        }
    }

    static shouldRetry() {
        return false;
    }

}

class GetIndexesOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        this._chkTblName(req);

        if ((req.opt.indexName != null || req.api.name === 'getIndex')  &&
            (typeof req.opt.indexName !== 'string' ||
            !req.opt.indexName.length)) {
            throw new NoSQLArgumentError('Invalid index name', req);
        }
    }

    static shouldRetry() {
        return false;
    }

}

class ListTablesOp extends Op {

    static validate(req) {
        this._validateRequest(req);
        if (req.opt.startIndex != null &&
            !isPosInt32OrZero(req.opt.startIndex)) {
            throw new NoSQLArgumentError('Invalid start index', req);
        }
        if (req.opt.limit != null && !isPosInt32(req.opt.limit)) {
            throw new NoSQLArgumentError('Invalid limit', req);
        }
        if (req.opt.namespace != null &&
            typeof req.opt.namespace !== 'string') {
            throw new NoSQLArgumentError('Invalid namespace', req);
        }
    }

    static shouldRetry() {
        return false;
    }

}

module.exports = {
    TableDDLOp,
    TableLimitsOp,
    TableTagsOp,
    AddReplicaOp,
    DropReplicaOp,
    GetTableOp,
    TableUsageOp,
    ReplicaStatsOp,
    GetIndexesOp,
    ListTablesOp,
    PollTableOp,
    PollTableStateOp
};
