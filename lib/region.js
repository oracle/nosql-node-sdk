/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
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
        realmId: 'oc4',
        secondLevelDomain: 'oraclegovcloud.uk'
    },
    OC5: {
        realmId: 'oc5',
        secondLevelDomain: 'oraclecloud5.com'
    },
    OC8: {
        realmId: 'oc8',
        secondLevelDomain: 'oraclecloud8.com'
    },
    OC9: {
        realmId: 'oc9',
        secondLevelDomain: 'oraclecloud9.com'
    },
    OC10: {
        realmId: 'oc10',
        secondLevelDomain: 'oraclecloud10.com'
    },
    OC14: {
        realmId: 'oc14',
        secondLevelDomain: 'oraclecloud14.com'
    },
    OC15: {
        realmId: 'oc15',
        secondLevelDomain: 'oraclecloud15.com'
    },
    OC16: {
        realmId: 'oc16',
        secondLevelDomain: 'oraclecloud16.com'
    },
    OC17: {
        realmId: 'oc17',
        secondLevelDomain: 'oraclecloud17.com'
    },
    OC19: {
        realmId: 'oc19',
        secondLevelDomain: 'oraclecloud.eu'
    },
    OC20: {
        realmId: 'oc20',
        secondLevelDomain: 'oraclecloud20.com'
    },
    OC21: {
        realmId: 'oc21',
        secondLevelDomain: 'oraclecloud21.com'
    },
    OC22: {
        realmId: 'oc22',
        secondLevelDomain: 'psn-pco.it'
    },
    OC24: {
        realmId: 'oc24',
        secondLevelDomain: 'oraclecloud24.com'
    },
    OC25: {
        realmId: 'oc25',
        secondLevelDomain: 'nricloud.jp'
    },
    OC26: {
        realmId: 'oc26',
        secondLevelDomain: 'oraclecloud26.com'
    },
    OC27: {
        realmId: 'oc27',
        secondLevelDomain: 'oraclecloud27.com'
    },
    OC28: {
        realmId: 'oc28',
        secondLevelDomain: 'oraclecloud28.com'
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

    toString() {
        return this._regionId;
    }
}

/**
 * Realm: OC1, South Africa (Johannesburg)
 */
Region.AF_JOHANNESBURG_1 = new Region('af-johannesburg-1', 'jnb', Realms.OC1);

/**
 * Realm: OC1, South Korea Central (Seoul)
 */
Region.AP_SEOUL_1 = new Region('ap-seoul-1', 'icn', Realms.OC1);

/**
 * Realm: OC1, Singapore (Singapore)
 */
Region.AP_SINGAPORE_1 = new Region('ap-singapore-1', 'sin', Realms.OC1);

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
 * Realm: OC1, Spain (Madrid)
 */
Region.EU_MADRID_1 = new Region('eu-madrid-1', 'mad', Realms.OC1);

/**
 * Realm: OC1, France (Marseille)
 */
Region.EU_MARSEILLE_1 = new Region('eu-marseille-1', 'mrs', Realms.OC1);

/**
 * Realm: OC1, Italy (Milan)
 */
Region.EU_MILAN_1 = new Region('eu-milan-1', 'lin', Realms.OC1);

/**
 * Realm: OC1, France (Paris)
 */
Region.EU_PARIS_1 = new Region('eu-paris-1', 'cdg', Realms.OC1);

/**
 * Realm: OC1, Sweden (Stockholm)
 */
Region.EU_STOCKHOLM_1 = new Region('eu-stockholm-1', 'arn', Realms.OC1);

/**
 * Realm: OC1, Saudi Arabia West (Jeddah)
 */
Region.ME_JEDDAH_1 = new Region('me-jeddah-1', 'jed', Realms.OC1);

/**
 * Realm: OC1, UAE (Abu Dhabi)
 */
Region.ME_ABUDHABI_1 = new Region('me-abudhabi-1', 'auh', Realms.OC1);

/**
 * Realm: OC1, UAE East (Dubai)
 */
Region.ME_DUBAI_1 = new Region('me-dubai-1', 'dxb', Realms.OC1);

/**
 * Realm: OC1, Mexico (Queretaro)
 */
Region.MX_QUERETARO_1 = new Region('mx-queretaro-1', 'qro', Realms.OC1);

/**
 * Realm: OC1, Mexico (Monterrey)
 */
Region.MX_MONTERREY_1 = new Region('mx-monterrey-1', 'mty', Realms.OC1);

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
 * Realm: OC1, US Central (Chicago)
 */
Region.US_CHICAGO_1 = new Region('us-chicago-1', 'ord', Realms.OC1);

/**
 * Realm: OC1, US West (Salt Lake)
 */
Region.US_SALTLAKE_2 = new Region('us-saltlake-2', 'aga', Realms.OC1);

/**
 * Realm: OC1, Canada Southeast (Toronto)
 */
Region.CA_TORONTO_1 = new Region('ca-toronto-1', 'yyz', Realms.OC1);

/**
 * Realm: OC1, Canada Southeast (Montreal)
 */
Region.CA_MONTREAL_1 = new Region('ca-montreal-1', 'yul', Realms.OC1);

/**
 * Realm: OC1, Colombia (Bogota)
 */
Region.SA_BOGOTA_1 = new Region('sa-bogota-1', 'bog', Realms.OC1);

/**
 * Realm: OC1, Brazil East (Sao Paulo)
 */
Region.SA_SAOPAULO_1 = new Region('sa-saopaulo-1', 'gru', Realms.OC1);

/**
 * Realm: OC1, Chile (Santiago)
 */
Region.SA_SANTIAGO_1 = new Region('sa-santiago-1', 'scl', Realms.OC1);

/**
 * Realm: OC1, Chile (Valparaiso)
 */
Region.SA_VALPARAISO_1 = new Region('sa-valparaiso-1', 'vap', Realms.OC1);

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
 * Realm: OC5, US West (Tacoma)
 */
Region.US_TACOMA_1 = new Region('us-tacoma-1', 'tiw', Realms.OC5);

/**
 * Realm: OC8, Japan East (Chiyoda)
 */
Region.AP_CHIYODA_1 = new Region('ap-chiyoda-1', 'nja', Realms.OC8);

/**
 * Realm: OC8, Japan East (Ibaraki)
 * Note: OCI uses "ukb" instead of "ibr"
 */
Region.AP_IBARAKI_1 = new Region('ap-ibaraki-1', 'ukb', Realms.OC8);

/**
 * Realm: OC9, Muscat (Dedicated DataCenter)
 */
Region.ME_DCC_MUSCAT_1 = new Region('me-dcc-muscat-1', 'mct', Realms.OC9);

/**
 * Realm: OC10, Canberra (Dedicated DataCenter)
 */
Region.AP_DCC_CANBERRA_1 = new Region('ap-dcc-canberra-1', 'wga', Realms.OC10);

/**
 * Realm: OC14, Milan 1 (Dedicated DataCenter)
 */
Region.EU_DCC_MILAN_1 = new Region('eu-dcc-milan-1', 'bgy', Realms.OC14);

/**
 * Realm: OC14, Milan 2 (Dedicated DataCenter)
 */
Region.EU_DCC_MILAN_2 = new Region('eu-dcc-milan-2', 'mxp', Realms.OC14);


/**
 * Realm: OC14, Dublin 1 (Dedicated DataCenter)
 */
Region.EU_DCC_DUBLIN_1 = new Region('eu-dcc-dublin-1', 'ork', Realms.OC14);

/**
 * Realm: OC14, Dublin 2 (Dedicated DataCenter)
 */
Region.EU_DCC_DUBLIN_2 = new Region('eu-dcc-dublin-2', 'snn', Realms.OC14);

/**
 * Realm: OC14, Rating 1 (Dedicated DataCenter)
 */
Region.EU_DCC_RATING_1 = new Region('eu-dcc-rating-1', 'dus', Realms.OC14);

/**
 * Realm: OC14, Rating 2 (Dedicated DataCenter)
 */
Region.EU_DCC_RATING_2 = new Region('eu-dcc-rating-2', 'dtm', Realms.OC14);

/**
 * Realm: OC15, Bangladesh
 */
Region.AP_DCC_GAZIPUR_1 = new Region('ap-dcc-gazipur-1', 'dac', Realms.OC15);

/**
 * Realm: OC16, Utah
 */
Region.US_WESTJORDAN_1 = new Region('us-westjordan-1', 'sgu', Realms.OC16);

/**
 * Realm: OC17, Phoenix 1 (Dedicated DataCenter)
 */
Region.US_DCC_PHOENIX_1 = new Region('us-dcc-phoenix-1', 'ifp', Realms.OC17);

/**
 * Realm: OC17, Phoenix 2 (Dedicated DataCenter)
 */
Region.US_DCC_PHOENIX_2 = new Region('us-dcc-phoenix-2', 'gcn', Realms.OC17);

/**
 * Realm: OC17, Phoenix 4 (Dedicated DataCenter)
 */
Region.US_DCC_PHOENIX_4 = new Region('us-dcc-phoenix-4', 'yum', Realms.OC17);

/**
 * Realm: OC19, Frankfurt Germany
 */
Region.EU_FRANKFURT_2 = new Region('eu-frankfurt-2', 'str', Realms.OC19);

/**
 * Realm: OC19, Madrid Spain
 */
Region.EU_MADRID_2 = new Region('eu-madrid-2', 'vll', Realms.OC19);

/**
 * Realm: OC20, Jovanovac (Serbia)
 */
Region.EU_JOVANOVAC_1 = new Region('eu-jovanovac-1', 'beg', Realms.OC20);

/**
 * Realm: OC21, Doha (Qatar)
 */
Region.ME_DCC_DOHA_1 = new Region('me-dcc-doha-1', 'doh', Realms.OC21);

/**
 * Realm: OC22, Italy dedicated (Rome)
 */
Region.EU_DCC_ROME_1 = new Region('eu-dcc-rome-1', 'nap', Realms.OC22);

/**
 * Realm: OC24, Switzerland dedicated (Zurich)
 */
Region.EU_DCC_ZURICH_1 = new Region('eu-dcc-zurich-1', 'avz', Realms.OC24);

/**
 * Realm: OC25, Japan dedicated (Tokyo)
 */
Region.AP_DCC_TOKYO_1 = new Region('ap-dcc-tokyo-1', 'tyo', Realms.OC25);

/**
 * Realm: OC26, Abudhabi
 */
Region.ME_ABUDHABI_3 = new Region('me-abudhabi-3', 'ahu', Realms.OC26);

/**
 * Realm: OC27, SWJordan dedicated (Utah USA)
 */
Region.US_DCC_SWJORDAN_1 = new Region('us-dcc-swjordan-1', 'ozz', Realms.OC27);

/**
 * Realm: OC28, SWJordan dedicated (Utah USA)
 */
Region.US_DCC_SWJORDAN_2 = new Region('us-dcc-swjordan-2', 'drs', Realms.OC28);

Region.seal();

module.exports = Region;
