# Node.js SDK for Oracle NoSQL Database

## Overview

This document is for developers of the Node.js SDK for the Oracle NoSQL
Database.  The target audience are those who want to modify
source code, run and modify tests and examples and build documentation.

## Getting Started

1. Make sure you have [Node.js](https://nodejs.org) and
[NPM](https://www.npmjs.com/get-npm) package manager installed on your
system.  The driver requires Node.js version 12.0.0 or later.  It is
recommended to install LTS version. NPM package manager is installed
with Node.js but could be updated if needed.

TypeScript support is provided for TypeScript versions 5.0.x and higher. 

2.  Clone the repository and install development dependencies:

```bash
git clone https://github.com/oracle/nosql-node-sdk.git
cd nosql-node-sdk
npm install
```

Although the driver is implemented in JavaScript, with the source code in
*lib* directory, TypeScript support is provided via .d.ts declaration files
located *src/types* directory.  For JavaScript and TypeScript, the exports
are declared in *index.js* and *index.d.ts* correspondingly.

Development dependencies are listed in package.json in _devDependencies_
section.  The driver does not have runtime external dependencies.
__npm install__ command above will install all development dependencies
locally in node_modules subdirectory.  You may also install some of these
dependencies globally if needed for convenience.

3. The driver may be used to access
[Oracle NoSQL Database Cloud Service](https://cloud.oracle.com/nosqldatabase)
and
[On-Premise Oracle NoSQL Database](https://docs.oracle.com/en/database/other-databases/nosql-database/index.html).

4.  If developing for the Cloud Service, during development you may use the
driver locally by running tests and examples against
[Oracle NoSQL Database Cloud Simulator](https://docs.oracle.com/en/cloud/paas/nosql-cloud/csnsd/develop-oracle-nosql-cloud-simulator.html)

5. In order to run against Oracle NoSQL Database Cloud Service or against
On-Premise Oracle NoSQL Database you need to set up appropriate configuration.
Please follow instructions in the __Quickstart__ section of
[README](./README.md).

## Running Examples

Two sets of examples are provided, for JavaScript and TypeScript in
*examples/javascript* and *examples/typescript* directories correspondingly.
*examples/config* directory contains template JSON configuration files used to
run the examples.

For each set of examples, it is better to copy its contents
into a separate directory before running, then follow the *Examples* section
of [README](./README.md) for futher instructions.

Note that *package.json* files for each set of examples contain the example
dependencies, which include the SDK itself, and they will be installed from
NPM registry.  Sometimes you may wish to instead use the SDK directly from
the reposity you just cloned instead of NPM version (e.g. when you need to
test your changes).  In this case you may use **npm link** command to link to
the SDK in your repository before running **npm install**.  E.g.

```bash
cd typescript_examples_directory
npm link path/to/nosql-node-sdk
npm install
npx tsx table_ops.ts config.json
```

## Running Tests

Under test directory, you will see a basic smoke test (*smoke.js*) and unit
tests located under *unit* subdirectory.  By default, the tests run against
Oracle NoSQL Database Cloud Simulator and assume that the Cloud Simulator
is running with default endpoint of _localhost:8080_.  In this case you can
run the tests without additional parameters:

```bash
node smoke.js
```

If you want to run the tests against the Oracle NoSQL Database Cloud Service,
On-Premise Oracle NoSQL Database or use different configuration for the Cloud
Simulator, you may provide the configuration file as a parameter:

```bash
node smoke.js config.json
```

The configuration file is usually JSON (but may also be JavaScript module)
that contains configuration object used to create _NoSQLClient_ instance, as
described in the API documentation for _NoSQLClient_.

### Running Unit Tests

__Note:__

__It is recommended to run the unit tests only against the Cloud Simulator or
on-premise NoSQL Database and not against the Cloud Service as the latter
will consume cloud resources and may incur significant cost.__

The unit tests are run with [Mocha](https://mochajs.org/) and also use some
additional libraries, such as chai, chai-as-promised, etc.  These are installed
locally as development dependencies (see *Getting Started*).

To run all unit tests with Cloud Simulator and default NoSQLClient
configuration (Cloud Simulator with endpoint localhost:8080), go to the root
directory of the repository and do:

```bash
npm test
```

#### Using Custom NoSQLClient Configuration

To run unit tests with different NoSQLClient configuration, such as for
On-Premise Oracle NoSQL Database or Cloud Simulator with custom endpoint, you
can provide the configuration file name or path as a parameter with
*--nosql-config* option:

```bash
npm test -- --nosql-config /path/to/config.json
```

You may also invoke mocha directly:

```bash
node_modules/.bin/mocha --nosql-config /path/to/config.json
```

#### Mocha Options

Mocha command is available in node_modules/.bin directory after development
dependencies are installed locally, or if you installed mocha globally, mocha
command will be available to use without specifying its path.

The options used to run the tests and the list of test files are configured in
__.mocharc.json__ Mocha configuration file in the repository root directory.
Note that .mocharc.json sets _min_ test reporter, so you will not
see the output for each individual successful testcase, only errors are
reported.

#### Running Individual Test Cases

If you wish not to use options and test files specified in *.mocharc.json*,
pass _--no-config_ option to mocha.

This can be used to run individual testcases instead of the whole suite:

```bash
cd test/unit
../../node_modules/.bin/mocha --no-config table_ddl.js
../../node_modules/.bin/mocha --no-config get.js --nosql-config config.json
.....
```

#### Running Query Test

Note that running the full query test may take a long time because of many
testcases for advanced query functionality.  You may choose to run only basic
query testcases by using _--basic-query-only_ option with value _true_.  This
option may be used when running only the query test or when running the whole
test suite and can also be combined with other options:

```bash
npm test -- --basic-query-only true
```

```bash
cd test/unit
../../node_modules/.bin/mocha --no-config query.js --basic-query-only true
```

#### Running Against Specific KVStore Version

You can specify kvstore version of the NoSQL service against which you run
unit tests by using _--kv_ option.  This can be done when running the whole
test suite or individual tests:

```bash
npm test -- --kv 20.1
```

```bash
cd test/unit
../../node_modules/.bin/mocha --no-config query.js --kv 20.1
```

This option allows you to run unit tests against older releases and thus skip
testing latest features not supported in these releases.

### Unit Tests for TypeScript Declarations

Unit tests for TypeScript declarations for the driver are located in
*test/unit/types* directory.  These are compile-time only tests and check the
correctness of API signatures and accompanying interfaces and types, as well
as make sure TypeScript compiler flags errors when the APIs are used
incorrectly.  As such, these test files only need to be compiled (you can
also see any errors flagged in VSCode).

These tests use [expect-type](https://www.npmjs.com/package/expect-type)
package as well as *@ts-expect-error* directive to detect incorrect use of the
APIs.

Using **npm test** command as above will also invoke these tests.
Alternatively, you can invoke (compile) them separately:

```bash
cd test/unit/types
npx tsc
```

## Linting and Debugging

### Linting

[ESLint](https://eslint.org/) and
[eslint-plugin-require-path-exists](https://github.com/BohdanTkachenko/eslint-plugin-require-path-exists) plugin are installed as part
of development dependencies.  __.eslintrc.js__ configuration file is also present
in the repository root directory.

You may lint directories or files by just running eslint from the repository
root directory:

```bash
node_modules/.bin/eslint lib
node_modules/.bin/eslint test
```

(If you installed eslint globally you can use eslint command without
specifying its path)

If you are using [Visual Studio Code](https://code.visualstudio.com/) as your
IDE, you may install _VS Code ESLint extension_ from the marketplace.  This
will show any problems found by ESLint directly in the source code editor.

### Debugging

The following applies if you are using
[Visual Studio Code](https://code.visualstudio.com/):

#### JavaScript

Once you open the repository root directory in VSCode, you can add and edit
launch configurations that will be stored in .vscode/launch.json file.

To debug standalone example or test, just use default configuration of type
"node", for example:

```json
    {
        "type": "node",
        "request": "launch",
        "name": "basic_example",
        "program": "${workspaceFolder}/examples/basic_example.js",
        "args": [ "/path/to/config.json" ]
    }
```

You may also debug Mocha unit tests in VSCode.  [This page](https://github.com/microsoft/vscode-recipes/tree/master/debugging-mocha-tests) has more information.

For example, you can use the following launch configuration to debug
individual unit test:

```json
    {
        "type": "node",
        "request": "launch",
        "name": "put_test",
        "program": "${workspaceFolder}/node_modules/mocha/bin/_mocha",
        "args": [ "--no-config", "${workspaceFolder}/test/unit/put.js" ],
        "console": "integratedTerminal",
        "internalConsoleOptions": "neverOpen"
    }
```

#### TypeScript

To debug your Node.js TypeScript application that uses the SDK, please follow
[this guide](https://code.visualstudio.com/docs/typescript/typescript-debugging).

Note that *tsconfig.json* for your application must include either *sourceMap*
or *inlineSourceMap* set to *true* in *compilerOptions*.

Here is the example launch configuration to run one of the TypeScript examples
that come with the SDK:

```json
    {
        "type": "node",
        "request": "launch",
        "name": "debug_query_ops_example",
        "program": "${workspaceFolder}/query_ops.ts",
        "args": [ "config_cloud.json" ],
        "preLaunchTask": "npm: build",
        "outFiles": [ "${workspaceFolder}/dist/*.js" ]
    }
```

This will allow you to debug your application code and also go into JavaScript
code of the SDK.

The *preLaunchTask* property enables building the application before running,
with compiled JavaScript code going into *dist* directory (see *outFiles*
property).

## Building Documentation

API documentation is built with [TypeDoc](https://typedoc.org/) using:

* Documentation comments in the TypeScript declaration files in *src/types*
directory.
* Tutorials in *doc/guides* directory.

To build API documentation, in the repository root directory do:

```bash
npm run docs
```

or use typedoc directly:

```
npx typedoc
```

The resulting API documentation is generated in *doc/site* directory. You can
start browsing from __doc/site/index.html__ file.

The build is controled by *typedoc.json* configuration file. For more
information see [TypeDoc Options](https://typedoc.org/options/).

### Publishing Documentation

The generated documentation is published on
[GitHub](https://oracle.github.io/nosql-node-sdk/). Publication is automatic
based on changes pushed to the gh-pages branch of the
[Oracle NoSQL Database Node.js SDK](https://github.com/oracle/nosql-node-sdk)
repository.

To publish:

In these instructions <nosql-node-sdk> is the path to a current clone from
which to publish the documentation and <nosql-node-doc> is the path to
a fresh clone of the gh-pages branch (see instructions below).

1. clone the gh-pages branch of the SDK repository into <nosql-node-doc>:

        git clone --single-branch --branch gh-pages https://github.com/oracle/nosql-node-sdk.git nosql-node-doc

2. generate documentation in the master (or other designated) branch of the
repository:

        $ cd <nosql-node-sdk>
        $ rm -rf doc/site
        $ npm run docs

3. copy generated doc to the gh-pages repo

        $ cp -r <nosql-node-sdk>/doc/site/* <nosql-node-doc>

4. commit and push after double-checking the diff in the nosql-node-doc
repository

        $ cd <nosql-node-doc>
        $ git commit
        $ git push

The new documentation will automatically be published.

## Packaging and Release

The release package includes

* the library runtime
* typescript declaration files
* examples

### Intallable Archive

To build a local tarball that can be installed using npm:

```
npm pack
```
This creates oracle-nosqldb-x.y.z.tgz which can be installed by using:

```
npm install oracle-nosqldb-x.y.z.tgz
```

### Smoke Test for Validity

See *smoke.js* in section **Running Tests**.

### Upload to npmjs.com

TBD
