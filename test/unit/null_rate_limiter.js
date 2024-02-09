/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

//Fake rate limiter class for testing

class NullRateLimiter {
    setLimit() {}
    consumeUnits() { return 0; }
    onThrottle() {}
}

module.exports = NullRateLimiter;
