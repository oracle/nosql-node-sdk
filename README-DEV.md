# Node.js SDK for Oracle NoSQL Database

## Overview

This document is for developers of the Node.js SDK for the Oracle NoSQL
Database.  The target audience are those who want to modify
source code, run and modify tests and examples and build documentation.

## Getting Started

1. Make sure you have [Node.js](https://nodejs.org) and
[NPM](https://www.npmjs.com/get-npm) package manager installed on your
system.  The driver requires Node.js version 10.0.0 or later.  It is
recommended to install LTS version.  NPM package manager is installed
with Node.js but could be updated if needed.

2.  Clone the repository and install development dependencies:

```bash
git clone https://github.com/oracle/nosql-node-sdk.git
cd nosql-node-sdk
npm install
```

Development dependencies are listed in package.json in _devDependencies_
section.  The driver does not have runtime external dependencies.
__npm install__ command above will install all development dependencies locally
in node_modules subdirectory.  You may also install some of these dependencies
globally if needed for convenience.

3. The driver may be used to access
[Oracle NoSQL Database Cloud Service](https://cloud.oracle.com/nosqldatabase)
and [On-Premise Oracle NoSQL Database](https://docs.oracle.com/en/database/other-databases/nosql-database/index.html).

4.  If developing for the Cloud Service, during development you may use the
driver locally by running tests and examples against
[Oracle NoSQL Database Cloud Simulator](https://docs.oracle.com/en/cloud/paas/nosql-cloud/csnsd/develop-oracle-nosql-cloud-simulator.html)

5. In order to run against Oracle NoSQL Database Cloud Service or against
On-Premise Oracle NoSQL Database you need to set up appropriate configuration.
Please follow instructions in the __Set up__ section of [README](./README.md).

## Running Examples

Examples are located under *examples* directory.  Note that because examples
need to locate the SDK package, in addition to cloning Github repository, the
SDK package needs to be installed on your system.  Instead of installing from
NPM registry, you can link the package folder that you cloned from Github.
This will enable any changes you make in the cloned repository to be visible
in the linked package.

To link the package into a global folder, for example, if you did a global install of dependencies, execute **npm link** command from
the root of the cloned repository:

```bash
cd nosql-node-sdk
sudo npm link
```

Alternatively, you may link into a different directory as local dependency
of another project, in which case the package will be linked into
*node_modules* directory of that project. For example, if you installed dependencies in nosql-node-sdk/node_modules:

```bash
cd node_modules
npm link <path-to-nosql-node-sdk>
```

Then follow *Examples* section of [README](./README.md) to run the examples.

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
```

(If you installed eslint globally you can use eslint command without
specifying its path)

If you are using [Visual Studio Code](https://code.visualstudio.com/) as your
IDE, you may install _VS Code ESLint extension_ from the marketplace.  This
will show any problems found by ESLint directly in the source code editor.

### Debugging

The following applies if you are using
[Visual Studio Code](https://code.visualstudio.com/):

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

## Building Documentation

API documentation is built with [JSDoc](https://jsdoc.app/) and it uses
[Docdash](https://github.com/clenemt/docdash) template.  Both are installed
as part of development dependencies.

To build API documentation, in the repository root directory do:

```bash
npm run docs
```

or use jsdoc directly:

```
node_modules/.bin/jsdoc -c conf.json
```

If jsdoc is installed but node_modules isn't populated it is possible specify the
expected template file on the command line or by modifying config.json, e.g.
```
jsdoc -c conf.json -t /usr/local/lib/node_modules/docdash
```

JSDoc configuration options and list of source files to build the doc from are
specified in __conf.json__ file in the repository root directory.

The resulting API documentation is output into doc/api directory under the
repository root directory.  You can start browsing from __doc/api/index.html__
file.

Note that the doc should be rebuilt if any public classes/interfaces are
modified.

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
        $ rm -rf doc/api
        $ npm run docs

3. copy generated doc to the gh-pages repo

        $ cp -r <nosql-node-sdk>/doc/api/* <nosql-node-doc>

4. commit and push after double-checking the diff in the nosql-node-doc
repository

        $ cd <nosql-node-doc>
        $ git commit
        $ git push

The new documentation will automatically be published.

## Packaging and Release

The release package includes

* the library runtime
* user documentation
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

TBD

### Upload to npmjs.com

TBD
