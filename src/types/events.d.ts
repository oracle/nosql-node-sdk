/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { EventEmitter } from "stream";
import type { TableState } from "./constants";
import type { NoSQLError } from "./error";
import type { Operation } from "./param";
import type { ConsumedCapacity } from "./result";

/**
 * This interface describes the events emitted by {@link NoSQLClient}
 */
export interface NoSQLClientEvents {
    /**
     * NoSQLClient error event.
     *
     * Emitted when any {@link NoSQLClient} method results in error.  This
     * event is not emitted when automatic retries are performed, only when
     * the error is final.
     * <p>
     * Also mote that this event will not be emitted if it has no listeners,
     * so it is not necessary to subscribe to it.
     *
     * @event
     * @param {NoSQLError} err Error of type NoSQLError or one of its subclasses
     * @param {Operation} op Object describing operation that
     * caused the error, see {@link Operation}
     */
    error(err: NoSQLError, op: Operation): void;

    /**
     * NoSQLClient retryable event.
     *
     * Emitted when error from {@link NoSQLClient} operation will result in
     * automatic retry of operation.  It will be emitted on each subsequent
     * retry.
     * @see {@link RetryConfig} for explanation of retries
     *
     * @event
     * @param {NoSQLError} err Error of type NoSQLError or one of its
     * subclasses that caused the retry
     * @param {Operation} op Object describing operation that caused the
     * error, see {@link Operation}
     * @param {number} numRetries Number of retries performed so far for this
     * operation, not counting the original API invokation or the retry about
     * to be performed
     */
    retryable(err: NoSQLError, op: Operation, numRetries: number): void;

    /**
     * NoSQLClient consumedCapacity event.
     *
     * Emitted by {@link NoSQLClient} method calls that return
     * {@link ConsumedCapacity} as part of their result.  These methods
     * include all data manipulation and query methods.  This event may be
     * used to calculate relevant statistsics.
     *
     * @event
     * @param {ConsumedCapacity} consumedCapacity Capacity consumed by the
     * method call, {@link ConsumedCapacity}
     * @param {Operation} op Object describing operation that returned this
     * consumed capacity, see {@link Operation}
     */
    consumedCapacity(consumedCapacity: ConsumedCapacity, op: Operation): void;

    /**
     * NoSQLClient tableState event.
     *
     * Emitted by {@link NoSQLClient} method calls that return table state as
     * part of their result, such as {@link NoSQLClient#getTable},
     * {@link NoSQLClient#tableDDL} and {@link NoSQLClient#setTableLimits} and
     * also while table is polled waiting for DDL operation completion using
     * {@link NoSQLClient#forCompletion}.  Can be used to perform actions on a
     * table reaching certain state.  Note that this event may be emitted
     * mutliple times even while the table state did not change.
     *
     * @event
     * @param {string} tableName Table name
     * @param {TableState} tableState Current table state, see
     * {@link TableState}
     */
    tableState(tableName: string, tableState: TableState): void;
}

declare module "nosql_client" {
    export interface NoSQLClient extends EventEmitter {
        on<EvName extends keyof NoSQLClientEvents>(event: EvName,
            listener: NoSQLClientEvents[EvName]): this;
    }
}
