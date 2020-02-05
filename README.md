# Node.js for Oracle NoSQL Database

## Overview

This is version 5.1 of Node.js SDK for
[Oracle NoSQL Database](https://www.oracle.com/database/technologies/related/nosql.html).
The SDK provides interfaces, documentation, and examples to develop Node.js
applications that use
[Oracle NoSQL Database Cloud Service](https://cloud.oracle.com/nosqldatabase)
and [On-Premise Oracle NoSQL Database](https://docs.oracle.com/en/database/other-databases/nosql-database/index.html).

## Installation

You may install this SDK either as a dependency of your project:

```bash
npm install oracle-nosqldb --save
```
or globally:

```bash
sudo npm install -g oracle-nosqldb
```

## Set up

Required steps depend on whether you want to use the SDK with Oracle NoSQL
Database Cloud Service or On-Premise Oracle NoSQL Database.  This README
provides brief pointers.  For more detailed instructions see the following
guides:

* [Connecting an Application to Oracle NoSQL Database Cloud Service](./doc/api/tutorial-connect-cloud.html) for cloud service and cloud simulator.
* [Connecting an Application to On-Premise Oracle NoSQL Database](./doc/api/tutorial-connect-on-prem.html) for on-premise NoSQL Database.

### Set up for Oracle NoSQL Database Cloud Service

You will need an Oracle Cloud account and credentials to use Node.js SDK
for Oracle NoSQL Database Cloud Service. With this information, you'll set up a
client configuration to tell your application how to find the cloud
service, and how to properly authenticate.
* Start with Oracle Cloud [here](https://www.oracle.com/index.html)
* See [Required Keys and OCIDs](https://docs.cloud.oracle.com/iaas/Content/API/Concepts/apisigningkey.htm) on how to obtain required credentials 

You should have the following information in hand:
1. Tenancy OCID
2. User OCID
3. Public key fingerprint
4. Private key file

These credentials should be placed in OCI configuration file.  Create a file
~/.oci/config with the following contents:
```ini
[DEFAULT]
tenancy=<User OCID>
user=<Tenancy OCID>
fingerprint=<Public key fingerprint>
key_file=<PEM private key file>
pass_phrase=<Private key passphrase>
```

For more information on OCI configuration files, see
[SDK and CLI Configuration File](https://docs.cloud.oracle.com/iaas/Content/API/Concepts/sdkconfig.htm).

Create a file named config.json.  It should specify service type cloud and
the service endpoint (change example endpoint value below to your service
endpoint):
```json
{
  "serviceType": "CLOUD",
  "endpoint": "nosql.us-phoenix-1.oci.oraclecloud.com"
}
```

Once you have config.json, you may create a NoSQLClient instance as follows:
```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
const client = new NoSQLClient('config.json');
```
Be sure to specify either the absolute path to config.json or a relative
path from your current directory.

#### Using Cloud Simulator

When you develop an application, you may wish to start with
[Oracle NoSQL Database Cloud Simulator](https://docs.oracle.com/en/cloud/paas/nosql-cloud/csnsd/develop-oracle-nosql-cloud-simulator.html).
The Cloud Simulator simulates the cloud service and lets you write and test
applications locally without accessing Oracle NoSQL Database Cloud Service.
You may run the Cloud Simulator on localhost.  You need a simple configuration
containing only http endpoint.  See *cloudsim.json* in the *examples*
directory.

### Set up for On-Premise Oracle NoSQL Database

The on-premise configuration requires a running instance of Oracle NoSQL
Database. In addition a running proxy service is required. See
[Oracle NoSQL Database Downloads](https://www.oracle.com/database/technologies/nosql-database-server-downloads.html) for downloads, and see
[Information about the proxy](https://docs.oracle.com/en/database/other-databases/nosql-database/19.3/admin/proxy-and-driver.html)
for proxy configuration information.

Create a file named config.json that will contain initial configuration needed
to create a NoSQLClient instance.  It should contain the endpoint which
specifies the URL of the proxy service.

#### Set up for Secure Store

If running a secure store, the endpoint is HTTPS URL containing host and
port number of the proxy.  In addition, before using the SDK, a user identity
must be created in the store that has appropriate roles or priviliges to
perform the required operations of the application, such as manipulating
tables and data.

This identity (user name and password) may be directly included into
config.json:

```json
{
  "endpoint": "https://<proxy_host>:<proxy_port>",
  "auth": {
    "kvstore": {
      "user": "<User Name>",
      "password": "<User Password>"
    }
  }
}
```
For more security you may choose to store user name and password in separate
file, such as credentials.json:

```json
{
  "user": "<User Name>",
  "password": "<User Password>"
}
```
And pass this file path in config.json:
```json
{
  "endpoint": "https://<proxy_host>:<proxy_port>",
  "auth": {
    "kvstore": {
      "credentials": "path/to/credentials.json"
    }
  }
}
```
You may also choose to use a custom credentials provider.  See the
[guide](./doc/api/tutorial-connect-on-prem.html) for details.

In addition, if the proxy is using private certificate authority (CA) or
a self-signed certificate, set environment variable *NODE\_EXTRA\_CA\_CERTS*
to point to that certificate (.pem or .crt) before running your application:

```bash
export NODE_EXTRA_CA_CERTS="path/to/certificate.pem"
```

#### Set up for Non-Secure Store

If running non-secure store, only endpoint is required, which is HTTP URL of
the proxy.  In addition, specify the service type to let the driver know that
you are using on-premise NoSQL Database.  In config.json, specify:

```json
{
  "serviceType": "KVSTORE",
  "endpoint": "http://<proxy_host>:<proxy_port>",
}
```

In previous configurations shown above, the driver can deduce the service type
from the information in *"auth"* section, but it can always be explicitly
indicated.

Once you have config.json, you may create a NoSQLClient instance as follows:

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
const client = new NoSQLClient('config.json');
```
Be sure to specify either the absolute path to config.json or a relative
path from your current directory.

## Examples

The examples are located in *examples* directory.  Copy the *examples*
directory (or files within it) into a separate location.  If you installed
the SDK locally (as dependency of your project), copy the examples into a
location within your project so that they can locate the SDK package (which
should be installed in *node_modules* directory).  See
[Loading from node_modules Folders](https://nodejs.org/dist/latest-v12.x/docs/api/modules.html#modules_loading_from_node_modules_folders).
If you installed the SDK globally, you may copy the examples to any location
of your choice.

You can run the examples

* Against the cloud service using your Oracle Cloud account and
credentials.
* Locally by using the [Oracle NoSQL Database Cloud Simulator](https://docs.oracle.com/en/cloud/paas/nosql-cloud/csnsd/develop-oracle-nosql-cloud-simulator.html).
* Against On-Premise Oracle NoSQL Database via the proxy.

Three configuration files are provided in the examples directory:

* **cloud_template.json** is used to access a cloud service instance. Use this
template for default configuration as described in
*Set up for Oracle NoSQL Database Cloud Service* section and fill in
appropriate service endpoint.
* **cloud_template_custom.json** is also used to access a cloud service
instance and allows you to customize configuration.  Follow the
*Connect an Application* guide mentioned in the *Set up* section and fill in
appropriate values depending on your choice of configuration and remove unused
properties.
* **cloudsim.json** is used if you are running against the cloud simulator.
You may use this file directly as config file if you are running the cloud
simulator on localhost.
* **kvstore_template.json** is used to access on-premise NoSQL Database via
the proxy.  Copy that file and fill in appropriate values as described in
*Set up for On-Premise Oracle NoSQL Database* section.  For non-secure store,
remove the whole *auth* field from the config file.

Running the example like this:

`node basic_example.js my_config.json`

results in this output:
```
Created NoSQLClient instance
Create table BasicExample
  Creating table BasicExample
  Table state: TableState.CREATING
  Table BasicExample is active

Write a record
  Write used: { readUnits: 0, readKB: 0, writeKB: 1, writeUnits: 1 }

Read a record
  Got record: { cookie_id: 456,
  audience_data:
   { ipaddr: '10.0.00.yyy',
     audience_segment: { sports_lover: '2019-01-05', foodie: '2018-12-31' } } }
  Read used: { readUnits: 1, readKB: 1, writeKB: 0, writeUnits: 0 }

Drop table
  Dropping table BasicExample
  Table state is TableState.DROPPING
Success!
```

## Documentation
API documentation is located in the doc/api directory. See the
[index](doc/api/index.html).

## License

Please see LICENSE.txt file included in the top-level directory of the
package for a copy of the license and additional information.

## Requirements

This package requires Node.js 10.0.0 or higher.
