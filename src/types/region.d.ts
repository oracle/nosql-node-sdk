/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

import type { Config } from "./config";

/**
 * Cloud service only.
 * <p>
 * This enumeration lists all regions available for Oracle NoSQL Database
 * Cloud Service.
 * {@link https://docs.cloud.oracle.com/iaas/Content/General/Concepts/regions.htm | This page}
 * provides information about Oracle Cloud Infrastracture regions,
 * availability domains and realms.
 * <p>
 * You may use {@link Region} to provide the service endpoint by specifying
 * {@link Config#region} instead of {@link Config#endpoint}. The endpoint will
 * be inferred from the region. Use of a {@link Region} instance is preferred
 * to an endpoint.
 * <p>
 * The string-based endpoints associated with regions for the Oracle NoSQL
 * Database Cloud Service are of the format
 * <pre> https://nosql.\{region\}.oci.\{secondLevelDomain\} </pre>
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
 * {@link Config#endpoint} to the endpoint string.
 *
 * @see {@link Config}
 */
export class Region {

    /**
     * @hidden
     */
    private constructor();

    /**
     * Array of all region values.
     */
    static readonly values: Region[];

    /**
     * Get region by region id.
     * @param {string} regionId Region id, e.g. ap-mumbai-1
     * @return {Region} The region, or <em>undefined</em> if given region id
     * is not found.
     */
    static fromRegionId(regionId: string): Region|undefined;

    /**
     * Get region by region code or id.
     * @param {string} regionId Region id, e.g. bom or ap-mumbai-1
     * @return {Region} The region, or <em>undefined</em> if given region code
     * or id is not found.
     */
    static fromRegionCodeOrId(regionCodeOrId: string): Region|undefined;
    
    /**
     * NoSQL service endpoint for this region.
     */
    readonly endpoint: string;

     /**
     * Region id, e.g. <em>ap-mumbai-1</em>.
     */
    readonly regionId: string;
    
    /**
     * Region 3-letter code, e.g. <em>bom</em>.
     */
    readonly regionCode: string;

    /**
     * Second-level domain for the region, e.g. <em>oraclecloud.com</em>.
     */
    readonly secondLevelDomain: string;

    /**
     * Returns string representing this region.
     * @returns String representation, which is {@link regionId}
     */
    toString(): string;

    /**
     * Realm: OC1, South Africa (Johannesburg)
     */
    static readonly AF_JOHANNESBURG_1: Region;

    /**
     * Realm: OC1, South Korea Central (Seoul)
     */
    static readonly AP_SEOUL_1: Region;

    /**
     * Realm: OC1, Singapore (Singapore)
     */
    static readonly AP_SINGAPORE_1: Region;

    /**
     * Realm: OC1, Japan East (Tokyo)
     */
    static readonly AP_TOKYO_1: Region;

    /**
     * Realm: OC1, India West (Mumbai)
     */
    static readonly AP_MUMBAI_1: Region;

    /**
     * Realm: OC1, Australia East (Sydney)
     */
    static readonly AP_SYDNEY_1: Region;

    /**
     * Realm: OC1, Australia Southeast (Melbourne)
     */
    static readonly AP_MELBOURNE_1: Region;

    /**
     * Realm: OC1, Japan Central (Osaka)
     */
    static readonly AP_OSAKA_1: Region;

    /**
     * Realm: OC1, India South (Hyderabad)
     */
    static readonly AP_HYDERABAD_1: Region;

    /**
     * Realm: OC1, South Korea North (Chuncheon)
     */
    static readonly AP_CHUNCHEON_1: Region;

    /**
     * Realm: OC1, UK South (London)
     */
    static readonly UK_LONDON_1: Region;

    /**
     * Realm: OC1, Germany Central (Frankfurt)
     */
    static readonly EU_FRANKFURT_1: Region;

    /**
     * Realm: OC1, Switzerland North (Zurich)
     */
    static readonly EU_ZURICH_1: Region;

    /**
     * Realm: OC1, Netherlands Northwest (Amsterdam)
     */
    static readonly EU_AMSTERDAM_1: Region;

    /**
     * Realm: OC1, Spain (Madrid)
     */
    static readonly EU_MADRID_1: Region;
    /**
     * Realm: OC1, France (Marseille)
     */
    static readonly EU_MARSEILLE_1: Region;

    /**
     * Realm: OC1, Italy (Milan)
     */
    static readonly EU_MILAN_1: Region;

    /**
     * Realm: OC1, France (Paris)
     */
    static readonly EU_PARIS_1: Region;

    /**
     * Realm: OC1, Sweden (Stockholm)
     */
    static readonly EU_STOCKHOLM_1: Region;

    /**
     * Realm: OC1, Saudi Arabia West (Jeddah)
     */
    static readonly ME_JEDDAH_1: Region;

    /**
     * Realm: OC1, UAE (Abu Dhabi)
     */
    static readonly ME_ABUDHABI_1: Region;
    /**
     * Realm: OC1, UAE East (Dubai)
     */
    static readonly ME_DUBAI_1: Region;

    /**
     * Realm: OC1, Mexico (Queretaro)
     */
    static readonly MX_QUERETARO_1: Region;

    /**
     * Realm: OC1, Mexico (Monterrey)
     */
    static readonly MX_MONTERREY_1: Region;

    /**
     * Realm: OC1, Israel (Jerusalem)
     */
    static readonly IL_JERUSALEM_1: Region;

    /**
     * Realm: OC1, UK West (Newport)
     */
    static readonly UK_CARDIFF_1: Region;

    /**
     * Realm: OC1, US East (Ashburn)
     */
    static readonly US_ASHBURN_1: Region;

    /**
     * Realm: OC1, US West (Phoenix)
     */
    static readonly US_PHOENIX_1: Region;

    /**
     * Realm: OC1, US West (San Jose)
     */
    static readonly US_SANJOSE_1: Region;

    /**
     * Realm: OC1, US Central (Chicago)
     */
    
    static readonly US_CHICAGO_1: Region;
    /**
     * Realm: OC1, Canada Southeast (Toronto)
     */
    
    static readonly CA_TORONTO_1: Region;
    
    /**
     * Realm: OC1, Canada Southeast (Montreal)
     */
    static readonly CA_MONTREAL_1: Region;

    /**
     * Realm: OC1, Brazil East (Sao Paulo)
     */
    static readonly SA_SAOPAULO_1: Region;

    /**
     * Realm: OC1, Chile (Santiago)
     */
    static readonly SA_SANTIAGO_1: Region;

    /**
     * Realm: OC1, Brazil (Vinhedo)
     */
    static readonly SA_VINHEDO_1: Region;

    /**
     * Realm: OC2, US Gov East (Ashburn)
     */
    static readonly US_LANGLEY_1: Region;
    
    /**
     * Realm: OC2, US Gov West (Phoenix)
     */
    static readonly US_LUKE_1: Region;

    /**
     * Realm: OC3, US DoD East (Ashburn)
     */
    static readonly US_GOV_ASHBURN_1: Region;
    
    /**
     * Realm: OC3, US DoD North (Chicago)
     */
    static readonly US_GOV_CHICAGO_1: Region;

    /**
     * Realm: OC3, US DoD West (Phoenix)
     */
    static readonly US_GOV_PHOENIX_1: Region;

    /**
     * Realm: OC4, UK Gov South (London)
     */
    static readonly UK_GOV_LONDON_1: Region;

    /**
     * Realm: OC4, UK Gov West (Cardiff)
     */
    static readonly UK_GOV_CARDIFF_1: Region;

    /**
     * Realm: OC5, US West (Tacoma)
     */
    static readonly US_TACOMA_1: Region;

    /**
     * Realm: OC8, Japan East (Chiyoda)
     */
    static readonly AP_CHIYODA_1: Region;

    /**
     * Realm: OC8, Japan East (Ibaraki)
     * Note: OCI uses "ukb" instead of "ibr"
     */
    static readonly AP_IBARAKI_1: Region;

    /**
     * Realm: OC9, Muscat (Dedicated DataCenter)
     */
    static readonly ME_DCC_MUSCAT_1: Region;

    /**
     * Realm: OC10, Canberra (Dedicated DataCenter)
     */
    static readonly AP_DCC_CANBERRA_1: Region;

    /**
     * Realm: OC14, Milan 1 (Dedicated DataCenter)
     */
    static readonly EU_DCC_MILAN_1: Region;

    /**
     * Realm: OC14, Milan 2 (Dedicated DataCenter)
     */
    static readonly EU_DCC_MILAN_2: Region;

    /**
     * Realm: OC14, Dublin 1 (Dedicated DataCenter)
     */
    static readonly EU_DCC_DUBLIN_1: Region;

    /**
     * Realm: OC14, Dublin 2 (Dedicated DataCenter)
     */
    static readonly EU_DCC_DUBLIN_2: Region;

    /**
     * Realm: OC14, Rating 1 (Dedicated DataCenter)
     */
    static readonly EU_DCC_RATING_1: Region;

    /**
     * Realm: OC14, Rating 2 (Dedicated DataCenter)
     */
    static readonly EU_DCC_RATING_2: Region;

    /**
     * Realm: OC16, Utah
     */
    static readonly US_WESTJORDAN_1: Region;

    /**
     * Realm: OC17, Phoenix 1 (Dedicated DataCenter)
     */
    static readonly US_DCC_PHOENIX_1: Region;

    /**
     * Realm: OC17, Phoenix 2 (Dedicated DataCenter)
     */
    static readonly US_DCC_PHOENIX_2: Region;

    /**
     * Realm: OC17, Phoenix 4 (Dedicated DataCenter)
     */
    static readonly US_DCC_PHOENIX_4: Region;

    /**
     * Realm: OC19, Frankfurt Germany
     */
    static readonly EU_FRANKFURT_2: Region;

    /**
     * Realm: OC19, Madrid Spain
     */
    static readonly EU_MADRID_2: Region;

    /**
     * Realm: OC20, Jovanovac (Serbia)
     */
    static readonly EU_JOVANOVAC_1: Region;
}
