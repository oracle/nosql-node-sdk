/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

/**
 * Defines enumeration types and constants used by the driver.
 */

import type { Config } from "./config";
import type { AuthConfig } from "./auth/config";
import type { IAMAuthorizationProvider } from "./auth/iam/auth_provider";
import type { KVStoreAuthorizationProvider } from
    "./auth/kvstore/auth_provider";

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
 * information provided in authorization property {@link Config#auth} (see
 * {@link AuthConfig}) in the following way:
 * <ul>
 * <li>If {@link Config#auth} is undefined or null, the service type is
 * determined as follows: if {@link Config#region} is specified, the service
 * type defaults to {@link ServiceType.CLOUD}, otherwise it defaults to
 * {@link ServiceType.CLOUDSIM}.
 * <li>If {@link Config#auth} contains {@link AuthConfig#iam} property, the
 * service type is assumed to be {@link ServiceType.CLOUD}.</li>
 * <li>If {@link Config#auth} constains {@link AuthConfig#kvstore} property,
 * the service type is assumed to be {@link ServiceType.KVSTORE}. You may
 * specify value <em>\{\}</em> (empty object) for {@link AuthConfig#kvstore}
 * property to connect to non-secure kvstore, although it is advisable to
 * specify the service type explicitly in this case.
 * See {@link ServiceType.KVSTORE}.</li>
 * <li>If {@link Config#auth} contains {@link AuthConfig#provider} property,
 * the service type depends on the type of the provider:
 * {@link ServiceType.CLOUD} if the provider is
 * {@link IAMAuthorizationProvider} and {@link ServiceType.KVSTORE} if the
 * provider is {@link KVStoreAuthorizationProvider}. If using user-specified
 * provider type, the service type will remain undefined.</li>
 * </ul>
 * Note that only one of properties {@link AuthConfig#iam},
 * {@link AuthConfig#kvstore} or {@link AuthConfig#provider} may be specified.
 * If none is specified, this is equivalent to {@link Config#auth} not defined
 * and the service type will default to {@link ServiceType.CLOUD} or
 * {@link ServiceType.CLOUDSIM} as described above.
 * 
 * @see {@link AuthConfig}
 * @see {@link AuthorizationProvider}
 */
export enum ServiceType {
    /**
     * Cloud Simulator, no authorization used.
     * @see {@page connect-cloud.md}
     */
    CLOUDSIM = "CLOUDSIM",

    /**
     * Oracle NoSQL Cloud Service.  Authorization is managed by IAM.
     * @see {@link IAMConfig}
     * @see {@page connect-cloud.md}
     */
    CLOUD = "CLOUD",

    /**
     * On Premise Oracle NoSQL Database. This includes both secure and
     * non-secure stores.  For secure store, authentication information must
     * be provided in {@link AuthConfig#kvstore} as {@link KVStoreAuthConfig}.
     * For non-secure store, it is enough to specify
     * {@link Config#serviceType} to be {@link ServiceType.KVSTORE} without
     * having {@link AuthConfig#kvstore} property.
     * @see {@link KVStoreAuthConfig}
     * @see {@page connect-on-prem.md}
     */
    KVSTORE = "KVSTORE"
}

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
 * {@link Config#consistency}.  In JSON configuration file, you may use string
 * values such as "EVENTUAL" or "ABSOLUTE".  If no consistency is specified
 * for an operation and there is no default value,
 * {@link Consistency.EVENTUAL} is used.
 * </p>
 * <p>
 * Consistency can be specified in the options(<em>opt</em>) argument for all
 * read operations.
 * </p>
 */
export enum Consistency {
    /**
     * Absolute consistency
     * @type {Consistency}
     */
    ABSOLUTE = "ABSOLUTE",

    /**
     * Eventual consistency
     * @type {Consistency}
     */
    EVENTUAL = "EVENTUAL"
}

/**
 * Cloud service only.
 * <p>
 * CapacityMode specifies the type of capacity that will be set on a table. It
 * is used in table creation and table capacity updates. See
 * {@link TableLimits}.
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
 * @since 5.3.0
 */
export enum CapacityMode  {
    /**
     * Provisioned mode. This is the default.
     * @type {CapacityMode}
     * @since 5.3.0
     */
    PROVISIONED = "PROVISIONED",

    /**
     * On Demand mode.
     * @type {CapacityMode}
     * @since 5.3.0
     */
    ON_DEMAND = "ON_DEMAND"    
}

/**
 * Describes the current state of the table. See {@link NoSQLClient#tableDDL}.
 */
export enum TableState {
    /**
     * The table is ready to be used. This is the steady state after creation
     * or modification.
     */
    ACTIVE = "ACTIVE",

    /**
     * The table is being created and cannot yet be used.
     */
    CREATING = "CREATING",

    /**
     * The table has been dropped or does not exist.
     */
    DROPPED = "DROPPED",

    /**
     * The table is being dropped and cannot be used.
     */
    DROPPING = "DROPPING",

    /**
     * The table is being updated. It is available for normal use, but
     * additional table modification operations are not permitted while the
     * table is in this state.
     */
    UPDATING = "UPDATING"
}

/**
 * On premise only.
 * <p>
 * Describes the current state of the operation performed by
 * {@link NoSQLClient#adminDDL}.
 */
export enum AdminState {
    /**
     * Operation is complete and successful.
     */
    COMPLETE = "COMPLETE",

    /**
     * Operation is in progress.
     */
    IN_PROGRESS = "IN_PROGRESS"
}
