/*-
 * Copyright (c) 2018, 2025 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { StatsHandler, StatsProfile } from "./config";

/**
 * Controls runtime collection and interval reporting of client statistics.
 */
export class StatsControl {

    static readonly LOG_PREFIX: "Client stats|";

    static readonly Profile: {
        readonly NONE: "NONE";
        readonly REGULAR: "REGULAR";
        readonly MORE: "MORE";
        readonly ALL: "ALL";
    };

    getInterval(): number;

    setProfile(profile: StatsProfile): this;

    getProfile(): StatsProfile;

    setPrettyPrint(prettyPrint: boolean): this;

    getPrettyPrint(): boolean;

    setStatsHandler(handler?: StatsHandler|null): this;

    getStatsHandler(): StatsHandler|null;

    start(): this;

    stop(): this;

    isStarted(): boolean;
}
