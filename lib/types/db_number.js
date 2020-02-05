/*
 * Copyright (C) 2018, 2020 Oracle and/or its affiliates. All rights reserved.
 *
 * Licensed under the Universal Permissive License v 1.0 as shown at https://oss.oracle.com/licenses/upl
 *
 * Please see LICENSE.txt file included in the top-level directory of the
 * appropriate download for a copy of the license and additional information.
 */

'use strict';

/**
 * Describes integration with 3rd party number libraries to support arbitrary
 * precision decimal numbers.
 */

/**
 * NoSQL database allows you to store arbitrary precision decimal numbers
 * in tables by using database type <em>Number</em>, which supports all
 * numbers represented by Java BigDecimal class.  By default, the driver
 * represents them as Javascript numbers.  However this has some limitations:
 * <ul>
 * <li>The number of significant digits is limited to what can be represented
 * by Javascript number type, which is approximately 15 decimal
 * digits, so the values with higher precision cannot be reresented exactly
 * and will be rounded.</li>
 * <li>The range is limited to what can be represented by Javascript numbers,
 * which is upproximately up to +-1e308.</li>
 * <li>Javascript numbers are stored in binary and not decimal format, which
 * means that some decimal values cannot be represented exactly and are
 * subject to rounding errors when performing decimal calculations.</li>
 * </ul>
 * <p>
 * Because Javascript and Node.js do not currently have a standard way to
 * represent arbitrary precision decimal numbers, the driver allows you to use
 * a 3rd party number library of your choice.  Typically the number libraries
 * represent numbers as objects of certain prototype or class and have methods
 * to perform arithmetic and other operations.  If you enable this feature,
 * the driver will represent the column values of datatype <em>Number</em> as
 * objects of this type from the number library.  You can pass these objects
 * as record fields for put operations, as key fields for get operations and
 * they will also be returned as part of get and query results wherever the
 * column value or expression result is of datatype <em>Number</em>.  Then
 * your application can use methods from the number library to perform further
 * numeric operations on number objects or convert them to suitable display
 * representation.
 * <p>
 * In most cases you only need the following:
 * <ol>
 * <li>Install the 3rd party number library of your choice (typically from
 * NPM) globally or as a dependency of your application (note that the driver
 * does not automatically install number libraries)</li>
 * <li>In the initial {@link Config} used to create {@link NoSQLClient},
 * specify <em>dbNumber</em> property as <em>dbNumber: 'module_name'</em>
 * where module_name is the module name of the number library</li>
 * </ol>
 * See examples below.
 * <p>
 * The above is sufficient for most cases when using default settings and
 * for number libraries that provide standard method names for common
 * operations.  The driver has been tested with the following number
 * libraries:
 * <ul>
 * <li>[decimal.js]{@link https://github.com/MikeMcl/decimal.js}</li>
 * <li>[decimal.js-light]{@link https://github.com/MikeMcl/decimal.js-light}</li>
 * <li>[bignumber.js]{@link https://github.com/MikeMcl/bignumber.js}</li>
 * <li>[big.js]{@link https://github.com/MikeMcl/big.js}</li>
 * </ul>
 * <p>
 * These libraries should work out of the box with simple steps as described
 * above.  However you may use any number library of your choice as long as
 * it uses objects to represent arbitrary precision decimal numbers, provides
 * constructor function to create these objects and supports some common
 * operations.  Below we describe what the driver needs to know from the
 * number library and whether it will work out of the box as mentioned
 * above or if it may require additional configuration.
 * <p>
 * The driver needs to know the following:
 * <ol>
 * <li> Constructor function.  The constructor should be able to create 
 * the number object from its string representation.  Typically the
 * number libraries export the constructor as a sole module export, so that
 * the result of <em>require('module_name')</em> is the
 * constructor.  In this case no additional configuration is required.
 * </li>
 * <li> Conversion to string.  Typically this is the instance method
 * <em>toString</em> (overriden from <em>Object</em> class), in which case no
 * additional configuration is required.</li>
 * <li> Operations for comparison, addition, subtraction, multiplication and
 * division, as may be needed by the driver for client-side query processing.
 * These are typically static (properties of the constructor itself)
 * and/or instance methods (properties of constructor's prototype), with the
 * static methods taking 2 arguments and instance
 * methods taking one argument.  The driver will look for common method names
 * (instance or static) such as "add", "plus" for addition, "subtract", "sub",
 * "minus" for subtraction, etc.  See {@link NumberLibMethods} for complete
 * list of names.  If the number library of your choice uses any of the common
 * names for each operation listed above, no additional configuration is
 * required.</li>
 * <li> Precision and rounding mode.  These are optional and if not specified,
 * default values will be used.  On the server side, NoSQL database uses Java
 * BigDecimal to do calculations for Number datatype during query processing.
 * The result of each operation is rounded accoring to Java MathContext
 * settings, which consist of precision (number of significant digits) and
 * rounding mode (how to round the result to precision), so these settings
 * need to be provided to the server for query processing.  You may choose to
 * provide them explicitly in configuration (see {@link NumberLibConfig}) or
 * let the driver figure them out from the number library settings using some
 * common property names (see {@link NumberLibPrecision} and
 * {@link NumberLibRoundingMode}).  If not found, default precision of 20 and
 * rounding mode <em>ROUND_HALF_UP</em> will be used.</li>
 * </ol>
 * <p>
 * Note that configuration for this feature is always specified as
 * <em>dbNumber</em> property of {@link Config} and thus can be provided
 * either as part of {@link Config} Javascript object or in JSON file
 * containing {@link Config}.
 * <p>
 * <em>dbNumber</em> property can be one of the following:
 * <ul>
 * <li>String specifying number library module name as discussed above.</li>
 * <li>Constructor function (not available if using JSON file).  You may
 * specify constructor function explicitly.  This is useful when you want to
 * set custom settings for the constructor (to customize created number
 * instances) before passing it to the driver instead of using default number
 * library settings.  Also see {@link NumberLibConfig}#Constructor.</li>
 * <li>{@link NumberLibConfig} object if more complex configuration is desired.
 * </li>
 * </ul>
 * 
 * @see {@link NumberLibConfig}
 * @see {@link NumberLibMethods}
 * 
 * @example // Using number library bignumber.js with Cloud Simulator
 * 
 * const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
 * const BigNumber = require('bignumber.js');
 * 
 * async function test() {
 *       let client;
 *       try {
 *          client = new NoSQLClient({
 *              endpoint: 'http://localhost:8080',
 *              dbNumber: 'bignumber.js'
 *          });
 *          let res = await client.tableDDL(
 *              'CREATE TABLE squareRoots(num INTEGER, sqrtValue NUMBER, PRIMARY KEY(num))'
 *              {
 *                  tableLimits: {
 *                      readUnits: 100,
 *                      writeUnits: 100,
 *                      storageGB: 50
 *                  },
 *                  completion: true
 *              }
 *          );
 *          // insert data and verify
 *          for(let n = 1; n < 1000; n++) {
 *              res = await client.put('squareRoots', {
 *                  num: n,
 *                  sqrtValue: new BigNumber(n).squareRoot()
 *              });
 *              res = await client.get('foo', { num: n });
 *              //check that we got the row back
 *              assert(res.row != null);
 *              console.log(`Square root of ${n} is ${res.row.sqrtVal}`);
 *          }
 *          // query to get sum of square roots
 *          const opt = {};
 *          let rows = [];
 *          do {
 *              // Note that result may not always be returned on the first
 *              // query call
 *              res = await client.query(
 *                  'SELECT sum(sqrtValue) AS sqrtSum FROM squareRoots');
 *              rows = rows.concat(res.rows);
 *              opt.continuationKey = res.continuationKey;
 *          } while(res.continuationKey);
 *          // only one result for this query
 *          assert(rows.length === 1);
 *          const sqrtSum = rows[0].sqrtSum;
 *          // the sum should be instance of BigNumber type
 *          assert(sqrtSum instanceof BigNumber);
 *          console.log(`Square root sum is ${sqrtSum}`);
 *      } catch(err) {
 *          //handle errors
 *      } finally {
 *          if (client) {
 *              client.close();
 *          }
 *      }
 * }
 * 
 * @global
 * @typedef {string|function|NumberLibConfig} DBNumberConfig
 */

/**
 * This object can be set as <em>dbNumber</em> property of the {@link Config}
 * to specify configuration for using 3rd party number libary when additional
 * information is required, as described in {@link DBNumberConfig}.
 * <p>
 * The only required property is <em>Constructor</em>.  As menitoned,
 * <em>static</em> and <em>instance</em> properties are only needed when
 * the number library is not using common method names, or if you need to
 * customize implementation, see {@link NumberLibMethods}.
 * <p>
 * An important note about precision and rounding:
 * <p>
 * Different number libraries have different options to round the results
 * of arithmetic and other operations.  For example, some libraries like
 * <em>decimal.js</em> and <em>decimal.js-light</em> round to precision, which
 * is total number of significant digits in the number.  These libraries
 * typically have a precision value specified as configuration setting in the
 * constructor.  Other libraries, like <em>bignumber.js</em> and
 * <em>big.js</em> round to scale, or decimal places, which is number of
 * digits after decimal point.  These libraries typically have decimal
 * places value as configuration setting in the constructor.  In addition,
 * some libraries, like <em>decimal.js</em> and <em>bignumber.js</em> do
 * automatic rounding of some arithmetic operations and other libraries like
 * <em>big.js</em> and <em>decimal.js-light</em> allow only manual rounding
 * via methods such as <em>round</em>.
 * <p>
 * The above may have implication on some query results.  On the server side,
 * NoSQL database uses Java BigDecimal and rounds each arithmetic operation
 * according to precision and rounding mode settings of MathContext, as
 * mentioned in {@link DBNumberConfig}.  The driver, on the other hand, does
 * not perform rounding during query processing, other than the rounding
 * performed automatically by some number libraries as mentioned above.  This
 * means that for queries that use arithmetic expressions and some aggregate
 * functions, the query results may slightly differ when using different
 * number libraries.  From the libraries tested, <em>decimal.js</em> has the
 * closest matching behavior to query processing on the server side because
 * it automatically rounds arithmetic operations to precision using rounding
 * mode setting.
 * <p>
 * You may also use the rounding methods from the number library to perform
 * rounding after receiving query results.  This may be useful when using
 * number libraries that do not perform automatic rounding.  In addition,
 * number libraries may have other settings related to rounding.  See
 * documentation for the number library of your choice.  If required, you can
 * clone and customize the constructor and pass it as
 * {@link NumberLibConfig}#Constructor property.  You may also customize
 * arithmetic operations further using <em>static</em> and <em>instance</em>
 * properties, see {@link NumberLibMethods}, in case non-standard behavior is
 * needed.
 * <p>
 * The driver need to know precision and rounding mode in order to create
 * MathContext for server-side query processing.  It will try to infer these
 * settings from the constructor as described in {@link NumberLibPrecision}
 * and {@link NumberLibRoundingMode}.  For libraries that round to scale,
 * such as <em>bignumber.js</em> and <em>big.js</em>, it is not possible
 * to infer precision from constructor, so you may need to set
 * <em>precision</em> property, otherwise the driver will use the default
 * value.  For <em>precision</em> and <em>roundingMode</em> properties, if
 * set, the driver will use their values instead of inferring them from
 * the constructor.
 * <p>
 * Note that setting properties <em>precision</em> and <em>roundingMode</em>
 * only affects how rounding is done on the server side.  The driver will not
 * set any properties of the constructor.  If the number library does
 * automatic rounding, it will do so based on the constructor as passed.  If
 * the number library supports precision and rounding mode settings and does
 * automatic rounding/trucation, you can ensure that the same settings are
 * used by the server and the client by letting the driver infer them from
 * the constructor (by using <em>getPrecision</em> and
 * <em>getRoundingMode</em> properties if necessary).  E.g. for libraries
 * <em>decimal.js</em> and <em>decimal.js-light</em> the driver will
 * automatically infer and use precision and rounding mode settings.
 * 
 * @example //A possible JSON config when using decimal.js-light, explicitly
 * //specifying precision and rounding mode
 * {
 *     "endpoint": "......",
 *     ......................
 *     "dbNumber": {
 *         "Constructor": "decimal.js-light",
 *         "precision": 10,
 *         "roundingMode": "ROUND_HALF_EVEN"
 *     }
 * }
 * 
 * @see {@link DBNumberConfig}
 * @see {@link NumberLibMethods}
 * @see {@link NumberLibPrecision}
 * @see {@link NumberLibRoundingMode}
 * @see {@link RoundingModesMap}
 * @global
 * @typedef {object} NumberLibConfig
 * @property {string|function} Constructor String representing number library
 * module name, if the sole export is the constructor, or constructor
 * function.  Constructor function must be able to create instances from
 * number's string representation or from Javascript number (although other
 * options may also be provided by the number library). Note the upper case to
 * disambiguate from Object's <em>constructor</em> property
 * @property {string} [module] In rare cases when the number library export
 * is not the constructor, you may specify the module name.  If this property
 * is set and <em>Constructor</em> property is specified as a string, then the
 * <em>Constructor</em> property specifies property name of the
 * <em>module.exports</em> object instead of the module name
 * @property {NumberLibMethods} [static] Static method mappings, that is
 * methods that are properties of the constructor itself.  If not set, or
 * for any required method not present in the mapping, the driver will try to
 * infer it from constructor.  See {@link NumberLibMethods}
 * @property {NumberLibMethods} [instance] Instance method mappings, that is
 * methods that are properties of the constructor's prototype.  If not set, or
 * for any required method not present in the mapping, the driver will try
 * to infer it from constructor's prototype.  See {@link NumberLibMethods}
 * @property {number} [precision=20] Precision to use for rounding of
 * server-side query calculations on datatype <em>Number</em>.  If not
 * set, the driver will try to infer the value from constructor (see
 * {@link NumberLibPrecision}).  If cannot be inferred, default precision of
 * 20 is used
 * @property {*} [roundingMode='HALF_UP'] Rounding mode to use for rounding of
 * server-side query calculations on datatype <em>Number</em>.  See
 * {@link RoundingModesMap} for details on supported roundings modes.
 * This property can be specified either as rounding mode name string, such as
 * 'DOWN', 'UP', 'HALF_DOWN', etc. (with or without <em>ROUND_</em> prefix) or
 * as number library-specific constant value, as long as the driver can find
 * a mapping between rounding mode names and their values in the number
 * library (see {@link RoundingModesMap}).  If not set, the driver will try
 * to infer the value from constructor (see {@link NumberLibRoundingMode}).
 * If cannot be inferred, default value of <em>ROUND_HALF_UP</em> is used
 * @property {NumberLibPrecision} [getPrecision] Specifies how to get
 * precision value from constructor.  See {@link NumberLibPrecision}.  If not
 * set, the driver will use {@link NumberLibConfig}#precision
 * @property {NumberLibRoundingMode} [getRoundingMode]  Specifies how to get
 * rounding mode from constructor.  See {@link NumberLibRoundingMode}.  If not
 * set, the driver will use {@link NumberLibConfig}#roundingMode
 * @property {RoundingModesMap} [RoundingModes] Specifies mapping between
 * rounding mode names and their constant values in the number library.  If
 * not set, the driver will try to infer the mapping from constuctor or module
 * (see {@link RoundingModesMap})
 */

/**
 * Object that specifies method mappings for methods from the number library
 * that are required by the driver.  Set this as
 * {@link NumberLibConfig}#static property for mappings to static methods
 * (properties of the constructor) and to {@link NumberLibConfig}#instance
 * property for mappings to instance methods (properties of the constructor's
 * prototype).  You may also set both of the above to provide static mappings
 * for some methods and instance mappings for others.  For any required
 * method, one mapping is sufficient (otherwise the driver will prefer
 * instance over static).
 * <p>
 * Unless otherwise specified, the required operations are binary (i.e.
 * they operate on two number objects).  This means that static methods take 2
 * parameters and instance methods have <em>this</em> context as the 1st
 * number object and pass 2nd number as one parameter.
 * <p>
 * You can specify each method mapping as either string or a function.  If
 * string, the driver will use constructor's or prototype's property by that
 * name for static or instance method respectively.  You may also provide a
 * function for either static or instance method (as long as it follows the
 * rules for arguments and <em>this</em> context described in previous
 * paragraph).  This allows you to customize implementation if needed.
 * <p>
 * <p>
 * The following assumptions can be made about the argument types:
 * <ul>
 * <li>For static methods, you may assume that the first argument is the
 * number object but second argument may be either number object, string or
 * Javascript number.  This should fit the signatures of static methods
 * from number libraries, which typically assume that both arguments may be
 * either number object, string or Javascript number.</li>
 * <li>For instance methods, <em>this</em> context is the number object but
 * the argument may be number object, string or Javascript number.
 * Typically number libraries make the same assumption.</li>
 * </ul>
 * All properties are optional.  For any method mapping property, if
 * not set, the driver will look for methods with list of names as specified.
 * Unless otherwise specified, the driver will look first for each
 * instance method on that list and then for each static.  If the mapping is
 * not specified and none of the methods on the list could be found,
 * {@link NoSQLArgumentError} will result.
 * <p>
 * The above means that you only need to set mappings for methods with
 * non-typical names that would not be found on corresponding name list or if
 * you with to customize thier implementation.  In particular, for 4 tested
 * number libraries mentioned in {@link DBNumberConfig}, no mappings are
 * required.
 * 
 * @example // Example of some complex mappings
 * // We assume that divide and multiply methods take precision, to which
 * // the result should be rounded, as an argument.  We also assume unusual
 * // instance method names for compare and add.  These are for illustration
 * // purposes only.
 * 
 * const MyBigNumber = require('my_number_library');
 * const precision = 50;
 * const config = {
 *     endpoint: '..........',
 *     ........................
 *     dbNumber: {
 *          Constructor: MyBigNumber,
 *          precision,
 *          static: {
 *              multiply: (n1, n2) => MyBigNumber.multiply(n1, n2, precision),
 *              divide: (n1, n2) => MyBigNumber.divide(n1, n2, precision)
 *          }
 *          instance: {
 *              compare: 'compareWith',
 *              add: 'sumWith'
 *          }
 *     }
 * }
 * 
 * @global
 * @typedef {object} NumberLibMethods
 * @property {string|function} [compare] Compare two numbers n1 and n2.
 * Return value of this function should be > 0 if n1 > n2, = 0 if n1 = n2 and
 * < 0 if n1 < n2.  If not set, the driver will look for methods named
 * <em>comparedTo</em>, <em>compareTo</em>, <em>cmp</em> and
 * <em>compare</em> in that order
 * @property {string|function} [valuesEqual] Determine if two numbers are
 * equal.  Should return true/false.  This property may be useful for equality
 * checks during query processing which is usually faster than numeric
 * comparison via {@link NumberLibMethods}#compare.  If not set, the driver
 * will look for instance methods <em>equals</em>, <em>isEqualTo</em> and
 * <em>eq</em> in that order.  If not found, the driver will use
 * {@link NumberLibMethods}#compare for equality checks
 * @property {string|function} [add] Add two numbers n1 and n2, return number
 * object with value of n1 + n2.  If not set, the driver will look for methods
 * named <em>plus</em> and <em>add</em> in that order
 * @property {string|function} [subtract] Subtract number n2 from n1, return
 * number object with value of n1 - n2.  If not set, the driver will look for
 * methods named <em>minus</em>, <em>sub</em> and <em>subtract</em> in that
 * order
 * @property {string|function} [multiply] Multiply numbers n1 and n2, return
 * number object with value n1 * n2.  If not set, the driver will look for
 * methods named <em>times</em>, <em>multipliedBy</em>, <em>multiply</em>
 * and <em>mul</em> in that order
 * @property {string|function} [divide] Divide number n1 by n2, return number
 * object with value of n1 / n2.  If not set, the driver will look for methods
 * named <em>dividedBy</em>, <em>divide</em> and <em>div</em> in that order
 */

/**
 * Value of <em>getPrecision</em> property of {@link NumberLibConfig}.
 * This property may be:
 * <ul>
 * <li>String, specifying the property name of the constructor which contains
 * precision.  Nested paths (with '.'s) are allowed.</li>
 * <li>Function, specifying how to get precision value from the constructor.
 * The function takes constructor as sole parameter and returns precision
 * value as Javascript number.</li>
 * </ul>
 * If {@link NumberLibConfig}#getPrecision is not set, the driver will use
 * value {@link NumberLibConfig}#precision property.  If that is also not set,
 * the driver will check constructor properties <em>precision</em> and
 * <em>PRECISION</em>.  If not found, default precision of 20 is assumed.
 * 
 * @see {@link NumberLibConfig}
 * @global
 * @typedef {string|function} NumberLibPrecision
 */

/**
 * Value of <em>getRoundingMode</em> property of {@link NumberLibConfig}.
 * <p>
 * This property may be:
 * <ul>
 * <li>String, specifying the property name of the constructor which contains
 * rounding mode.  Nested paths (with '.'s) are allowed.</li>
 * <li>Function, specifying how to get rounding mode value from the
 * constructor.  The function takes constructor as sole parameter and returns
 * rounding mode value as one of the constant values used by the number
 * library, which is typically numeric, but does not have to be so.</li>
 * </ul>
 * If {@link NumberLibConfig}#getRoundingMode is not set, the driver will use
 * value {@link NumberLibConfig}#roundingMode property.  If that is also not
 * set, the driver will check constructor properties <em>rounding</em>,
 * <em>roundingMode</em>, <em>ROUNDING_MODE</em> and <em>RM</em> in that
 * order.  If not found, default rounding mode ROUND_HALF_UP is assumed.
 * <p>
 * Also see {@link RoundingModesMap} for explanation on rounding modes.
 * 
 * @see {@link NumberLibConfig}
 * @see {@link RoundingModesMap}
 * @global
 * @typedef {string|function} NumberLibRoundingMode
 */

/**
 * Specifies constant values used for rounding modes in the number library.
 * <p>
 * Rounding mode specifies rounding behavior of numerical and/or rounding
 * operations in the number library, specifically indicating how the least
 * significant digit of the result should be calculated.  There are several
 * well known rounding modes.  NoSQL database supports rounding modes
 * used by Java BigDecimal and specified as
 * [RoundingMode enumeration]{@link https://docs.oracle.com/en/java/javase/13/docs/api/java.base/java/math/RoundingMode.html}.
 * Also see documentation for the number library of your choice on supported
 * rounding modes.
 * <p>
 * This object may be specified as {@link NumberLibConfig}#RoundingModes
 * property and it helps the driver determine the rounding mode constant
 * values (which are usually Javascript numbers) for different rounding modes
 * used by the number library.  The driver uses it to infer which rounding
 * mode is used by the library or set as {@link NumberLibConfig}#roundingMode
 * property, see {@link NumberLibRoundingMode}.
 * <p>
 * In most cases, it is not necessary to set
 * {@link NumberLibConfig}#RoundingModes and thus use this object.
 * Specifically, this property is not necessary if:
 * <ul>
 * <li>You wish to keep default rounding mode <em>ROUND_HALF_UP</em></li>
 * <li>You set {@link NumberLibConfig}#roundingMode property as a name string
 * of the rounding mode (such as 'ROUND_UP', 'ROUND_DOWN', etc.), see
 * {@link NumberLibRoundingMode}.</li>
 * <li>The driver can infer rounding mode constants from the constructor or
 * its properties, see below.</li>
 * </ul>
 * If not set, the driver will try to infer rounding mode constants by:
 * <ol>
 * <li>Looking for an object containing these constants by checking properties
 * <em>RoundingModes</em> and <em>RoundingMode</em> of the constructor and of
 * the module (if specified).  If not found assume the constructor itself
 * contains the constants.</li>
 * <li>Looking for properties with rounding mode names such as
 * <em>ROUND_UP</em>, <em>ROUND_DOWN</em>, etc. in the object determined
 * above, with and without <em>ROUND_</em> prefix.</li>
 * </ol>
 * <p>
 * Note that you may also set {@link NumberLibConfig}#RoundingModes to string
 * in which case it will be used as a property name or path ('.'s allowed) of
 * constructor or module to the object containing rounding mode constants
 * instead of checking candidate names as described above.
 * <p>
 * The properties listed correspond to each rounding mode supported
 * by the driver.  Note that some number libraries, such as <em>big.js</em>,
 * support only a subset of these.  In this case the driver will infer all it
 * can.  If neither {@link NumberLibConfig}#RoundingModes nor
 * {@link NumberLibConfig}#roundingMode properties are set and rounding mode
 * constants cannot be inferred, the driver will assume default rounding mode
 * <em>ROUND_HALF_UP</em>.
 * <p>
 * Note that some number libraries may support rounding modes not listed here
 * and not supported by Java BigDecimal, such as <em>ROUND_HALF_CEIL</em> and
 * <em>ROUND_HALF_FLOOR</em>.  Using of these rounding modes will result in
 * {@link NoSQLArgumentError}.
 * <p>
 * Although numeric rounding mode values are usually used, if the library
 * of your choice using other type for rounding mode constants you may specify
 * them as well.  Any value is allowed except <em>undefined</em> and
 * <em>null</em>.
 * 
 * @example //Using RoundingModeMap for big.js in JSON config with Cloud Simulator
 * {
 *     "endpoint": "http://localhost:8080",
 *     "dbNumber": {
 *         "Constructor": "big.js",
 *         "RoundingModes": {
 *              "ROUND_DOWN": 0,
 *              "ROUND_HALF_UP": 1,
 *              "ROUND_HALF_EVEN": 2,
 *              "ROUND_UP": 3
 *         }
 *     }
 * }
 * 
 * @global
 * @typedef {object|string} RoundingModesMap
 * @property {*} [UP] Constant value for ROUND_UP rounding mode
 * @property {*} [DOWN] Constant value for ROUND_DOWN rounding mode
 * @property {*} [CEILING] Constant value for ROUND_CEILING rounding mode
 * @property {*} [FLOOR] Constant value for ROUND_FLOOR rounding mode
 * @property {*} [HALF_UP] Constant value for ROUND_HALF_UP rounding mode
 * @property {*} [HALF_DOWN] Constant value for ROUND_HALF_DOWN rounding mode
 * @property {*} [HALF_EVEN] Constant value for ROUND_HALF_EVEN rounding mode
 */
