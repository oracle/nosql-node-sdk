/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

const assert = require('assert');

const isPosInt32OrZero = require('../../utils').isPosInt32OrZero;
const Utils = require('./utils');

//Base class for providers that cache profile.
//Derived classes need to implement the following:
//this._profile - currently cached profile
//this._isCurrentProfileValid() - if current profile is valid, only called
//when this._profile exists
//async this._doRefresh() - refreshes current profile and related data
class CachedProfileProvider {

    isProfileValid(profile) {
        assert(profile != null);
        return profile === this._profile && this._isCurrentProfileValid();
    }

    async getProfile(needRefresh) {
        if (needRefresh || this._profile == null ||
            !this._isCurrentProfileValid()) {
            await this._doRefresh(needRefresh);
        }

        return this._profile;
    }
}

//Base class for providers that allow refreshing profile in the background.
//Derived classes need to implement the following:
//this._profile - currently cached profile
//this._refreshAheadMs - (optional) interval in ms before expiration when to
//do background refresh
//this._isCurrentProfileValid() - if current profile is valid
//this._getCurrentDuration() - get duration in ms of current profile, assuming
//it was just retrieved and is valid
//async this._refreshProfile() - refresh of the profile in
//foreground or background
class RefreshableProfileProvider extends CachedProfileProvider {

    async _doRefresh(isBackground) {
        //Avoid multiple concurrent requests for profile refresh.
        if (this._profilePromise == null) {
            this._profilePromise = this._refreshProfile();
        }
        try {
            await this._profilePromise;
        } catch(err) {
            if (isBackground) {
                //If error occurred during background refresh, we don't throw
                //and don't reschedule next refresh.
                return;
            } else {
                throw err;
            }
        } finally {
            if (this._refreshTimer != null) {
                clearTimeout(this._refreshTimer);
            }
            this._profilePromise = null;
        }

        if (!this._refreshAheadMs) {
            return;
        }

        const dur = this._getCurrentDuration();
        if (!Number.isFinite(dur)) {
            return;
        }
        
        const refreshInterval = dur - this._refreshAheadMs;
        if (refreshInterval <= 0) {
            return;
        }

        this._refreshTimer = setTimeout(
            () => this._refreshProfile(true, true), refreshInterval);
    }

    close() {
        if (this._refreshTimer != null) {
            clearTimeout(this._refreshTimer);
            this._refreshTimer = null;
        }
    }
}

//Base class for security token-based providers that allow refresh in the
//background.
//Derived classes need to implement the following:
//async this._getSecurityToken() - retrieve security token
//this._getPrivateKey() - get private key for the profile
//this._profileExtraInit() - (optional) Initialize other properties in the
//current profile (this._profile), other than keyId and privateKey
class RefreshableTokenProvider extends RefreshableProfileProvider {
    
    constructor(opt) {
        super();
        assert (opt != null);
        this._refreshAheadMs = opt.securityTokenRefreshAheadMs;
        assert(isPosInt32OrZero(this._refreshAheadMs));
        this._expireBeforeMs = opt.securityTokenExpireBeforeMs;
        assert(isPosInt32OrZero(this._expireBeforeMs));
    }

    async _refreshProfile() {
        const val = await this._getSecurityToken();
        this._token = Utils.parseSecurityToken(val);
        this._profile = {
            keyId: 'ST$' + this._token.value,
            privateKey: this._getPrivateKey()
        };
        this._profileExtraInit();
    }

    //only called when this._profile exists
    _isCurrentProfileValid() {
        assert(this._token != null);
        return Utils.isSecurityTokenValid(this._token, this._expireBeforeMs);
    }

    _getCurrentDuration() {
        return Utils.getSecurityTokenExpiration(this._token,
            this._expireBeforeMs) - Date.now();
    }

    _profileExtraInit() {}
}

module.exports = {
    CachedProfileProvider,
    RefreshableProfileProvider,
    RefreshableTokenProvider
};
