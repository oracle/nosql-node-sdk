# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## 5.5.2 - 2024-06-11

**Fixed**

* Cloud only: fixed a bug where read/write units in AddReplicaOpt were not
sent to the server during addReplica operation.

**Added**

* Cloud only: added OKE workload identity authentication support
 - added support for new configuration properties:
auth.iam.useOKEWorkloadIdentity, auth.iam.serviceAccountToken,
auth.iam.serviceAccountTokenFile, auth.iam.serviceAccountTokenProvider
 - added new methods: IAMAuthorizationProvider.withOKEWorkloadIdentity,
IAMAuthorizationProvider.withOKEWorkloadIdentityAndTokenFile,
IAMAuthorizationProvider.getRegion
* Cloud only: Added OCI region codes: IZQ, XSP, UKY

## 5.5.1 - 2024-02-21

**Added**

* Cloud only: added support for Global Active tables:
  - added new methods to NoSQLClient: addReplica, dropReplica,
getReplicaStats, forLocalReplicaInit
  - added new properties to TableResult: isSchemaFrozen, isReplicated,
isLocalReplicaInitialized, replicas
* Added public classes for Cloud and On-prem authorization providers.
IAMAuthorizationProvider includes API to get Resource Principal claims.
* Cloud only: added configuration option useResourcePrincipalCompartment to
enable using the resource compartment when using Resource Principal.
* On-prem only: new unit tests for on-prem authentication.
* Support for query array_collect and count(distinct) operators.
* Cloud only: Added OCI region codes: AGA BOG VAP NAP AVZ OZZ DRS TYO AHU DAC DOH
* On-prem only: allow to specify namespace as a configuration option or in
options for each operation.

**Changed**

* Allow internal query protocol version negotiation.
* Modified internal query processing to support elasticity operations.

**Fixed**

* Modified index.js to allow named imports from JavaScript when using ES6
modules.

## 5.5.0 - 2023-08-17

**Added**

* Cloud only: support for session token-based authentication.
* TypeScript support.  This includes declarations for all classes and types
used by the SDK, related tests, new examples and new documentation.

**Fixed**

* Fixed to make AVG SQL operator return null instead of jnull when there are
no numeric values in input.
* Remove authentication information from the *operation* object so that it is
not publicly visible.

**Changed**

* Cloud only: improved error reporting for IAM authentication.

## 5.4.0 - 2023-04-13

**Added**

* Cloud only: Added OCI region codes: MTY, STR, BEG, VLL, YUM

* Support for new, flexible wire protocol (V4) has been added. The previous
protocol is still supported for communication with servers that do not yet
support V4. The version negotation is internal and automatic; however, use
of new V4 features will not work at runtime when attempted with an older
server: options new to V4 will be ignored, result properties new to V4 will be
null or default and new APIs added in V4 will throw
NoSQLUnsupportedProtocolError.
The following new features or interfaces depend on the new protocol version:
 - added durability to options for NoSQLClient.query for queries that modify
 data
 - added pagination properties to TableUsageResult and options for
 NoSQLClient.getTableUsage
 - added new API NoSQLClient.tableUsageIterable to asynchronously iterate over
table usage records
 - added shard percent usage information to TableUsageResult
 - added IndexInfo.FieldTypes to return the type information on an index on
a JSON field from NoSQLClient.getIndexes and NoSQLClient.getIndex APIs
 - added the ability to ask for and receive the schema of a query using
option getResultSchema for NoSQLClient.prepare and
PreparedStatement.resultSchema property
 - Cloud only: added use of etags, defined tags and free-form tags in APIs
NoSQLClient.tableDDL and NoSQLClient.getTable
 - Cloud only: added new API NoSQLClient.setTableTags to apply defined tags
 and free-form tags to a table

**Fixed**
* Fixed unit test failures due to error in checking of row modification time
in the tests.

## 5.3.4 - 2022-12-14

**Added**
* Cloud only: Added OCI region codes: ORD, TIW, BGY, ORK, SNN, MXP, DUS, DTM,
  SGU, IFP, GCN
* Support for writeMany with multiple tables that share the same shard key.

**Changed**
* Upgraded versions of developer dependencies to remove vulnerabilities and
deprecation warnings.
* Minor reorganization in unit tests, split a big file into multiple files for
better readability.

## 5.3.3 - 2022-09-14

**Added**
* Cloud Service only: Added browser authentication functionality in IAM code.

## 5.3.2 - 2022-08-18

**Added**
* Support for longAsBigInt config option to allow return values of datatype
LONG as JavaScript type bigint.
* Allow PreparedStatement to bind variables by position as well as by name.
* Added copyStatement method to PreparedStatement.

**Changed**

* Changed timeout handling for table DDL and admin operations when called with
_complete: true_ option to ensure that errors that are not related to
completion of the operation on the server side do not result in long waits.
Also, ensure that elapsed time is reflected in subsequent HTTP request
timeouts when the operation is retried by the retry handler.

**Fixed**

* Fixed some issues in writing of packed long and integer.
* Github issue #6: PrivateKey / PrivateKeyFile documentation.
_privateKeyFile_ may only specify the path to private key file, not PEM
string.
* Missing cause of the timeout error in on-prem authentication code.

## 5.3.1 - 2022-06-13

**Added**

* Support for session persistence. If a recognized Set-Cookie HTTP header is
present the SDK will set a Cookie header using the requested session value.

* Added NoSQLClient.precacheAuth() API to pre-create authorization signature
before starting database operations, thus avoiding possible timeout errors
when using Instance Principal.

* Cloud only: Added OCI region codes: JNB, SIN, MAD, MRS, CDG, ARN, AUH, QRO,
MCT, WGA.

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

## 5.3.0 - 2022-02-18

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
