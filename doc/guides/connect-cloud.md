This guide describes how to install, configure, and use the Oracle NoSQL
Database Node.js SDK with the Oracle NoSQL Database Cloud Service.

## Prerequisites

The SDK requires:

* An Oracle Cloud Infrastructure account
* A user created in that account, in a group with a policy that grants the
desired permissions.
* [Node.js](https://nodejs.org) 10.0.0 or higher, running on Linux, Windows or
Mac.
* [Node Package Manager (npm)](https://www.npmjs.com/get-npm) that is
installed with Node.js

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

Configuration for an application has 3 parts:

1. [Acquiring credentials](#creds)
2. [Configuring the application](#supply) using the credentials
3. [Additional configuration](#connecting) such as choosing your region and
other configuration options

See [Example Quick Start](#quickstart) for the quickest way to get an example
running.

### <a name="creds"></a>Acquire Credentials for the Oracle NoSQL Database Cloud Service

See [Acquiring Credentials](https://www.oracle.com/pls/topic/lookup?ctx=en/cloud/paas/nosql-cloud/csnsd&id=acquire-creds) for details of credentials you will need
to configure an application.

These steps only need to be performed one time for a user. If they have already
been done they can be skipped. You need to obtain the following credentials:

* Tenancy ID
* User ID
* API signing key (private key file in PEM format)
* Fingerprint for the public key uploaded to the user's account
* Private key pass phrase, needed only if the private key is encrypted

### <a name="supply"></a>Supply Credentials to the Application

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

#### <a name="config_file"></a>Using a Configuration File

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
```

The driver will look at the location above by default, so the initial
configuration only needs to specify the service type cloud and the region
to which you want to connect. For example:

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

let client = new NoSQLClient({
    serviceType: 'CLOUD',
    region: Region.US_ASHBURN_1
});
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
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

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

#### <a name="config_api"></a>Specifying Credentials Directly

You may specify credentials directly as part of **auth.iam** property in the
initial configuration (see {@link IAMConfig}).  Create {@link NoSQLClient}
instance as follows:

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

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

#### <a name="config_obj"></a>Creating Your Own IAMCredentialsProvider

{@link IMACredentialsProvider} may be any object (class instance or otherwise)
implementing *loadCredentials* function.  This function returns a *Promise* of
{@link IAMCredentials} (and thus can be implemented as an *async* function).
See {@link loadIAMCredentials}.

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

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
by {@link IAMCredentialsProvider} be instances of *Buffer* rather than strings
in which case that the driver will clear them right after they are used.

If your {@link IAMCredentialsProvider} does not need to store any state
information you may provide *loadCredentials* function itself as
value of *credentialsProvider* property:

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

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

## <a name="connecting"></a>Connecting an Application

The first step in your Oracle NoSQL Database Cloud Service application is to
create an instance of {@link NoSQLClient} class which is the main point of
access to the service.  To create {@link NoSQLClient} instance, you need to
supply a {@link Config} object containing information needed to access the
service.  Alternatively, you may choose to supply a path to JSON file
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
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

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
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

const client = new NoSQLClient('/path/to/config.json');
```

In the *examples* directory, you will see JSON configuration files that are
used to create a {@link NoSQLClient} instance as shown above:
* Use *cloud_template.json* for the cloud service when using a
configuration file and default profile as described in section
[Using a Configuration File](#config_file).  Fill in the appropriate region.
* Use *cloudsim.json* for the Cloud Simulator.
* Use *cloud_template_custom.json* for the cloud service to create
a configuration of your choice as described in
[Supply Credentials to the Application](#supply).
Fill in appropriate values for properties needed and remove the rest.

### Specifying Service Type

Because this SDK is used both for the Oracle NoSQL Cloud Service and the
On-Premise Oracle NoSQL Database, the {@link Config} object can specify
that we are connecting to the cloud service by setting
{@link Config}#serviceType property to {@link ServiceType.CLOUD}.  You can
always explicitly specify the {@link Config}#serviceType property, but in some
cases such in code snippets above where the configuration has *auth* object
that contains *iam* property, the service type will be deduced by the driver.
See {@link ServiceType} for details.

If the *auth* object is not present in configuration (such as when using
a configuration file for credentials with a default profile), you must specify
service type as {@link ServiceType.CLOUD} in order to connect to the cloud
service, otherwise the service type will default to
{@link ServiceType.CLOUDSIM} (see [Using the Cloud Simulator](#cloudsim)).

You may specify service type either as {@link ServiceType} enumeration
constant (in code) or as a string (in code and in JSON file).  For example,
when using the default configuration file and default profile:

In code:
```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
const ServiceType = require('oracle-nosqldb').ServiceType;

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

### Specifying a Compartment

In the Oracle NoSQL Cloud Service environment tables are always created in an
Oracle Cloud Infrastructure *compartment* (see
[Managing Compartments](https://docs.cloud.oracle.com/en-us/iaas/Content/Identity/Tasks/managingcompartments.htm)).
It is recommended that compartments be created for tables to better organize
them and control security, which is a feature of compartments.The default
compartment for tables is the root compartment of
the user's tenancy. A default compartment for all requests performed on a handle
can be specified by setting the {@link Config}#compartment property. For example,
to specify a default compartment:
```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

const client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    compartment: 'mycompartment'
});
```

The string value may be either a compartment id or a compartment name or path.
If it is a simple name it must specify a top-level compartment. If it is a path to
a nested compartment, the top-level compartment must be excluded as it is
inferred from the tenancy.

A compartment can also be specified in each request in the options object. This
value overrides the default for the handle.

## <a name="quickstart"></a>Example Quick Start

The examples in the examples directory are configured to make it simple to
connect and run against the Oracle NoSQL Database Cloud Services. Follow
these steps. It is assumed that the SDK has been installed and will be found
by the *node* command.

1. Acquire credentials. See [Acquire Credentials](#creds). You will need these:

* Tenancy ID
* User ID
* API signing key (private key file in PEM format
* Fingerprint for the public key uploaded to the user's account
* Private key pass phrase, needed only if the private key is encrypted

2. Put the information in a configuration file, ~/.oci/config, based on
the format described in [Using a Configuration File](#config_file). It should look
like this:

```ini
[DEFAULT]
tenancy=<your-tenancy-ocid>
user=<your-user-ocid>
fingerprint=<fingerprint-of-your-public-key>
key_file=<path-to-your-private-key-file>
pass_phrase=<your-private-key-passphrase>
```
Instead of using a configuration file it is possible to modify the example code
to directly provide your credentials as described in
[Specifying Credentials Directly](#config_api).

3. Edit and use a JSON configuration file from the examples directory. Edit
*cloud_template.json* and modify it to use the region you want to use. E.g.
for using the US\_ASHBURN\_1 region, it should look like this:
```ini
{
    "serviceType": "CLOUD",
    "region": "your-region-here"
}
```

4.  Run an example using the syntax:
```ini
$ node <example> <config.json>
e.g.
$ node basic_example.js cloud_template.json
```
## <a name="cloudsim"></a>Using the Cloud Simulator

The configuration instructions above are for getting connected to the actual
Oracle NoSQL Database Cloud Service.

You may first get familiar with Oracle NoSQL Database Node.js
SDK and its interfaces by using the [Oracle NoSQL Cloud Simulator](https://docs.oracle.com/en/cloud/paas/nosql-cloud/csnsd/develop-oracle-nosql-cloud-simulator.html).

The Cloud Simulator simulates the cloud service and lets you write and test
applications locally without accessing Oracle NoSQL Database Cloud Service.

You can start developing your application with the Oracle NoSQL Cloud
Simulator, using and understanding the basic examples, before you get
started with the Oracle NoSQL Database Cloud Service. After building, debugging,
and testing your application with the Oracle NoSQL Cloud Simulator,
move your application to the Oracle NoSQL Database Cloud Service.

Follow these instructions to run an example program against the Cloud
Simulator:

1. [Download](https://docs.oracle.com/pls/topic/lookup?ctx=en/cloud/paas/nosql-cloud&id=CSNSD-GUID-3E11C056-B144-4EEA-8224-37F4C3CB83F6)
and start the Cloud Simulator.

2. Edit the cloudsim.json configuration file in the examples directory and
modify the endpoint if using a non-default port or if it is running on another
machine. It should look like this:
```ini
{
    "endpoint": "http://localhost:8080"
}
```
3.  Run an example using the syntax:
```ini
$ node <example> <config.json>
e.g.
$ node basic_example.js cloudsim.json
```

Note that the Cloud Simulator does not require authorization information and
credentials described above that are required by Oracle NoSQL Database
Cloud Service.  Only the endpoint is required and is by default *localhost:8080*.
The service type for Cloud Simulator is {@link ServiceType.CLOUDSIM}.  It is a
default service type when authorization information is not present, so the
configuration that contains only *endpoint* property will be interpreted as
configuration for Cloud Simulator.  See {@link ServiceType} and
*cloudsim.json* in *examples* directory.
