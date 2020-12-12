# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## Unreleased

**Added**

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
