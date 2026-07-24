/*-
 * Copyright (c) 2018, 2026 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { StatsHandler, StatsProfile } from "./config";

/**
 * Controls runtime collection and interval reporting of client statistics.
 *
 * @example
 * ```ts
 * import { NoSQLClient, StatsControl } from "oracle-nosqldb";
 *
 * const client = new NoSQLClient({
 *     endpoint: "localhost:8080",
 *     statsProfile: StatsControl.Profile.REGULAR,
 *     statsInterval: 600,
 *     statsPrettyPrint: false,
 *     statsHandler: stats => {
 *         console.log("Got stats:", stats);
 *     }
 * });
 *
 * const statsControl = client.getStatsControl();
 *
 * // Enable observations.
 * statsControl.start();
 *
 * // Collect more detail around a selected part of the application.
 * statsControl.setProfile(StatsControl.Profile.ALL);
 *
 * // Return to regular request statistics.
 * statsControl.setProfile(StatsControl.Profile.REGULAR);
 *
 * // Disable observations.
 * statsControl.stop();
 *
 * await client.close();
 * ```
 */
export class StatsControl {

    static readonly LOG_PREFIX: "Client stats|";

    static readonly Profile: {
        readonly NONE: "NONE";
        readonly REGULAR: "REGULAR";
        readonly MORE: "MORE";
        readonly ALL: "ALL";
    };

    /**
     * Returns the interval, in seconds, used for periodic stats snapshots.
     */
    getInterval(): number;

    /**
     * Sets the statistics collection profile.
     */
    setProfile(profile: StatsProfile): this;

    /**
     * Returns the current statistics collection profile.
     */
    getProfile(): StatsProfile;

    /**
     * Controls whether logged JSON stats snapshots are pretty-printed.
     */
    setPrettyPrint(prettyPrint: boolean): this;

    /**
     * Returns whether logged JSON stats snapshots are pretty-printed.
     */
    getPrettyPrint(): boolean;

    /**
     * Registers a callback or accept(stats) object for interval snapshots.
     */
    setStatsHandler(handler?: StatsHandler|null): this;

    /**
     * Returns the configured stats handler, if any.
     */
    getStatsHandler(): StatsHandler|null;

    /**
     * Enables stats observations.
     */
    start(): void;

    /**
     * Disables new stats observations.
     */
    stop(): void;

    /**
     * Returns whether stats observations are currently enabled.
     */
    isStarted(): boolean;
}
