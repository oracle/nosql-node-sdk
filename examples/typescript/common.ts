/*-
 * Copyright (c) 2018, 2024 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

import { ConsumedCapacity, PutOpResult, DeleteOpResult }
    from "oracle-nosqldb";

import Decimal from "decimal.js";

export interface PurchaseOrder {
    seller: string;
    orderId: number;
    customerName: string;
    shipAddress: {
        street: string;
        city: string;
    };
    shipDate: Date;
    items: {
        id: number;
        name: string;
        price: Decimal;
    }[];
}

export function printConsumedCapacity(cc?: ConsumedCapacity) {
    if (cc) {
        console.log("Operation consumed: %d read units, %d read KB, \
%d write units, %d write KB", cc.readUnits, cc.readKB, cc.writeUnits,
        cc.writeKB);
    }
}

export function printPutOrDeleteOpResult(
    res: PutOpResult<PurchaseOrder> | DeleteOpResult<PurchaseOrder>): void {
    console.log("Success: %s", res.success);
    if (!res.success) {
        if (res.existingRow) {
            console.log("Existing row: %o", res.existingRow);
        }
        if (res.existingModificationTime) {
            console.log("Existing modification time: %o",
            res.existingModificationTime);
        }
    }

    console.log();
}
