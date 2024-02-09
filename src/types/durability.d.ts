/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { Durability } from "./param";

/**
 * On premise only: see {@link Durability}
 * Defines the synchronization policy to be used when committing a
 * transaction. High levels of synchronization offer a greater guarantee
 * that the transaction is persistent to disk, but trade that off for
 * lower performance.
 * @since 5.3.0
 */
export enum SyncPolicy {
    /**
     * Write and synchronously flush the log on transaction commit.
     * Transactions exhibit all the ACID (atomicity, consistency,
     * isolation, and durability) properties.
     * @since 5.3.0
     */
    SYNC = "SYNC",

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
     * @since 5.3.0
     */
    NO_SYNC = "NO_SYNC",

    /**
     * Write but do not synchronously flush the log on transaction commit.
     * Transactions exhibit the ACI (atomicity, consistency, and isolation)
     * properties, but not D (durability); that is, database integrity will
     * be maintained, but if the operating system fails, it is possible
     * some number of the most recently committed transactions may be
     * undone during recovery. The number of transactions at risk is
     * governed by how often the operating system flushes dirty buffers to
     * disk, and how often log checkpoints occur.
     * @since 5.3.0
     */
    WRITE_NO_SYNC = "WRITE_NO_SYNC"
}

/**
 * On premise only: see {@link Durability}
 * A replicated environment makes it possible to increase an application's
 * transaction commit guarantees by committing changes to its replicas on
 * the network. ReplicaAckPolicy defines the policy for how such network
 * commits are handled.
 * @since 5.3.0
 */
export enum ReplicaAckPolicy {
    /**
     * All replicas must acknowledge that they have committed the
     * transaction. This policy should be selected only if your replication
     * group has a small number of replicas, and those replicas are on
     * extremely reliable networks and servers.
     * @since 5.3.0
     */
    ALL = "ALL",

    /**
     * No transaction commit acknowledgments are required and the master
     * will never wait for replica acknowledgments. In this case,
     * transaction durability is determined entirely by the type of commit
     * that is being performed on the master.
     * @since 5.3.0
     */
    NONE = "NONE",
    
    /**
     * A simple majority of replicas must acknowledge that they have
     * committed the transaction. This acknowledgment policy, in
     * conjunction with an election policy which requires at least a simple
     * majority, ensures that the changes made by the transaction remains
     * durable if a new election is held.
     * @since 5.3.0
     */
    SIMPLE_MAJORITY = "SIMPLE_MAJORITY"
}

/**
 * @classdesc
 * On-premises service only.
 * Helper class that defines some useful {@link Durability} constants as well
 * as a method to create {@link Durability} instances. Note that durability
 * instance is a plain JavaScript object as described in {@link Durability}.
 * @see Durability
 */
export class Durabilities {
    /**
     * @hidden
     */
    private constructor();

    /**
     * A convenience constant that defines a durability policy with COMMIT_SYNC
     * for Master commit synchronization.
     * <p>
     * The policies default to COMMIT_NO_SYNC for commits of replicated
     * transactions that need acknowledgment and SIMPLE_MAJORITY for the
     * acknowledgment policy.
     */
    static readonly COMMIT_SYNC: Durability;
 
    /**
     * A convenience constant that defines a durability policy with
     * COMMIT_NO_SYNC for Master commit synchronization.
     * <p>
     * The policies default to COMMIT_NO_SYNC for commits of replicated
     * transactions that need acknowledgment and SIMPLE_MAJORITY for the
     * acknowledgment policy.
     */
    static readonly COMMIT_NO_SYNC: Durability;

    /**
     * A convenience constant that defines a durability policy with
     * COMMIT_WRITE_NO_SYNC for Master commit synchronization.
     * <p>
     * The policies default to COMMIT_NO_SYNC for commits of replicated
     * transactions that need acknowledgment and SIMPLE_MAJORITY for the
     * acknowledgment policy.
     */
    static COMMIT_WRITE_NO_SYNC: Durability;
 
    /**
     * Creates a {@link Durability} instance while validating the arguments
     * passed.
     * 
     * @param {SyncPolicy} masterSync Sync policy when committing transaction
     * on the master node 
     * @param {SyncPolicy} replicaSync Sync policy when committing transaction
     * at a replica node
     * @param {ReplicaAckPolicy} replicaAck The acknowledgment policy used
     * when obtaining transaction acknowledgments from replicas
     * @returns {Durability} Durability object
     * @throws {NoSQLArgumentError} If any of the provided values for
     * <em>masterSync</em>, <em>replicaSync</em> or <em>replicaAck</em> is
     * missing or invalid.
     */
    static create(masterSync: SyncPolicy, replicaSync: SyncPolicy,
        replicaAck: ReplicaAckPolicy): Durability;
}
