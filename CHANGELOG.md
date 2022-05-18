# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unpublished

**Added**

* Support for session persistence. If a recognized Set-Cookie HTTP header is present the SDK will set a Cookie header using the requested session value

* Added NoSQLClient.precacheAuth() API to pre-create authorization signature
before starting database operations, thus avoiding possible timeout errors
when using Instance Principal.

* Cloud only: Added OCI region codes: JNB, SIN, MAD, MRS, CDG, ARN, AUH, QRO, MCT, WGA

**Changed**

* Auto-renew Instance Principal security token in the background in advance of
expiration.
* When returning authorization information, make sure security token is valid
(or refresh it) thus avoiding retry on invalid authorization error.

**Fixed**

* Downgrade version of @babel/parser used by JSDoc because current version
causes missing output.
* Fixed a bug where queryIterable API was throwing TypeError when called
without *opt* parameter.

## 5.3.0 = 2022-02-18

**Added**

* Added new regions for cloud service: LIN, MTZ, VCP, BRS, UKB.
* Added Instance Principal with Delegation Token feature.
* Added NoSQLClient.queryIterable() API to iterate over query results using
for-await-of loop.
* Cloud only: support for on-demand tables
  * Changes to TableLimits and addition of CapacityMode to specify on-demand tables
* Existing row modification is made available in results when the operation fails
  and the previous row is requested
* Modification time is made available in get operations
* On-premise only: support for setting Durability in write operations
  * Added Durability class and methods to set Durability

**Changed**

* Changes to allow the driver to work in the browser environment.
* The SDK now detects the version of the server it's connected to  and adjusts its capabilities to match. This allows the SDK to communicate with servers that may only support an earlier protocol version, with the corresponding feature restrictions


## 5.2.4 - 2021-06-29

**Added**

* Driver-side rate limiting support.
* Added new regions and new realm OC8 for the cloud service.
* Differentiate between SQL NULL and JSON NULL by using undefined for SQL NULL
and null for JSON NULL.

**Fixed**

* Fixed an issue where lib/query/receive.js was requiring NoSQLClient creating
circular dependency.
* Fixed an issue in on-prem authorization provider where incorrect
authorization header was passed to renew and logout requests.
* Fixed an issue with auto-renew functionality in on-prem authorization
provider.  Set auto-renew to true by default to match the Java driver.
* Make sure equal but differently represented numeric values yield the same
result record for group by and distinct queries.
* Minor error handling issue in query code.

**Changed**

* Change default timeout to infinity (no timeout) for forCompletion API as
well as table and admin DDL APIs when called with complete:true option.  This
is to handle potentially long running DDL operations.  Set default timeout to
30 seconds for admin list APIs (listNamespaces, listUsers, listRoles).
* In IAM code, make clear distinctions on what profiles are instantiated
depending on the properties provided in auth.iam.  Treat erroneously provided
null or undefined values as invalid instead on falling back on default OCI
config file authentication.  Made error messages more clear as to what
property is missing or invalid.
* Use promise-based implementation of lib/http_client.js and all calling code
instead of callback-based implementation.
* Split lib/ops.js into several files in a separate subdirectory.
* Enable hostname verification for secure connections by default.

## 5.2.3 - 2020-08-14

**Added**

* Added support for two new regions.
* Resource Principal Support.
* Instance Principal Support.
* Generalized sorting in queries.  Support for order by, group by and distinct
without indexes.

**Changed**

* Allow unit tests to use --kv option to test against older kvstore releases.
* Use mock-fs for IAM unit tests to avoid creating temporary test files.
* Minor reorganization and fixes, split error.js into two files.

**Fixed**

* Fixed a problem in on-prem authorization provider when using "credentials"
property in the kvstore auth config.
* Fixed some unit tests failures due to absense of default OCI config file.
* Fixed an issue where forCompletion() or forTableState() would fail before
its timeout because of retryable error.
* Fixed some doc typos.

## 5.2.2 - 2020-05-06

**Added**

* Support for using region from OCI config file if present.
* Support for NoSQLClient no-argument constructor if region is present in
default OCI config file.
* Updated dependencies to require Node.js 12

## 5.2.0 - 2020-02-05

**Added**

* Support for the Oracle NoSQL Database Cloud Service

## 5.1.0 - 2019-09-04

**Added**

* Support for On-Premise Oracle NoSQL Database through HTTP proxy instead of
Thrift-based proxy.
* New Promise-based APIs in keeping with the latest Node.js/JavaScript
features.
* Support for sorted/ordered multi-shard queries.
* Support for multi-shard aggregation.
* Support for geo-spacial queries such as geo_near().
* Support for Identity Columns.

**Removed**

* Support for Thrift-based proxy.
* Support for old APIs.
