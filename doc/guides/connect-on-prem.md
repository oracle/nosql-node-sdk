This guide describes how to install, configure, and use the Oracle NoSQL
Database Node.js SDK with On-Premise Oracle NoSQL Database.

## <a name="prereq"></a>Prerequisites

The SDK requires:

* [Oracle NoSQL Database](https://www.oracle.com/database/technologies/related/nosql.html).
See [Oracle NoSQL Database Downloads](https://www.oracle.com/database/technologies/nosql-database-server-downloads.html) to download Oracle NoSQL Database.  See
[Oracle NoSQL Database Documentation](https://docs.oracle.com/en/database/other-databases/nosql-database/index.html) to get started with Oracle NoSQL Database.
In particular, see the [Administrator Guide](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/admin/index.html) on how to install, configure and run Oracle
NoSQL Database Service.
* [Node.js](https://nodejs.org) 12.0.0 or higher, running on Linux, Windows or
Mac.
* [Node Package Manager (npm)](https://www.npmjs.com/get-npm) that is
installed with Node.js
* If using TypeScript, [TypeScript](https://www.npmjs.com/package/typescript)
version 5.0.x or higher.

## Downloading and Installing the SDK

You can install the SDK from the npm registry, or alternatively from GitHub.

### npm

You may install Node.js SDK from
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

## <a name="config"></a>Configuring the SDK

To use the SDK with the On-Premise Oracle NoSQL Database you need the following
components:

1. Running instance of Oracle NoSQL Database.  See [Prerequisites](#prereq).
2. Oracle NoSQL Database Proxy.  The proxy is the middle tier that lets Oracle
NoSQL Database drivers communicate with the database.  See
[Oracle NoSQL Database Proxy](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/admin/proxy.html) for information on how to configure and run the proxy.

A Oracle NoSQL Database instance may be configured and run in secure or
non-secure mode.  Secure mode is recommended.  See
[Oracle NoSQL Database Security Guide](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/security/index.html)
on security concepts and configuration.  Correspondingly, the proxy can be
configured and used with [secure kvstore](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/admin/secure-proxy.html) or
[non-secure kvstore](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/admin/non-secure-proxy.html).

Your application  will connect and use a running NoSQL database via
the proxy service.  The following sections describe information required in non-secure
and secure modes.

### Configuring the SDK for non-secure kvstore

In non-secure mode, the driver communicates with the proxy via the HTTP protocol.
The only information required is the communication *endpoint*.  For on-premise
NoSQL Database, the endpoint specifies the url of the proxy, in the form
*http://proxy_host:proxy_http_port*.  For example:

```js
    const endpoint = 'http://localhost:8080';
```

You may also omit the protocol portion:

```js
    const endpoint = 'myhost:8080'
```

See {@link Config#endpoint} for details.

### <a name="secure"></a>Configuring the SDK for a Secure Store

In secure mode, the driver communicates with the proxy via HTTPS protocol.
The following information is required:

1. Communication endpoint which is the https url of the proxy in the form
*https://proxy_host:proxy_https_port*.  For example:

```js
    const endpoint = 'https://localhost:8181';
```
Note that unless using port 443, the protocol portion of the url is required.
See {@link Config#endpoint} for details.

2. User for the driver which is used by the application to access the kvstore
through the proxy.  Use the following SQL to create the driver user:

```sql
sql-> CREATE USER <driver_user> IDENTIFIED BY "<driver_password>"
sql-> GRANT READWRITE TO USER <driver_user>
```

where, the *driver_user* is the username and *driver_password* is the password
for the *driver_user* user. In this example, the user *driver_user* is granted
*READWRITE* role, which allows the application to perform only read and
write operations.
See [Configuring Authentication](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/security/configuring-authentication.html)
on how to create and modify users.
See [Configuring Authorization](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/security/configuring-authorization.html)
on how to assign roles and privileges to users.

You can use [Oracle NoSQL Database Shell](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/sqlfornosql/introduction-sql-shell.html)
to connect to secure kvstore in order to create the user.  For example:

```bash
java -jar lib/sql.jar -helper-hosts localhost:5000 -store kvstore -security kvroot/security/user.security
```
```sql
sql-> CREATE USER John IDENTIFIED BY "JohnDriver@@123"
sql-> GRANT READWRITE TO USER John
```
(The password shown above is for example purpose only.  All user passwords
should follow the password security policies.  See
[Password Complexity Policies](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/security/password-complexity-policies.html))

The driver requires user name and password created above to authenticate with
a secure store via the proxy.

3. In secure mode the proxy requires SSL
[Certificate and Private key](https://docs.oracle.com/en/database/other-databases/nosql-database/22.3/security/generating-certificate-and-private-key-proxy.html).  If the root
certificate authority (CA) for your proxy certificate is not one of the
trusted root CAs (which for Node.js is one of well-known CAs curated by
Mozilla), the driver needs the certificate chain file (e.g.
*certificates.pem*) or a root CA certificate file (e.g. *rootCA.crt*) in order
to connect to the proxy.  If you are using self-signed certificate instead,
the driver will need the certificate file (e.g. *certificate.pem*) for
the self-signed certificate in order to connect.

To provide the certificate or certificate chain to the driver, before
running your application, set environment variable *NODE_EXTRA_CA_CERTS*.
For example:

```bash
export NODE_EXTRA_CA_CERTS="path/to/driver.trust"
node your_application.js
```

where *driver.trust* is either a certificate chain file (*certificates.pem*)
for your CA, your root CA's certificate (*rootCA.crt*)
or a self-signed certificate (*certificate.pem*).

On the other hand, if the certificate chain for your proxy certificate has
one of well-known CAs at its root (see above), this step is not required.

## Connecting an Application

The first step in your Oracle NoSQL Database application is to
create an instance of {@link NoSQLClient} class which is the main point of
access to the service.  To create {@link NoSQLClient} instance, you need to
supply a {@link Config} object containing information needed to access the
service.  Alternatively, you may choose to supply a path to JSON file
that contains the same configuration information as in {@link Config}.

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

### Specifying Service Type

Since NoSQL Node.js driver is used both for Oracle NoSQL Cloud Service and
On-Premise Oracle NoSQL Database, the {@link Config} object can specify
that we are connecting to on-premise NoSQL Database by setting
{@link Config#serviceType} property to {@link ServiceType.KVSTORE}.  You can
always explicitly specify {@link Config#serviceType} property, but in some
cases such as when connecting to secure store and the configuration has *auth*
object that contains *kvstore* property, the service type will be deduced
by the driver.  See {@link ServiceType} for details.

Other required information has been described in previous sections and
is different for connections to non-secure and secure stores.

### Connecting to a Non-Secure Store

To connect to the proxy in non-secure mode, you need to specify communication
endpoint.

For example, if using configuration JavaScript object:
```js
import { NoSQLClient, ServiceType } from 'oracle-nosqldb';

const client = new NoSQLClient({
    serviceType: ServiceType.KVSTORE,
    endpoint: 'myhost:8080'
});
```

You may also choose to store the same configuration in a file.  Create file
*config.json* with following contents:
```json
{
    "serviceType": "KVSTORE",
    "endpoint": "myhost:8080",
}
```

Then you may use this file to create {@link NoSQLClient} instance:
```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient('/path/to/config.json');
```

As shown above, you may specify value for *serviceType* property
as a string (as well as {@link ServiceType} constant in JavaScript code). See
{@link ServiceType} for details.

### Connecting to a Secure Store

To connect to the proxy in secure mode, in addition to communication endpoint,
you need to specify user name and password of the driver user.  This
information is passed in {@link Config#auth} object under *kvstore* property
and can be specified in one of 3 ways as described below.

Note that in the examples below we will omit *serviceType* in configuration
object/file because {@link ServiceType.KVSTORE} is assumed if *auth* object
in the configuration contains only *kvstore* property.

#### Passing user name and password directly

You may choose to specify user name and password directly:

```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient({
    endpoint: 'https://myhost:8081',
    auth: {
        kvstore: {
            user: 'John',
            password: johnsPassword
        }
    }
});
```

This option is less secure because the password is stored in plain text in
memory.

#### Storing credentials in a file

You may choose to store credentials in a separate file which is protected
by file system permissions, thus making it more secure than previous option,
because the credentials will not be stored in memory, but will be accessed
from this file only when login is needed.

Credentials file should have the following format:
```json
{
    "user":     "<Driver user name>",
    "password": "<Driver user password>"
}
```

Then you may reference this credentials file as following:

```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient({
    endpoint: 'https://myhost:8081',
    auth: {
        kvstore: {
            credentials: 'path/to/credentials.json'
        }
    }
});
```

You may also reference *credentials.json* in the configuration file used to
create {@link NoSQLClient} instance as was shown for non-secure store:

*config.json*
```json
{
    "endpoint": "https://myhost:8081",
    "auth": {
        "kvstore": {
            "credentials": "path/to/credentials.json"
        }
    }
}
```
```js
import { NoSQLClient } from 'oracle-nosqldb';

const client = new NoSQLClient('/path/to/config.json');
```

#### Creating Your Own KVStoreCredentialsProvider

You may implement your own credentials provider for secure storage and
retrieval of driver credentials as an instance of
{@link KVStoreCredentialsProvider} interface. Note that
{@link KVStoreCredentialsProvider#loadCredentials} returns a Promise and can
be implemented as an *async* function:

```js
import { NoSQLClient } from 'oracle-nosqldb';

class MyKVStoreCredentialsProvider {
    constructor() {
        // Initialize required state information if needed
    }

    async loadCredentials() {
        // Obtain client id, client secret, user name and user password somehow
        return { // Return credentials object as a result
            user: driverUserName,
            password: driverPassword
        };
    }
}

let client = new NoSQLClient({
    endpoint: 'https://myhost:8081',
    auth: {
        kvstore: {
            credentials: new MyKVStoreCredentialsProvider(myArgs...)
        }
    }
});
```

You may return {@link KVStoreCredentials#password} as either
{@link !Buffer | Buffer} (UTF8-encoded) or *string*, but it is advisable to
use {@link !Buffer | Buffer}, because the driver will erase its contents once
login is performed.

You may also set {@link KVStoreAuthConfig#credentials} property to a function
with the signature of {@link KVStoreCredentialsProvider#loadCredentials}:

```js
import { NoSQLClient } from 'oracle-nosqldb';

async function loadMyCredentials() {
    //.....
}

let client = new NoSQLClient({
    endpoint: 'ndcs.uscom-east-1.oraclecloud.com',
    auth: {
        kvstore: {
            credentials: loadMyCredentials
        }
    }
});
```

### Examples

The examples in the *examples* directory are configured to make it simple to
connect and run against the On-Premise Oracle NoSQL Database.

In the *examples/config* directory, you will see a configuration file template
*kvstore_template.json*.  It is used as configuration file to create
{@link NoSQLClient} instance as shown above.  Make a copy of this file and
fill in appropriate values.  For a secure store, leave either *user* and
*password* or the *credentials* property inside the *kvstore* object and
remove the rest. For a non-secure store, remove all properties in the
*kvstore* object or remove the *auth* property entirely.

Follow these steps:

1. An Oracle NoSQL Database instance must be running

2. A proxy server instance must be running, connected to the database

3. Edit the *kvstore_template.json* file as described above, based on the
proxy configuration.

Here's an example of a config file for a not-secure, local proxy:
```ini
{
    "serviceType": "KVSTORE",
    "endpoint": "http://localhost:80"
}
```

An example of a config file for a secure proxy and store. Note that it may
be necessary to configure your system so that *node* finds the required
certificates. See [Configuring the SDK for a Secure Store](#secure).
```ini
{
    "serviceType": "KVSTORE",
    "endpoint": "https://somehost:443",
    "auth":
    {
        "kvstore":
        {
            "user": "driverUser",
            "password": "driverPassword05@"
        }
    }
}
```

4. JavaScript examples are in *examples/javascript* directory. You can copy
all files in this directory to a separate directory. The SDK package
*oracle-nosqldb* is the only dependency for these examples. You may install
it via *package.json* in the same directory (alternatively, you may install
the SDK globally). To run an example:

```bash
npm install
node <example.js> <config.json>
```

E.g.
```bash
npm install
$ node basic_example.js kvstore_config.json
```

5. TypeScript examples are in *examples/typescript* directory. There are 4
examples: *table_ops.ts*, *single_row_ops.ts*, *multi_row_ops.ts* and
*query_ops.ts*.  They also share some common functionality (see *setup.ts* and
*common.ts*). *package.json* in the same directory contains scripts to build
and run the examples. You can copy all files in this directory to a separate
directory.

Use *npm* to install the dependencies, then you can run each example as
follows:

```bash
npm install
npx tsx <example.ts> <config.json>
```

E.g.
```bash
npm install
npx tsx single_row_ops.ts kvstore_config.json
```

The commands above use [tsx](https://www.npmjs.com/package/tsx) which is
installed as one of the dependencies.

Alternatively, you can build the examples into JavaScript. Then
run the resulting .js files, which are created in the *dist* directory, e.g.:

```bash
npm run build
node dist/single_row_ops.js kvstore_config.json
```

See *package.json* for more details.
