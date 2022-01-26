/*-
 * Copyright (c) 2018, 2022 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

const Enum = require('./constants').Enum;

const Realms = {
    OC1: {
        realmId: 'oc1',
        secondLevelDomain: 'oraclecloud.com'
    },
    OC2: {
        realmId: 'oc2',
        secondLevelDomain: 'oraclegovcloud.com'
    },
    OC3: {
        realmId: 'oc3',
        secondLevelDomain: 'oraclegovcloud.com'
    },
    OC4: {
        realmId: 'oc3',
        secondLevelDomain: 'oraclegovcloud.uk'
    },
    OC8: {
        realmId: 'oc8',
        secondLevelDomain: 'oraclecloud8.com'
    }
};

/**
 * Cloud service only.
 * <p>
 * This enumeration lists all regions available for Oracle NoSQL Database
 * Cloud Service.
 * [This page]{@link https://docs.cloud.oracle.com/iaas/Content/General/Concepts/regions.htm}
 * provides information about Oracle Cloud Infrastracture regions,
 * availability domains and realms.
 * <p>
 * You may use {@link Region} to provide the service endpoint by specifying
 * {@link Config}#region instead of {@link Config}#endpoint. The endpoint will
 * be inferred from the region. Use of a {@link Region} instance is preferred
 * to an endpoint.
 * <p>
 * The string-based endpoints associated with regions for the Oracle NoSQL
 * Database Cloud Service are of the format
 * <pre>    https://nosql.{region}.oci.{secondLevelDomain} </pre>
 * Examples of known second level domains include:
 * <ul>
 * <li>oraclecloud.com</li>
 * <li>oraclegovcloud.com</li>
 * <li>oraclegovcloud.uk</li>
 * </ul>
 * For example, this is a valid endpoint for the Oracle NoSQL Database Cloud
 * Service in the U.S. East region
 * <pre>    nosql.us-ashburn-1.oci.oraclecloud.com </pre>
 * If the Oracle NoSQL Database Cloud Service becomes available in a region
 * not listed here it is possible to connect to that region by setting
 * {@link Config}#endpoint to the endpoint string.
 *
 * @extends Enum
 * @hideconstructor
 *
 * @see {@link Config}
 */
class Region extends Enum {
    constructor(regionId, regionCode, realm) {
        super();
        this._regionId = regionId;
        this._regionCode = regionCode;
        this._realm = realm;
    }

    //currently only called by Config._init()
    static fromRegionId(regionId) {
        return Region[regionId.replace(/-/g, '_').toUpperCase()];
    }

    static fromRegionCodeOrId(regionCodeOrId) {
        const res = Region.find(r =>
            r._regionCode === regionCodeOrId.toLowerCase());
        return res != null ? res : Region.fromRegionId(regionCodeOrId);
    }

    get regionId() {
        return this._regionId;
    }

    get regionCode() {
        return this._regionCode;
    }

    get secondLevelDomain() {
        return this._realm.secondLevelDomain;
    }

    /**
     * NoSQL service endpoint for this region.
     * @type {string}
     * @readonly
     */
    get endpoint() {
        return `https://nosql.${this._regionId}.oci.${this._realm.secondLevelDomain}`;
    }
}

/**
 * Realm: OC1, South Korea Central (Seoul)
 */
Region.AP_SEOUL_1 = new Region('ap-seoul-1', 'icn', Realms.OC1);

/**
 * Realm: OC1, Japan East (Tokyo)
 */
Region.AP_TOKYO_1 = new Region('ap-tokyo-1', 'nrt', Realms.OC1);

/**
 * Realm: OC1, India West (Mumbai)
 */
Region.AP_MUMBAI_1 = new Region('ap-mumbai-1', 'bom', Realms.OC1);

/**
 * Realm: OC1, Australia East (Sydney)
 */
Region.AP_SYDNEY_1 = new Region('ap-sydney-1', 'syd', Realms.OC1);

/**
 * Realm: OC1, Australia Southeast (Melbourne)
 */
Region.AP_MELBOURNE_1 = new Region('ap-melbourne-1', 'mel', Realms.OC1);

/**
 * Realm: OC1, Japan Central (Osaka)
 */
Region.AP_OSAKA_1 = new Region('ap-osaka-1', 'kix', Realms.OC1);

/**
 * Realm: OC1, India South (Hyderabad)
 */
Region.AP_HYDERABAD_1 = new Region('ap-hyderabad-1', 'hyd', Realms.OC1);

/**
 * Realm: OC1, South Korea North (Chuncheon)
 */
Region.AP_CHUNCHEON_1 = new Region('ap-chuncheon-1', 'yny', Realms.OC1);

/**
 * Realm: OC1, UK South (London)
 */
Region.UK_LONDON_1 = new Region('uk-london-1', 'lhr', Realms.OC1);

/**
 * Realm: OC1, Germany Central (Frankfurt)
 */
Region.EU_FRANKFURT_1 = new Region('eu-frankfurt-1', 'fra', Realms.OC1);

/**
 * Realm: OC1, Switzerland North (Zurich)
 */
Region.EU_ZURICH_1 = new Region('eu-zurich-1', 'zrh', Realms.OC1);

/**
 * Realm: OC1, Netherlands Northwest (Amsterdam)
 */
Region.EU_AMSTERDAM_1 = new Region('eu-amsterdam-1', 'ams', Realms.OC1);

/**
 * Realm: OC1, Italy (Milan)
 */
Region.EU_MILAN_1 = new Region('eu-milan-1', 'lin', Realms.OC1);

/**
 * Realm: OC1, Saudi Arabia West (Jeddah)
 */
Region.ME_JEDDAH_1 = new Region('me-jeddah-1', 'jed', Realms.OC1);

/**
 * Realm: OC1, UAE East (Dubai)
 */
Region.ME_DUBAI_1 = new Region('me-dubai-1', 'dxb', Realms.OC1);

/**
 * Realm: OC1, Israel (Jerusalem)
 */
Region.IL_JERUSALEM_1 = new Region('il-jerusalem-1', 'mtz', Realms.OC1);

/**
 * Realm: OC1, UK West (Newport)
 */
Region.UK_CARDIFF_1 = new Region('uk-cardiff-1', 'cwl', Realms.OC1);

/**
 * Realm: OC1, US East (Ashburn)
 */
Region.US_ASHBURN_1 = new Region('us-ashburn-1', 'iad', Realms.OC1);

/**
 * Realm: OC1, US West (Phoenix)
 */
Region.US_PHOENIX_1 = new Region('us-phoenix-1', 'phx', Realms.OC1);

/**
 * Realm: OC1, US West (San Jose)
 */
Region.US_SANJOSE_1 = new Region('us-sanjose-1', 'sjc', Realms.OC1);

/**
 * Realm: OC1, Canada Southeast (Toronto)
 */
Region.CA_TORONTO_1 = new Region('ca-toronto-1', 'yyz', Realms.OC1);

/**
 * Realm: OC1, Canada Southeast (Montreal)
 */
Region.CA_MONTREAL_1 = new Region('ca-montreal-1', 'yul', Realms.OC1);

/**
 * Realm: OC1, Brazil East (Sao Paulo)
 */
Region.SA_SAOPAULO_1 = new Region('sa-saopaulo-1', 'gru', Realms.OC1);

/**
 * Realm: OC1, Chile (Santiago)
 */
Region.SA_SANTIAGO_1 = new Region('sa-santiago-1', 'scl', Realms.OC1);

/**
 * Realm: OC1, Brazil (Vinhedo)
 */
Region.SA_VINHEDO_1 = new Region('sa-vinhedo-1', 'vcp', Realms.OC1);

/**
 * Realm: OC2, US Gov East (Ashburn)
 */
Region.US_LANGLEY_1 = new Region('us-langley-1', 'lfi', Realms.OC2);

/**
 * Realm: OC2, US Gov West (Phoenix)
 */
Region.US_LUKE_1 = new Region('us-luke-1', 'luf', Realms.OC2);

/**
 * Realm: OC3, US DoD East (Ashburn)
 */
Region.US_GOV_ASHBURN_1 = new Region('us-gov-ashburn-1', 'ric', Realms.OC3);

/**
 * Realm: OC3, US DoD North (Chicago)
 */
Region.US_GOV_CHICAGO_1 = new Region('us-gov-chicago-1', 'pia', Realms.OC3);

/**
 * Realm: OC3, US DoD West (Phoenix)
 */
Region.US_GOV_PHOENIX_1 = new Region('us-gov-phoenix-1', 'tus', Realms.OC3);

/**
 * Realm: OC4, UK Gov South (London)
 */
Region.UK_GOV_LONDON_1 = new Region('uk-gov-london-1', 'ltn', Realms.OC4);

/**
 * Realm: OC4, UK Gov West (Cardiff)
 */
Region.UK_GOV_CARDIFF_1 = new Region('uk-gov-cardiff-1', 'brs', Realms.OC4);

/**
 * Realm: OC8, Japan East (Chiyoda)
 */
Region.AP_CHIYODA_1 = new Region('ap-chiyoda-1', 'nja', Realms.OC8);

/**
 * Realm: OC8, Japan East (Ibaraki)
 * Note: OCI uses "ukb" instead of "ibr"
 */
Region.AP_IBARAKI_1 = new Region('ap-ibaraki-1', 'ukb', Realms.OC8);

Region.seal();

module.exports = Region;
