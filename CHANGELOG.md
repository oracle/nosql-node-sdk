# Change Log

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/).

## 5.2.1 - 2020-02-27

* Fixed violations of no-prototype-builtins ESLint rule.  Updated ESLint
version in devDependencies.

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
