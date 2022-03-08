/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const assert = require('assert');

/**
 * Defines enumeration types and constants used by the driver.
 */

/**
 * @classdesc Base class for all enumerations used in the driver. All
 * enumeration constants are instances of the subclasses of this class.
 * Driver defines fixed number of members of each enumeration and seals the
 * enumeration class so that new members cannot be created.
 * @hideconstructor
 *
 */
class Enum {
    constructor(ordinal, desc, name) {
        //Prevent construction of new objects by the user
        assert(!this.constructor._sealed);
        if (ordinal != null) {
            this._ordinal = ordinal;
        } else {
            if (this.constructor._ordinalSeq == null) {
                this.constructor._ordinalSeq = 0;
            }
            this._ordinal = this.constructor._ordinalSeq++;
        }
        this._desc = desc;
        this._name = name;
    }

    /**
     * Name of the enumeration constant, usually the same as its symbol name.
     * @type {string}
     * @readonly
     */
    get name() {
        return this._name;
    }

    /**
     * Numeric integer value of the enumeration constant.
     * @type {number}
     * @readonly
     */
    get ordinal() {
        return this._ordinal;
    }

    /**
     * Optional description of the enumeration constant.
     * @type {string}
     * @readonly
     */
    get description() {
        return this._desc;
    }

    /**
     * Returns string representation of enumeration constant as
     * EnumClass.ConstantName, e.g. 'Consistenty.Absolute'
     * @returns {string}
     */
    toString() {
        return this.constructor.name + '.' + this._name;
    }

    static get values() {
        const enumClass = this;
        const vals = [];
        for(let val of Object.values(enumClass)) {
            if (val instanceof enumClass) {
                vals.push(val);
            }
        }
        return vals;
    }

    static get names() {
        return this.values.map(val => val.name);
    }

    static find(predicate) {
        const enumClass = this;
        for(let val of Object.values(enumClass)) {
            if (val instanceof enumClass && predicate(val)) {
                return val;
            }
        }
    }

    static fromOrdinal(n) {
        const enumClass = this;
        for(let val of Object.values(enumClass)) {
            if (val instanceof enumClass && val.ordinal == n) {
                return val;
            }
        }
        throw new RangeError(
            `Ordinal ${n} is not valid for ${enumClass.name} enumeration`);
    }

    static seal() {
        const enumClass = this;
        for(let [key, val] of Object.entries(enumClass)) {
            if (val instanceof enumClass) {
                if (!val._name) { //Assign name if was not specified
                    val._name = key;
                }
                Object.freeze(val);
            }
        }
        enumClass._sealed = true;
        Object.freeze(enumClass);
    }
}

/**
 * Service type is specified in the initial configuration used to create
 * {@link NoSQLClient} instance and indicates what kind of service the
 * driver will be using.  Currently supported values are
 * {@link ServiceType.CLOUDSIM}, {@link ServiceType.CLOUD} and
 * {@link ServiceType.KVSTORE}.  In addition to {@link ServiceType}
 * enumeration, these values may be specified as strings "CLOUDSIM", "CLOUD"
 * or "KVSTORE", case-insensitive.  This is useful if using JSON configuration
 * file.  If {@link ServiceType} is not present in the initial configuration,
 * the driver will try to deduce service type from the
 * information provided in authorization property {@link Config}#auth (see
 * {@link AuthConfig}) in the following way:
 * <ul>
 * <li>If {@link Config}#auth is undefined or null, the service type is
 * determined as follows: if {@link Config}#region is specified, the service
 * type defaults to {@link ServiceType.CLOUD}, otherwise it defaults to
 * {@link ServiceType.CLOUDSIM}
 * <li>If {@link Config}#auth contains <em>iam</em> property, the service
 * type is assumed to be {@link ServiceType.CLOUD}</li>
 * <li>If {@link Config}#auth constains <em>kvstore</em> property, the service
 * type is assumed to be {@link ServiceType.KVSTORE}.  Note that unless
 * {@link Config}#serviceType is explicitly specified, you may not specify
 * both <em>iam</em> and <em>kvstore</em> properties in {@link AuthConfig}
 * at the same time.  You may specify value <em>{}</em> (empty object) for
 * <em>kvstore</em> property to connect to non-secure kvstore, although it is
 * advisable to specify the service type explicitly in this case.  See
 * {@link ServiceType.KVSTORE}</li>
 * <li>If {@link Config}#auth does not contain either of the above properties,
 * the driver will check if it contains user-specified
 * {@link AuthorizationProvider} ({@link AuthConfig}#provider).  In this case
 * the service type will remain undefined and user-specified provider will be
 * used to control access to the service.  If there is no user-specified
 * {@link AuthorizationProvider} in {@link Config}#auth, this is equivalent to
 * {@link Config}#auth not defined and the service type will default to
 * {@link ServiceType.CLOUD} or {@link ServiceType.CLOUDSIM} as described
 * above</li>
 * </ul>
 *
 * @extends Enum
 * @hideconstructor
 *
 * @see {@link AuthConfig}
 * @see {@link AuthorizationProvider}
 */
class ServiceType extends Enum {}

/**
 * Cloud Simulator, no authorization used.
 * @tutorial connect-cloud
 */
ServiceType.CLOUDSIM = new ServiceType(0);

/**
 * Oracle NoSQL Cloud Service.  Authorization is managed by IAM.
 * @see {@link IAMConfig}
 * @tutorial connect-cloud
 */
ServiceType.CLOUD = new ServiceType(1);

/**
 * On Premise Oracle NoSQL Database.  This includes both secure and non-secure
 * stores.  For secure store, authentication information must be provided in
 * {@link AuthConfig}#kvstore as {@link KVStoreAuthConfig}.  For non-secure
 * store, it is enough to specify {@link Config}#serviceType to be
 * {@link ServiceType.KVSTORE} without having {@link AuthConfig}#kvstore
 * property.
 * @see {@link KVStoreAuthConfig}
 * @tutorial connect-on-prem
 */
ServiceType.KVSTORE = new ServiceType(2);

/**
 * @ignore
 */
ServiceType.MINICLOUD = new ServiceType(3); //internal use only
ServiceType.MINICLOUD._isInternal = true;

/**
 * @ignore
 */
ServiceType.DEVPOD = new ServiceType(3); //internal use only
ServiceType.DEVPOD._isInternal = true;

ServiceType.seal();

/**
 * Consistency is used to provide consistency guarantees for read operations.
 * <p>
 * {@link Consistency.ABSOLUTE} consistency may be specified to guarantee that
 * current values are read. {@link Consistency.EVENTUAL} consistency means
 * that the values read may be very slightly out of date.
 * {@link Consistency.ABSOLUTE} consistency results in higher cost, consuming
 * twice the number of read units for the same data relative to
 * {@link Consistency.EVENTUAL} consistency, and should only be used when
 * required.
 * </p>
 * <p>
 * It is possible to set a default Consistency for a {@link NoSQLClient}
 * instance by providing it in the initial configuration as
 * {@link Config}#consistency.  In JSON configuration file, you may use string
 * values such as "EVENTUAL" or "ABSOLUTE".  If no consistency is specified
 * for an operation and there is no default value,
 * {@link Consistency.EVENTUAL} is used.
 * </p>
 * <p>
 * Consistency can be specified in the options(<em>opt</em>) argument for all
 * read operations.
 * </p>
 * @extends Enum
 * @hideconstructor
 */
class Consistency extends Enum {}

/**
 * Absolute consistency
 * @type {Consistency}
 */
Consistency.ABSOLUTE = new Consistency(0);

/**
 * Eventual consistency
 * @type {Consistency}
 */
Consistency.EVENTUAL = new Consistency(1);

Consistency.seal();

/**
 * CapacityMode specifies the type of capacity that will be set on a table. It is
 * used in table creation and table capacity updates. See {@link TableLimits}.
 * <p>
 * Table capacity is only used in the NoSQL Cloud Service.
 * </p>
 * <p>
 * {@link CapacityMode.PROVISIONED} is the default mode. In this mode, the
 * application defines the specified maximum read and write throughput for
 * a table.
 * {@link CapacityMode.ON_DEMAND} mode allows for flexible throughput usage.
 * In this mode, only the maximum storage size is specified.
 * </p>
 * @extends Enum
 * @hideconstructor
 */
class CapacityMode extends Enum {}

/**
 * Provisioned mode. This is the default.
 * @type {CapacityMode}
 * @since 5.3.0
 */
CapacityMode.PROVISIONED = new CapacityMode(1);

/**
 * On Demand mode.
 * @type {CapacityMode}
 * @since 5.3.0
 */
CapacityMode.ON_DEMAND = new CapacityMode(2);

CapacityMode.seal();


/**
 * On premise only: see {@link Durability}
 * Defines the synchronization policy to be used when committing a
 * transaction. High levels of synchronization offer a greater guarantee
 * that the transaction is persistent to disk, but trade that off for
 * lower performance.
 * @extends Enum
 * @hideconstructor
 */
class SyncPolicy extends Enum {}

/**
 * Write and synchronously flush the log on transaction commit.
 * Transactions exhibit all the ACID (atomicity, consistency,
 * isolation, and durability) properties.
 * @type {SyncPolicy}
 * @since 5.3.0
 */
SyncPolicy.SYNC = new SyncPolicy(1);

/**
 * Do not write or synchronously flush the log on transaction commit.
 * Transactions exhibit the ACI (atomicity, consistency, and isolation)
 * properties, but not D (durability); that is, database integrity will
 * be maintained, but if the application or system fails, it is
 * possible some number of the most recently committed transactions may
 * be undone during recovery. The number of transactions at risk is
 * governed by how many log updates can fit into the log buffer, how
 * often the operating system flushes dirty buffers to disk, and how
 * often log checkpoints occur.
 * @type {SyncPolicy}
 * @since 5.3.0
 */
SyncPolicy.NO_SYNC = new SyncPolicy(2);

/**
 * Write but do not synchronously flush the log on transaction commit.
 * Transactions exhibit the ACI (atomicity, consistency, and isolation)
 * properties, but not D (durability); that is, database integrity will
 * be maintained, but if the operating system fails, it is possible
 * some number of the most recently committed transactions may be
 * undone during recovery. The number of transactions at risk is
 * governed by how often the operating system flushes dirty buffers to
 * disk, and how often log checkpoints occur.
 * @type {SyncPolicy}
 * @since 5.3.0
 */
SyncPolicy.WRITE_NO_SYNC = new SyncPolicy(3);

SyncPolicy.seal();

/**
 * On premise only: see {@link Durability}
 * A replicated environment makes it possible to increase an application's
 * transaction commit guarantees by committing changes to its replicas on
 * the network. ReplicaAckPolicy defines the policy for how such network
 * commits are handled.
 * @hideconstructor
 */
class ReplicaAckPolicy extends Enum {}

/**
 * All replicas must acknowledge that they have committed the
 * transaction. This policy should be selected only if your replication
 * group has a small number of replicas, and those replicas are on
 * extremely reliable networks and servers.
 * @type {ReplicaAckPolicy}
 * @since 5.3.0
 */
ReplicaAckPolicy.ALL = new ReplicaAckPolicy(1);

/**
 * No transaction commit acknowledgments are required and the master
 * will never wait for replica acknowledgments. In this case,
 * transaction durability is determined entirely by the type of commit
 * that is being performed on the master.
 * @type {ReplicaAckPolicy}
 * @since 5.3.0
 */
ReplicaAckPolicy.NONE = new ReplicaAckPolicy(2);

/**
 * A simple majority of replicas must acknowledge that they have
 * committed the transaction. This acknowledgment policy, in
 * conjunction with an election policy which requires at least a simple
 * majority, ensures that the changes made by the transaction remains
 * durable if a new election is held.
 * @type {ReplicaAckPolicy}
 * @since 5.3.0
 */
ReplicaAckPolicy.SIMPLE_MAJORITY = new ReplicaAckPolicy(3);

ReplicaAckPolicy.seal();


//Not currently used by the driver.
/** @ignore */
class ScanDirection extends Enum {}
ScanDirection.UNORDERED = new ScanDirection(0);
ScanDirection.FORWARD = new ScanDirection(1);
ScanDirection.REVERSE = new ScanDirection(2);
ScanDirection.seal();

/**
 * Describes the current state of the table.  See
 * {@link NoSQLClient#tableDDL}.
 * @extends Enum
 * @hideconstructor
 */
class TableState extends Enum {}

/**
 * The table is ready to be used. This is the steady state after creation or
 * modification.
 * @type TableState
 */
TableState.ACTIVE = new TableState(0);

/**
 * The table is being created and cannot yet be used.
 * @type TableState
 */
TableState.CREATING = new TableState(1);

/**
 * The table has been dropped or does not exist.
 * @type TableState
 */
TableState.DROPPED = new TableState(2);

/**
 * The table is being dropped and cannot be used.
 * @type TableState
 */
TableState.DROPPING = new TableState(3);

/**
 * The table is being updated. It is available for normal use, but additional
 * table modification operations are not permitted while the table is in this
 * state.
 * @type TableState
 */
TableState.UPDATING = new TableState(4);

TableState.seal();

/**
 * On premise only.
 * <p>
 * Describes the current state of the operation performed by
 * {@link NoSQLClient#adminDDL}.
 * @extends Enum
 * @hideconstructor
 */
class AdminState extends Enum {}

/**
 * Operation is complete and successful.
 * @type AdminState
 */
AdminState.COMPLETE = new AdminState(0);

/**
 * Operation is in progress.
 * @type AdminState
 */
AdminState.IN_PROGRESS = new AdminState(1);

AdminState.seal();

/**
 * For now this is internal, but we may expose this enumeration
 * when we implement custom type mappings.
 * @ignore
 */
class DBType extends Enum {}
DBType.ARRAY = new DBType(0);
DBType.BINARY = new DBType(1);
DBType.BOOLEAN = new DBType(2);
DBType.DOUBLE = new DBType(3);
DBType.INTEGER = new DBType(4);
DBType.LONG = new DBType(5);
DBType.MAP = new DBType(6);
DBType.STRING = new DBType(7);
DBType.TIMESTAMP = new DBType(8);
DBType.NUMBER = new DBType(9);
DBType.JSON_NULL = new DBType(10);
DBType.NULL = new DBType(11);
DBType.EMPTY = new DBType(12);
DBType.seal();

//Only used internally.  Not clear if some limits (in particular request
//sizes) are specific to binary protocol.  If so, they could be moved there.

const Limits = {
    REQUEST_SIZE: 2 * 1024 * 1024,
    BATCH_REQUEST_SIZE: 25 * 1024 * 1024,
    BATCH_OP_NUMBER: 50,
    READ_KB: 2 * 1024,
    WRITE_KB: 2 * 1024,
    //Maximum timeout for single http request accepted by the proxy
    MAX_REQUEST_TIMEOUT: 30000
};

//Only used internally by advanced query, should not show up in the results.
const EMPTY_VALUE = Symbol('EMPTY');

//HTTP-related constants, only used internally
const HttpConstants = {
    POST: 'POST',
    GET: 'GET',
    DELETE: 'DELETE',
    PUT: 'PUT',
    CONTENT_TYPE: 'Content-Type',
    APPLICATION_JSON: 'application/json',
    CONNECTION: 'Connection',
    ACCEPT: 'Accept',
    AUTHORIZATION: 'Authorization',
    CONTENT_LENGTH: 'Content-Length',
    USER_AGENT: 'User-Agent',
    CACHE_CONTROL: 'cache-control',
    COOKIE: 'cookie',
    SET_COOKIE: 'set-cookie',
    HOST: 'host',
    DATE: 'date',
    REQUEST_ID: 'x-nosql-request-id',
    DATA_PATH_NAME: 'data',
    NOSQL_VERSION: 'V2',
    NOSQL_PATH_NAME: 'nosql',
    COMPARTMENT_ID: 'x-nosql-compartment-id',
    REQUEST_TARGET: '(request-target)',
    CONTENT_SHA256: 'x-content-sha256',
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

const PACKAGE_VERSION = require('../package.json').version;
delete require.cache[require.resolve('../package.json')];

module.exports = {
    Enum,
    ServiceType,
    Consistency,
    SyncPolicy,
    ReplicaAckPolicy,
    CapacityMode,
    ScanDirection,
    TableState,
    AdminState,
    DBType,
    Limits,
    EMPTY_VALUE,
    HttpConstants,
    PACKAGE_VERSION
};
