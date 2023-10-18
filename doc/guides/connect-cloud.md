This guide describes how to install, configure, and use the Oracle NoSQL
Database Node.js SDK with the Oracle NoSQL Database Cloud Service.

## Prerequisites

The SDK requires:

* An Oracle Cloud Infrastructure account
* A user created in that account, in a group with a policy that grants the
desired permissions.
* [Node.js](https://nodejs.org) 12.0.0 or higher, running on Linux, Windows or
Mac.
* [Node Package Manager (npm)](https://www.npmjs.com/get-npm) that is
installed with Node.js
* If using TypeScript, [TypeScript](https://www.npmjs.com/package/typescript)
version 5.0.x or higher.

## Downloading and Installing the SDK

You can install the SDK from the npm registry, or alternatively from GitHub.

### npm

You may install the Node.js SDK from
[npm registry](https://www.npmjs.com/package/oracle-nosqldb)

either as a dependency of your project:
```bash
npm install oracle-nosqldb --save
```
or globally:
```bash
sudo npm install -g oracle-nosqldb
```

### GitHub

To install from GitHub:

1. Download the SDK release from
[GitHub](https://github.com/oracle/nosql-node-sdk/releases). The download is
a tarball containing the SDK.
2. Install the SDK from the tarball either as a dependency of your project:
```bash
npm install oracle-nosqldb-5.x.x.tgz --save
```
or globally:
```bash
sudo npm install -g oracle-nosqldb-5.x.x.tgz
```

## <a name="configure_cloud"></a>Configuring the SDK

The SDK requires an Oracle Cloud account and a subscription to the Oracle
NoSQL Database Cloud Service. If you do not already have an Oracle Cloud
account you can start [here](https://docs.cloud.oracle.com/en-us/iaas/Content/GSG/Concepts/baremetalintro.htm).

The SDK is using Oracle Cloud Infrastructure Identity and Access Management
(IAM) to authorize database operations.  For more information on IAM see
[Overview of Oracle Cloud Infrastructure Identity and Access Management](https://docs.cloud.oracle.com/iaas/Content/Identity/Concepts/overview.htm)

To use the SDK, you need to configure it for use with IAM.  The best way to
get started with the service is to use your Oracle Cloud user's identity to
obtain required credentials and provide them to the application.  This is
applicable in most use cases and described below in section
[Authorize with Oracle Cloud User's Identity](#user).

A different configuration that does not require user's credentials may be used
in a couple of special use cases:

* To access Oracle NoSQL Database Cloud Service from a compute instance in the
Oracle Cloud Infrastructure (OCI), use Instance Principal.  See
[Authorizing with Instance Principal](#instance_principal).

* To access Oracle NoSQL Database Cloud Service from other Oracle Cloud
service resource such as
[Functions](https://docs.cloud.oracle.com/en-us/iaas/Content/Functions/Concepts/functionsoverview.htm),
use Resource Principal.
See [Authorizing with Resource Principal](#resource_principal).

### On importing from the SDK

Importing {@link NoSQLClient} class and other classes/types from the SDK is
done differently depending on whether you are using TypeScript or JavaScript
with ES6 modules, or if you are using JavaScript with CommonJS modules:

*TypeScript or JavaScript with ES6 modules:*
```ts
import { NoSQLClient } from 'oracle-nosqldb';
```
*JavaScript with CommonJS modules:*
```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
```

We will use TypeScript/ES6 imports in the tutorial, but both types of imports
are supported. For more information, see
[TypeScript Modules](https://www.typescriptlang.org/docs/handbook/2/modules.html)
and
[Node.js ECMAScript Modules](https://nodejs.org/dist/latest-v18.x/docs/api/esm.html).

### <a name="user"></a>Authorize with Oracle Cloud User's Identity

See sections below on how to [aquire credentials](#creds) and
[configure the application](#supply) to connect to Oracle NoSQL Database Cloud
Service.  You may also need to perform [additional configuration](#connecting)
such as choosing your region, specifying compartment and other configuration
options.

See [Example Quick Start](#quickstart) for the quickest way to get an
example running.

#### <a name="creds"></a>Acquire Credentials for the Oracle NoSQL Database Cloud Service

See [Authentication to connect to Oracle NoSQL Database](https://docs.oracle.com/en/cloud/paas/nosql-cloud/dtddt/index.html)
for details of credentials you will need to configure an application.

These steps only need to be performed one time for a user. If they have already
been done they can be skipped. You need to obtain the following credentials:

* Tenancy ID
* User ID
* API signing key (private key file in PEM format)
* Fingerprint for the public key uploaded to the user's account
* Private key pass phrase, needed only if the private key is encrypted

#### <a name="supply"></a>Supply Credentials to the Application

Credentials are used to authorize your application to use the service.
There are 3 ways to supply credentials:

1. Store credentials in a [configuration file](#config_file).
2. Store credentials directly in a [configuration object](#config_api) used to create
{@link NoSQLClient} instance.
3. [Create your own](#config_obj)
{@link IAMCredentialsProvider} to load credentials on
demand from the location of your choice (e.g. keystore,
keychain, encrypted file, etc.).

The configuration object used to create {@link NoSQLClient} instance (see
[Connecting an Application](#connecting)) will indicate how the driver obtains
the credentials and will be different depending on which of the above options
is chosen.

Creating {@link IAMCredentialsProvider} is the most secure option, because
you are in control of how credentials are stored and loaded by the driver.
Otherwise, the recommended option is to use an Oracle Cloud Infrastructure
configuration file.  Supplying credentials directly in a configuration object is
less secure because sensitive information such as private key will be kept in
memory for the duration of the {@link NoSQLClient} instance.

##### <a name="config_file"></a>Using a Configuration File

You can store the credentials in an Oracle Cloud Infrastructure configuration
file.

The default path for the configuration file is *~/.oci/config*.  The
file may contain multiple profiles.  By default, the SDK uses profile named
**DEFAULT** to store the credentials.

To use these default values, create file named *config* in *~/.oci* directory
with the following contents:

```ini
[DEFAULT]
tenancy=<your-tenancy-ocid>
user=<your-user-ocid>
fingerprint=<fingerprint-of-your-public-key>
key_file=<path-to-your-private-key-file>
pass_phrase=<your-private-key-passphrase>
region=<your-region-identifier>
```

Note that you may also specify your region identifier together with
credentials in the OCI configuration file.  The driver will look at the
location above by default, and if a region is provided together with
credentials, you do not need to provide initial configuration and can use
the no-argument constructor:

```js
import { NoSQLClient } from 'oracle-nosqldb';

let client = new NoSQLClient();
```

Alternatively, you may choose to specify the region in the configuration:
```js
import { NoSQLClient } from 'oracle-nosqldb';

let client = new NoSQLClient({ region: Region.US_ASHBURN_1 });
```

You may choose to use different path for OCI configuration file as well as
different profile within the configuration file.  In this case, specify these
within **auth.iam** property of the initial configuration
(see {@link IAMConfig}).  For example, if your OCI configuration file path is
*~/myapp/.oci/config* and you store your credentials under profile **Jane**:
```ini
...............
...............
[Jane]
tenancy=.......
user=..........
...............
[John]
tenancy=.......
user=..........
...............
```

Then create {@link NoSQLClient} instance as follows:

```js
import { NoSQLClient } from 'oracle-nosqldb';

let client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    auth: {
        iam: {
            configFile: '~/myapp/.oci/config',
            profileName: 'Jane'
        }
    }
});
```

(Note that you don't have to specify service type if you specified
**auth.iam** property, see section **Specifying Service Type**)

##### <a name="config_api"></a>Specifying Credentials Directly

You may specify credentials directly as part of **auth.iam** property in the
initial configuration (see {@link IAMConfig}).  Create {@link NoSQLClient}
instance as follows:

```js
import { NoSQLClient } from 'oracle-nosqldb';

let client = new NoSQLClient({
    region: <your-service-region>
    auth: {
        iam: {
            tenantId: myTenancyOCID,
            userId: myUserOCID,
            fingerprint: myPublicKeyFingerprint,
            privateKeyFile: myPrivateKeyFile,
            passphrase: myPrivateKeyPassphrase
        }
    }
});
```

##### <a name="config_obj"></a>Creating Your Own IAMCredentialsProvider

You may implement your own credentials provider for secure storage and
retrieval of {@link IAMCredentials} as an instance of
{@link IAMCredentialsProvider} interface.
{@link IAMCredentialsProvider#loadCredentials} returns a *Promise* of
{@link IAMCredentials} and thus can be implemented as an *async* function.

```js
import { NoSQLClient } from 'oracle-nosqldb';

class MyIAMCredentialsProvider {
    constructor() {
        // Initialize required state information if needed
    }

    async loadCredentials() {
        .......... //retrieve credentials in preferred manner
        ..........
        return {
            tenantId: myTenancyOCID,
            userId: myUserOCID,
            fingerprint: myPublicKeyFingerprint,
            privateKey: myPEMPrivateKeyData
        };
    }
}

let client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    auth: {
        iam: {
            credentialsProvider: new MyIAMCredentialsProvider(myArgs...)
        }
    }
});
```

It is advised that properties such as *privateKey* and *passphrase* returned
by {@link IAMCredentialsProvider} be instances of {@link !Buffer | Buffer}
rather than strings in which case that the driver will clear them right after
they are used.

You may also set {@link IAMConfig#credentialsProvider} property to a function
with the signature of {@link IAMCredentialsProvider#loadCredentials}:

```js
import { NoSQLClient } from 'oracle-nosqldb';

async function loadMyCredentials() {
    //.....
}

let client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    auth: {
        iam: {
            credentialsProvider: loadMyCredentials
        }
    }
});
```

You may also specify *credentialsProvider* property as string, in which case
it specifies a module name or path that exports
{@link IAMCredentialsProvider}.  This will allow you to store initial
configuration in a JSON file (see [Connecting an Application](#connecting)).
Note that the provider (whether as an object or a function) should be that
module's sole export.

### <a name="instance_principal"></a>Authorizing with Instance Principal

*Instance Principal* is an IAM service feature that enables instances to be
authorized actors (or principals) to perform actions on service resources.
Each compute instance has its own identity, and it authenticates using the
certificates that are added to it.  See
[Calling Services from an Instance](https://docs.cloud.oracle.com/en-us/iaas/Content/Identity/Tasks/callingservicesfrominstances.htm) for prerequisite steps to set up Instance
Principal.

Once set up, create {@link NoSQLClient} instance as follows:

```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    compartment: 'ocid1.compartment.oc1.............................'
    auth: {
        iam: {
            useInstancePrincipal: true
        }
    }
});
```

You may also use JSON config file with the same configuration as described in
[Connecting an Application](#connecting).

Note that when using Instance Principal you must specify compartment id
(OCID) as *compartment* property (see
[Specifying a Compartment](#compartment)).  This is required even if you wish
to use default compartment.  Note that you must use compartment id and not
compartment name or path.  In addition, when using Instance Principal, you may
not prefix table name with compartment name or path when calling
{@link NoSQLClient} APIs.

### <a name="resource_principal"></a>Authorizing with Resource Principal

*Resource Principal* is an IAM service feature that enables the resources to
be authorized actors (or principals) to perform actions on service resources.
You may use Resource Principal when calling Oracle NoSQL Database Cloud
Service from other Oracle Cloud service resource such as
[Functions](https://docs.cloud.oracle.com/en-us/iaas/Content/Functions/Concepts/functionsoverview.htm).
See [Accessing Other Oracle Cloud Infrastructure Resources from Running Functions](https://docs.cloud.oracle.com/en-us/iaas/Content/Functions/Tasks/functionsaccessingociresources.htm)
for how to set up Resource Principal.

Once set up, create {@link NoSQLClient} instance as follows:

```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    compartment: 'ocid1.compartment.oc1.............................'
    auth: {
        iam: {
            useResourcePrincipal: true
        }
    }
});
```

You may also use JSON config file with the same configuration as described in
[Connecting an Application](#connecting).

Note that when using Resource Principal you must specify compartment id
(OCID) as *compartment* property (see
[Specifying a Compartment](#compartment)).  This is required even if you wish
to use default compartment.  Note that you must use compartment id and not
compartment name or path.  In addition, when using Resource Principal, you may
not prefix table name with compartment name or path when calling
{@link NoSQLClient} APIs.

## <a name="connecting"></a>Connecting an Application

The first step in your Oracle NoSQL Database Cloud Service application is to
create an instance of {@link NoSQLClient} class which is the main point of
access to the service.  To create {@link NoSQLClient} instance, you need to
supply a {@link Config} object containing information needed to access the
service.  Alternatively, you may choose to supply a path to a JSON file
that contains the same configuration information as in {@link Config}.

The required information consists of the communication region or endpoint and
authorization information described in section
**Acquire Credentials for the Oracle NoSQL Database Cloud Service** (also see
{@link AuthConfig}).

It is possible to specify a {@link Region} or a string endpoint, but not both. If you
use a Region the endpoint of that Region is inferred. If an endpoint is used it
needs to be either the endpoint of a Region or a reference to a host and port.
For example when using the Cloud Simulator you would use an endpoint string
like **http://localhost:8080**.  Other, optional parameters may
be specified as well.  See API documentation for {@link NoSQLClient},
{@link Config} and {@link AuthConfig} for more information.

For example, to specify the configuration as an object:
```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    auth: {
        iam: {
            configFile: '~/myapp/.oci/config',
            profileName: 'Jane'
        }
    }
});
```

You may choose to store the same configuration in a JSON file.  Create file
**config.json** with following contents:
```json
{
    "region": "US_ASHBURN_1",
    "auth":
    {
        "iam":
       {
            "configFile": "~/myapp/.oci/config",
            "profileName": "Jane"
        }
    }
}
```

Then you may create {@link NoSQLClient} instance as follows:
```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient('/path/to/config.json');
```

In the *examples* directory, you will see JSON configuration files that are
used to create a {@link NoSQLClient} instance as shown above:
* Use *cloud_template.json* for the cloud service to create a configuration of
your choice as described in [Supply Credentials to the Application](#supply).
Fill in appropriate values for properties needed and remove the rest.
* Use *cloudsim.json* for the Cloud Simulator.

Alternatively, you may create {@link NoSQLClient} instance for the cloud
service with no-argument constructor (without config parameter) if you are
using a default configuration file and default profile containing the
credentials and the region as described in section
[Using a Configuration File](#config_file).

### Specifying Service Type

Because this SDK is used both for the Oracle NoSQL Cloud Service and the
On-Premise Oracle NoSQL Database, the {@link Config} object can specify
that we are connecting to the cloud service by setting
{@link Config#serviceType} property to {@link ServiceType.CLOUD}.  You can
always explicitly specify the {@link Config#serviceType} property, but in
cases such in code snippets above where the configuration contains the region,
where configuration has *auth* object that contains *iam* property or where
an initial configuration is not provided (because the region is specified in OCI
configuration file) the service type will be deduced by the driver.
See {@link ServiceType} for details.

You may need to specify the service type explicitly as
{@link ServiceType.CLOUD} only if the *auth.iam* is not present in the
configuration (such as when using OCI configuration file with default profile
for credentials) and the configuration specifies *endpoint* instead of
*region*.  It is recommended to use *region* instead of *endpoint* for Cloud
Service.

Note that the configuration containing endpoint and not containing either
*serviceType* or *auth* will default to {@link ServiceType.CLOUDSIM} (see
[Using the Cloud Simulator](#cloudsim)).

You may specify service type either as {@link ServiceType} enumeration
constant (in code) or as a string (in code and in JSON file).  For example,
when using the default configuration file and default profile:

In code:
```js
import { NoSQLClient, ServiceType } from 'oracle-nosqldb';

const client = new NoSQLClient({
    serviceType: ServiceType.CLOUD,
    region: Region.US_ASHBURN_1
});
```

In JSON configuration file:
```json
{
    "serviceType": "CLOUD",
    "region": "us-ashburn-1"
}
```

###  <a name="compartment"></a>Specifying a Compartment

In the Oracle NoSQL Cloud Service environment tables are always created in an
Oracle Cloud Infrastructure *compartment* (see
[Managing Compartments](https://docs.cloud.oracle.com/en-us/iaas/Content/Identity/Tasks/managingcompartments.htm)).
It is recommended that compartments be created for tables to better organize
them and control security, which is a feature of compartments.The default
compartment for tables is the root compartment of
the user's tenancy. A default compartment for all requests performed on a handle
can be specified by setting the {@link Config#compartment} property. For
example, to specify a default compartment:
```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    compartment: 'mycompartment'
});
```

The string value may be either a compartment id or a compartment name or path.
If it is a simple name it must specify a top-level compartment. If it is a
path to a nested compartment, the top-level compartment must be excluded as it
is inferred from the tenancy.

A compartment can also be specified in each request in the options object. This
value overrides the initial configuration value.

## <a name="quickstart"></a>Example Quick Start

The examples in the *examples* directory are configured to make it simple to
connect and run against the Oracle NoSQL Database Cloud Service. Follow
these steps:

1. Acquire credentials. See [Acquire Credentials](#creds). You will need these:

* Tenancy ID
* User ID
* API signing key (private key file in PEM format)
* Fingerprint for the public key uploaded to the user's account
* Private key pass phrase, needed only if the private key is encrypted

2. Put the information in a configuration file, ~/.oci/config, based on
the format described in [Using a Configuration File](#config_file). It should
look like this:

```ini
[DEFAULT]
tenancy=<your-tenancy-ocid>
user=<your-user-ocid>
fingerprint=<fingerprint-of-your-public-key>
key_file=<path-to-your-private-key-file>
pass_phrase=<your-private-key-passphrase>
region=<your-region-identifier>
```

Alternatively, you may create your own JSON config file to pass to the
examples. Each example takes a JSON config file path as an optional first
command line parameter. Config file templates are in *examples/config*
directory. Make a copy of *cloud_template.json*, fill in appropriate
properties and remove any unused properties.

Instead of using a configuration file it is possible to modify the example code
to directly provide your credentials as described in
[Specifying Credentials Directly](#config_api).

3.  JavaScript examples are in *examples/javascript* directory. You may copy
all files in this directory to a separate directory. The SDK package
*oracle-nosqldb* is the only dependency for these examples.  You may install
it via *package.json* in the same directory (alternatively, you may install
the SDK globally). To run an example:

```bash
npm install
node <example.js> [optional_config_file.json]
```

e.g.
```bash
npm install
node basic_example.js
```

4. TypeScript examples are in *examples/typescript* directory. There are 4
examples: *table_ops.ts*, *single_row_ops.ts*, *multi_row_ops.ts* and
*query_ops.ts*.  They also share some common functionality (see *setup.ts* and
*common.ts*). *package.json* in the same directory contains scripts to build
and run the examples. You may copy all files in this directory to a separate
directory.

Use *npm* to install the dependencies, then you can run each example as
follows:

```bash
npm install
npx tsx <example.ts> [optional_config_file.json]
```

E.g.
```bash
npm install
npx tsx single_row_ops.ts
```

The commands above use [tsx](https://www.npmjs.com/package/tsx) which is
installed as one of the dependencies.

The last parameter is an optional JSON config file (only needed if not using
default OCI config file as described above), e.g.:

```bash
npx tsx single_row_ops.ts config.json
```

Alternatively, you can build the examples into JavaScript. Then
run the resulting .js files, which are created in the *dist* directory, e.g.:

```bash
npm run build
node dist/single_row_ops.js
```

See *package.json* for more details.

## <a name="cloudsim"></a>Using the Cloud Simulator

The configuration instructions above are for getting connected to the actual
Oracle NoSQL Database Cloud Service.

You may first get familiar with Oracle NoSQL Database Node.js
SDK and its interfaces by using the [Oracle NoSQL Cloud Simulator](https://www.oracle.com/downloads/cloud/nosql-cloud-sdk-downloads.html).

The Cloud Simulator simulates the cloud service and lets you write and test
applications locally without accessing Oracle NoSQL Database Cloud Service.

You can start developing your application with the Oracle NoSQL Cloud
Simulator, using and understanding the basic examples, before you get
started with the Oracle NoSQL Database Cloud Service. After building,
debugging, and testing your application with the Oracle NoSQL Cloud Simulator,
move your application to the Oracle NoSQL Database Cloud Service.

Follow these instructions to run an example program against the Cloud
Simulator:

1. [Download](https://www.oracle.com/downloads/cloud/nosql-cloud-sdk-downloads.html)
and start the Cloud Simulator.

2. Copy and edit *cloudsim.json* configuration file in *examples/config*
directory and modify the endpoint if using a non-default port or if it is
running on another machine.  If using default settings, you may use the file
*cloudsim.json* as it is.

It should look like this:
```ini
{
    "endpoint": "http://localhost:8080"
}
```

3. Run examples using instructions provided in the previous section (pars 3
and 4) and the JSON configuration file as described above:

Run a JavaScript example in *examples/javascript* directory using the
syntax:

```bash
node <example.js> <config.json>
```

e.g.
```bash
node basic_example.js ../config/cloudsim.json
```

Run a TypeScript example in *examples/typescript* directory using the
syntax:

```bash
npx tsx <example.ts> -- <config.json>
```

e.g.
```bash
npx tsx single_row_ops.ts -- ../cloudsim.json
```

Note that the Cloud Simulator does not require authorization information and
credentials described above that are required by Oracle NoSQL Database
Cloud Service.  Only the endpoint is required and is by default *localhost:8080*.
The service type for Cloud Simulator is {@link ServiceType.CLOUDSIM}.  It is a
default service type when authorization information is not present, so the
configuration that contains only *endpoint* property will be interpreted as
configuration for Cloud Simulator.  See {@link ServiceType} and
*cloudsim.json* in *examples* directory.
