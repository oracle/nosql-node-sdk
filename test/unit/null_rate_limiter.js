'use strict';

//Fake rate limiter class for testing

class NullRateLimiter {
    setLimit() {}
    consumeUnits() { return 0; }
    onThrottle() {}
}

module.exports = NullRateLimiter;
