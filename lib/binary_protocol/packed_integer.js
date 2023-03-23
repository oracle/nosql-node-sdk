/*-
 * Copyright (c) 2018, 2023 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at
 *  https://oss.oracle.com/licenses/upl/
 */

'use strict';

/**
 * NOTE: this is cut/paste/edited from JE's class of the same name. An
 * important difference is that the packed values returned are ALWAYS
 * sorted. The unsorted methods supported by JE for compatibility are not
 * included.
 *
 * Static methods for reading and writing packed integers.
 */

const assert = require('assert');
const isInt32 = require('../utils').isInt32;
const NoSQLArgumentError = require('../error').NoSQLArgumentError;

//Avoid ReferenceError(s) below in case bigint is not supported.
const BigIntCons = typeof BigInt === 'function' ? BigInt : Number;

//We are not using bigint literals to avoid syntax errors if bigint is not
//supported.
const INT32_MIN = -2147483648; // -2^31
const INT32_MAX = 2147483647; // 2^31 - 1
const INT32_RANGE = 0x100000000; // 2^32
const INT32_RANGE_BIGINT = BigIntCons(0x100000000); // 2^32n
const INT64_BIGINT_MIN = BigIntCons('-9223372036854775808'); // -2^63
const INT64_BIGINT_MAX = BigIntCons('9223372036854775807'); // 2^63 - 1

//Saving these instead of instantiating every time does improve performance
//according to benchmark.
const BIGINT_119 = BigIntCons(119);
const BIGINT_121 = BigIntCons(121);

/**
 * In JavaScript, number can represent integer up to 53 bits long (not
 * including the sign).  These numbers are called safe integers since they
 * can be represented without loss of precision.  The number is in double
 * precision format and thus cannot directly serialize to 2-complement
 * integer or long format.  Bitwise operations on number will treat it as
 * signed 32-bit integer and thus it would be truncated accordingly.
 * The functions below allow to split safe integer into 2 numbers, each of
 * which is a signed 32-bit integer such that if each of these integers is
 * represented in 2-complement format, their combined (appended)
 * representation would be that of a 2-complement format of 64-bit signed
 * long integer representing original number.  This will allow us to
 * perform bitwise operations on the number as if it was 64-bit signed long
 * integer, by performing these operations on each of 2 constituent parts.
 * The results can be combined to represent resulting long integer as number
 * (as long as it is within the safe integer range).
 */
class Int64 {

    static _to2sComplement(valueL, valueR, isNegative) {
        if (!isNegative) {
            assert(isInt32(valueL));
            valueR = ~~valueR;
        } else {
            valueL = ~valueL;
            valueR = ~valueR + 1;
            if (valueR === 0) {
                //if ~valueR was -1 we have to carry 1 to the left side
                valueL++;
            }
        }
        return { valueL, valueR };
    }

    static _splitNumber(value) {
        const isNegative = value < 0;
        if (isInt32(value)) {
            return {
                valueL: isNegative ? -1 : 0,
                valueR: value
            };
        }

        if (isNegative) {
            value = -value;
        }

        const valueL = Math.floor(value / INT32_RANGE);
        const valueR = value % INT32_RANGE;

        return Int64._to2sComplement(valueL, valueR, isNegative);
    }

    static _splitBigInt(value) {
        const isNegative = value < 0;
        if (value >= INT32_MIN && value <= INT32_MAX) {
            return {
                valueL: isNegative ? -1 : 0,
                valueR: Number(value)
            };
        }

        if (isNegative) {
            value = -value;
        }

        const valueL = Number(value / INT32_RANGE_BIGINT);
        const valueR = Number(value % INT32_RANGE_BIGINT);

        return Int64._to2sComplement(valueL, valueR, isNegative);
    }

    static split(value) {
        return typeof value === 'bigint' ?
            Int64._splitBigInt(value) : Int64._splitNumber(value);
    }

    static combine(valueL, valueR, toBigInt = false) {
        assert(isInt32(valueL));
        assert(isInt32(valueR));

        if (valueL < 0) { //negative
            valueL++;
            if (valueR > 0) {
                valueR -= INT32_RANGE;
            }
        } else if (valueR < 0) { //positive, adjust valueR to unsigned
            valueR += INT32_RANGE;
        }

        return toBigInt ?
            BigIntCons(valueL) * INT32_RANGE_BIGINT + BigIntCons(valueR) :
            valueL * INT32_RANGE + valueR;
    }
}

class PackedInteger {

    /**
     * The maximum number of bytes needed to store an int value (5).
     */
    static get MAX_LENGTH() { return 5; }

    /**
     * The maximum number of bytes needed to store a long value (9).
     */
    static get MAX_LONG_LENGTH() { return 9; }

    /**
     * Reads a sorted packed integer at the given buffer offset and returns it.
     *
     * @param buf the buffer to read from.
     *
     * @param off the offset in the buffer at which to start reading.
     *
     * @return the integer that was read.
     */
    static readSortedInt(buf, off) {

        let byteLen;
        let negative;

        /* The first byte of the buf stores the length of the value part. */
        let b1 = buf.readUInt8(off++);
        /* Adjust the byteLen to the real length of the value part. */
        if (b1 < 0x08) {
            byteLen = 0x08 - b1;
            negative = true;
        } else if (b1 > 0xf7) {
            byteLen = b1 - 0xf7;
            negative = false;
        } else {
            return { value: b1 - 127, off };
        }

        /*
        * The following bytes on the buf store the value as a big endian
        * integer. We extract the significant bytes from the buf and put them
        * into the value in big endian order.
        *
        * Note that unlike in Java, we don't need to do (buf[off++] & 0xff)
        * if we read the byte as unsigned 8-bit integer.
        */
        let value;
        if (negative) {
            value = -1;
        } else {
            value = 0;
        }
        if (byteLen > 3) {
            value = (value << 8) | buf.readUInt8(off++);
        }
        if (byteLen > 2) {
            value = (value << 8) | buf.readUInt8(off++);
        }
        if (byteLen > 1) {
            value = (value << 8) | buf.readUInt8(off++);
        }
        value = (value << 8) | buf.readUInt8(off++);

        /*
            * After get the adjusted value, we have to adjust it back to the
            * original value.
            */
        if (negative) {
            value -= 119;
        } else {
            value += 121;
        }
        return { value, off };
    }

    /**
     * Reads a sorted packed long at the given buffer offset and
     * returns it.  The long should be max of 53 bits (not including sign),
     * which is max allowed by JavaScript Number type.
     *
     * @param buf the buffer to read from.
     *
     * @param off the offset in the buffer at which to start reading.
     *
     * @return tuple containing the resulting value and resulting offset
     */
    static readSortedLong(buf, off, toBigInt = false) {

        let byteLen;
        let negative;

        /* The first byte of the buf stores the length of the value part. */
        let b1 = buf.readUInt8(off++);
        /* Adjust the byteLen to the real length of the value part. */
        if (b1 < 0x08) {
            byteLen = 0x08 - b1;
            negative = true;
        } else if (b1 > 0xf7) {
            byteLen = b1 - 0xf7;
            negative = false;
        } else {
            return {
                value: toBigInt ? BigIntCons(b1 - 127) : b1 - 127,
                off
            };
        }

        /*
        * The following bytes on the buf store the value as a big endian
        * integer. We extract the significant bytes from the buf and put them
        * into the value in big endian order.
        *
        * Note that unlike in Java, we don't need to do (buf[off++] & 0xff)
        * if we read the byte as unsigned 8-bit integer.
        */
        let valueL, valueR;
        if (negative) {
            valueL = -1;
            valueR = -1;
        } else {
            valueL = 0;
            valueR = 0;
        }

        //64 bit int overflow will be detected in Int64.combine()
        if (byteLen > 7) {
            valueL = (valueL << 8) | buf.readUInt8(off++);
        }
        if (byteLen > 6) {
            valueL = (valueL << 8) | buf.readUInt8(off++);
        }
        if (byteLen > 5) {
            valueL = (valueL << 8) | buf.readUInt8(off++);
        }
        if (byteLen > 4) {
            valueL = (valueL << 8) | buf.readUInt8(off++);
        }
        if (byteLen > 3) {
            valueR = (valueR << 8) | buf.readUInt8(off++);
        }
        if (byteLen > 2) {
            valueR = (valueR << 8) | buf.readUInt8(off++);
        }
        if (byteLen > 1) {
            valueR = (valueR << 8) | buf.readUInt8(off++);
        }
        valueR = (valueR << 8) | buf.readUInt8(off++);

        let value = Int64.combine(valueL, valueR, toBigInt);

        /*
        * After obtaining the adjusted value, we have to adjust it back to the
        * original value.
        */
        if (negative) {
            value -= toBigInt ? BIGINT_119 : 119;
        } else {
            value += toBigInt ? BIGINT_121 : 121;
        }
        return { value, off };
    }

    /**
     * In the functions below we assume that Buffer has enough space for
     * the result.
     */

    /**
     * Writes a packed sorted integer starting at the given buffer offset and
     * returns the next offset to be written.
     *
     * @param buf the buffer to write to.
     *
     * @param off the offset in the buffer at which to start writing.
     *
     * @param value the integer to be written.
     *
     * @return the offset past the bytes written.
     */
    static writeSortedInt(buf, off, value) {

        if (!isInt32(value)) {
            throw new NoSQLArgumentError(
                `Value ${value} out of range for type INTEGER`);
        }

        /*
        * Values in the inclusive range [-119,120] are stored in a single
        * byte. For values outside that range, the first byte stores the
        * number of additional bytes. The additional bytes store
        * (value + 119 for negative and value - 121 for positive) as an
        * unsigned big endian integer.
        */
        const byte1Off = off++;

        if (value < -119) {

            /*
            * If the value < -119, then first adjust the value by adding 119.
            * Then the adjusted value is stored as an unsigned big endian
            * integer.
            */
            value += 119;

            /*
            * Store the adjusted value as an unsigned big endian integer.
            * For an negative integer, from left to right, the first
            * significant byte is the byte which is not equal to 0xFF. Also
            * please note that, because the adjusted value is stored in big
            * endian integer, we extract the significant byte from left to
            * right.
            *
            * In the left to right order, if the first byte of the adjusted
            * value is a significant byte, it will be stored in the 2nd byte
            * of the buf. Then we will look at the 2nd byte of the adjusted
            * value to see if this byte is the significant byte, if yes, this
            * byte will be stored in the 3rd byte of the buf, and the like.
            *
            * It seems that Buffer converts number to byte automatically, but
            * I haven't seen this stated explicitly in the doc, so adding
            * (& 0xFF) just in case.
            */
            if ((value | 0x00FFFFFF) != -1) {
                buf.writeUInt8((value >> 24) & 0xFF, off++);
            }
            if ((value | 0x0000FFFF) != -1) {
                buf.writeUInt8((value >> 16) & 0xFF, off++);
            }
            if ((value | 0x000000FF) != -1) {
                buf.writeUInt8((value >> 8) & 0xFF, off++);
            }
            buf.writeUInt8(value & 0xFF, off++);

            /*
            * valueLen is the length of the value part stored in buf. Because
            * the first byte of buf is used to stored the length, we need
            * to subtract one.
            */
            const valueLen = off - byte1Off - 1;

            /*
            * The first byte stores the number of additional bytes. Here we
            * store the result of 0x08 - valueLen, rather than directly store
            * valueLen. The reason is to implement natural sort order for
            * byte-by-byte comparison.
            */
            buf.writeUInt8(0x08 - valueLen, byte1Off);
        } else if (value > 120) {

            /*
            * If the value > 120, then first adjust the value by subtracting
            * 121. Then the adjusted value is stored as an unsigned big endian
            * integer.
            */
            value -= 121;

            /*
            * Store the adjusted value as an unsigned big endian integer.
            * For a positive integer, from left to right, the first
            * significant byte is the byte which is not equal to 0x00.
            *
            * In the left to right order, if the first byte of the adjusted
            * value is a significant byte, it will be stored in the 2nd byte
            * of the buf. Then we will look at the 2nd byte of the adjusted
            * value to see if this byte is the significant byte, if yes, this
            * byte will be stored in the 3rd byte of the buf, and the like.
            */
            if ((value & 0xFF000000) != 0) {
                buf.writeUInt8((value >> 24) & 0xFF, off++);
            }
            if ((value & 0xFFFF0000) != 0) {
                buf.writeUInt8((value >> 16) & 0xFF, off++);
            }
            if ((value & 0xFFFFFF00) != 0) {
                buf.writeUInt8((value >> 8) & 0xFF, off++);
            }
            buf.writeUInt8(value & 0xFF, off++);

            /*
            * valueLen is the length of the value part stored in buf. Because
            * the first byte of buf is used to stored the length, we need to
            * subtract one.
            */
            const valueLen = off - byte1Off - 1;

            /*
            * The first byte stores the number of additional bytes. Here we
            * store the result of 0xF7 + valueLen, rather than directly store
            * valueLen. The reason is to implement natural sort order for
            * byte-by-byte comparison.
            */
            buf.writeUInt8(0xF7 + valueLen, byte1Off);
        } else {

            /*
            * If -119 <= value <= 120, only one byte is needed to store the
            * value. The stored value is the original value plus 127.
            */
            buf.writeUInt8(value + 127, byte1Off);
        }

        return off;
    }

    /**
     * Writes a packed sorted long integer starting at the given buffer offset
     * and returns the next offset to be written.
     *
     * @param buf the buffer to write to.
     *
     * @param off the offset in the buffer at which to start writing.
     *
     * @param value the long integer to be written.
     *
     * @return the offset past the bytes written.
     */
    static writeSortedLong(buf, off, value) {
        if (typeof value === 'number') {
            //See Protocol.writeFieldValue().
            assert(Number.isSafeInteger(value));
        } else {
            assert(typeof value === 'bigint');
            if (value < INT64_BIGINT_MIN || value > INT64_BIGINT_MAX) {
                throw new NoSQLArgumentError(
                    `Value ${value} out of range for type LONG`);
            }
        }

        /*
        * Values in the inclusive range [-119,120] are stored in a single
        * byte. For values outside that range, the first byte stores the
        * number of additional bytes. The additional bytes store
        * (value + 119 for negative and value - 121 for positive) as an
        * unsigned big endian integer.
        */
        const byte1Off = off++;

        if (value < -119) {

            /*
            * If the value < -119, then first adjust the value by adding 119.
            * Then the adjusted value is stored as an unsigned big endian
            * integer.
            */
            value += typeof value === 'bigint' ? BIGINT_119 : 119;

            const { valueL, valueR } = Int64.split(value);

            /*
            * Store the adjusted value as an unsigned big endian integer.
            * For an negative integer, from left to right, the first
            * significant byte is the byte which is not equal to 0xFF. Also
            * please note that, because the adjusted value is stored in big
            * endian integer, we extract the significant byte from left to
            * right.
            *
            * In the left to right order, if the first byte of the adjusted
            * value is a significant byte, it will be stored in the 2nd byte
            * of the buf. Then we will look at the 2nd byte of the adjusted
            * value to see if this byte is the significant byte, if yes, this
            * byte will be stored in the 3rd byte of the buf, and the like.
            *
            * It seems that Buffer converts number to byte automatically, but
            * I haven't seen this stated explicitly in the doc, so adding
            * (& 0xFF) just in case.
            */
            if ((valueL | 0x00FFFFFF) != -1) {
                buf.writeUInt8((valueL >> 24) & 0xFF, off++);
            }
            if ((valueL | 0x0000FFFF) != -1) {
                buf.writeUInt8((valueL >> 16) & 0xFF, off++);
            }
            if ((valueL | 0x000000FF) != -1) {
                buf.writeUInt8((valueL >> 8) & 0xFF, off++);
            }
            if (valueL != -1) {
                buf.writeUInt8(valueL & 0xFF, off++);
            }
            if (valueL != -1 || (valueR | 0x00FFFFFF) != -1) {
                buf.writeUInt8((valueR >> 24) & 0xFF, off++);
            }
            if (valueL != -1 || (valueR | 0x0000FFFF) != -1) {
                buf.writeUInt8((valueR >> 16) & 0xFF, off++);
            }
            if (valueL != -1 || (valueR | 0x000000FF) != -1) {
                buf.writeUInt8((valueR >> 8) & 0xFF, off++);
            }
            buf.writeUInt8(valueR & 0xFF, off++);

            /*
            * valueLen is the length of the value part stored in buf. Because
            * the first byte of buf is used to stored the length, so we need
            * to minus one.
            */
            const valueLen = off - byte1Off - 1;

            /*
            * The first byte stores the number of additional bytes. Here we
            * store the result of 0x08 - valueLen, rather than directly store
            * valueLen. The reason is to implement nature sort order for
            * byte-by-byte comparison.
            */
            buf.writeUInt8(0x08 - valueLen, byte1Off);
        } else if (value > 120) {

            /*
            * If the value > 120, then first adjust the value by subtracting
            * 119. Then the adjusted value is stored as an unsigned big endian
            * integer.
            */
            value -= typeof value === 'bigint' ? BIGINT_121 : 121;

            const { valueL, valueR } = Int64.split(value);

            /*
            * Store the adjusted value as an unsigned big endian integer.
            * For a positive integer, from left to right, the first
            * significant byte is the byte which is not equal to 0x00.
            *
            * In the left to right order, if the first byte of the adjusted
            * value is a significant byte, it will be stored in the 2nd byte
            * of the buf. Then we will look at the 2nd byte of the adjusted
            * value to see if this byte is the significant byte, if yes, this
            * byte will be stored in the 3rd byte of the buf, and the like.
            */
            if ((valueL & 0xFF000000) != 0) {
                buf.writeUInt8((valueL >> 24) & 0xFF, off++);
            }
            if ((valueL & 0xFFFF0000) != 0) {
                buf.writeUInt8((valueL >> 16) & 0xFF, off++);
            }
            if ((valueL & 0xFFFFFF00) != 0) {
                buf.writeUInt8((valueL >> 8) & 0xFF, off++);
            }
            if (valueL != 0) {
                buf.writeUInt8(valueL & 0xFF, off++);
            }
            if (valueL || (valueR & 0xFF000000) != 0) {
                buf.writeUInt8((valueR >> 24) & 0xFF, off++);
            }
            if (valueL || (valueR & 0xFFFF0000) != 0) {
                buf.writeUInt8((valueR >> 16) & 0xFF, off++);
            }
            if (valueL || (valueR & 0xFFFFFF00) != 0) {
                buf.writeUInt8((valueR >> 8) & 0xFF, off++);
            }
            buf.writeUInt8(valueR & 0xFF, off++);

            const valueLen = off - byte1Off - 1;

            /*
            * The first byte stores the number of additional bytes. Here we
            * store the result of 0xF7 + valueLen, rather than directly store
            * valueLen. The reason is to implement nature sort order for
            * byte-by-byte comparison.
            */
            buf.writeUInt8(0xF7 + valueLen, byte1Off);
        } else {

            /*
            * If -119 <= value <= 120, only one byte is needed to store the
            * value. The stored value is the original value adds 127.
            */
            buf.writeUInt8(Number(value) + 127, byte1Off);
        }
        return off;
    }

}

module.exports = PackedInteger;
