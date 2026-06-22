/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { StatsHandler, StatsLatencyPercentileMode, StatsProfile } from
    "./config";

/**
 * Controls runtime collection and interval reporting of client statistics.
 */
export class StatsControl {

    static readonly LOG_PREFIX: "Client stats|";

    static readonly DEFAULT_INTERVAL: 600;

    static readonly Profile: {
        readonly NONE: "NONE";
        readonly REGULAR: "REGULAR";
        readonly MORE: "MORE";
        readonly ALL: "ALL";
    };

    static readonly LatencyPercentileMode: {
        readonly EXACT: "EXACT";
        readonly BUCKETED: "BUCKETED";
    };

    getInterval(): number;

    setInterval(interval: number): this;

    setStatsInterval(interval: number): this;

    setProfile(profile: StatsProfile): this;

    getProfile(): StatsProfile;

    getLatencyPercentileMode(): StatsLatencyPercentileMode;

    setPrettyPrint(prettyPrint: boolean): this;

    getPrettyPrint(): boolean;

    setStatsEnableLog(enableLog: boolean): this;

    getStatsEnableLog(): boolean;

    setStatsHandler(handler?: StatsHandler|null): this;

    getStatsHandler(): StatsHandler|null;

    start(): this;

    stop(): this;

    isStarted(): boolean;

    getId(): string;

    generateStats(): object;

    logStats(): object;

    clear(): this;
}
