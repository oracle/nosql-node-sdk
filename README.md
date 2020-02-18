# Node.js for Oracle NoSQL Database

## Overview

This is version 5.2 of the Node.js SDK for
the [Oracle NoSQL Database](https://www.oracle.com/database/technologies/related/nosql.html).
The SDK provides interfaces, documentation, and examples to develop Node.js
applications that use the
[Oracle NoSQL Database Cloud Service](https://cloud.oracle.com/nosqldatabase)
and the [On-Premise Oracle NoSQL Database](https://docs.oracle.com/en/database/other-databases/nosql-database/index.html).

## Installation

You may install this SDK either as a dependency of your project:

```bash
npm install oracle-nosqldb --save
```
or globally:

```bash
sudo npm install -g oracle-nosqldb
```

## Documentation

See the [API and user guide documentation](https://oracle.github.io/nosql-node-sdk/).

## Quickstart

For detailed information and API documentation about using the SDK in different
environments see the [documentation](https://oracle.github.io/nosql-node-sdk/)

The following is a quick start tutorial to run a simple program in the supported
environments. The same template source code is used for all environments. The
first step is to cut the program below and paste it into an editor for minor
modifications. The instructions assume that is stored as quickstart.js, but you
can use any name you like. The quickstart example supports 3 environments:
1. Oracle NoSQL Database Cloud Service
2. Oracle NoSQL  Cloud Simulator
3. Oracle NoSQL  Database on-premise, using the proxy server

See [running quickstart](#run_quickstart) for instructions on how to edit and
run the quickstart program in different environments.

```js
/*
 * A simple example that
 *   - creates a table
 *   - inserts a row using the put() operation
 *   - reads a row using the get() operation
 *   - drops the table
 *
 * To run:
 *  1. Edit for your target environment and credentials
 *  2. Run it:
 *       node quickstart.js cloud|cloudsim|kvstore
 *
 *  Use 'cloud' for the Oracle NoSQL Database Cloud Service
 *  Use 'cloudsim' for the Oracle NoSQL Cloud Simulator
 *  Use 'kvstore' for the Oracle NoSQL Database on-premise
 */
'use strict';

const nosqldb = require('oracle-nosqldb');
const NoSQLClient = nosqldb.NoSQLClient;
const Region = require('oracle-nosqldb').Region;
const ServiceType = require('oracle-nosqldb').ServiceType;

// Target table used by this example
const TABLE_NAME = 'NodeQuickstart';
const USAGE = 'Usage: node quickstart.js cloud|cloudsim|kvstore';

async function quickstart() {
    let client;
    try {
        const args = process.argv;
        let nosqlEnv = args[2];
        if (!nosqlEnv) {
            return console.error(USAGE);
        }
        // Set up access to the cloud service
        client = createClient(nosqlEnv);
        console.log('Created NoSQLClient instance');
        await run(client);
        console.log('Success!');
    } catch (err) {
        console.error('  Error: ' + err.message);
        console.error('  from: ');
        console.error(err.operation);
    } finally {
        if (client) {
            client.close();
        }
    }
}

/*
 * This function encapsulates environmental differences and returns a
 * client handle to use for data operations.
 */
function createClient(nosqlEnv) {

    switch(nosqlEnv) {
    case 'cloud':
        return new NoSQLClient({
            /*
             * EDIT:
             * 1. use desired region id
             * 2. your tenancy's OCID, user's OCID
             * 3. privateKeyFile path
             * 4. fingerprint for uploaded public key
             * 5. optional passphrase. If your key has none, delete this
             * line (and the leading ',').
             */
            region: Region.<your-region-here>,
            auth: {
                iam: {
                    tenantId: 'your tenancy OCID',
                    userId: 'your user OCID',
                    fingerprint: 'your public key fingerprint',
                    privateKeyFile: 'path to private key file or private key',
                    passphrase: 'pass phrase if set for your private key'
                }
            }
        });
    case 'cloudsim':
        /*
         * EDIT: if the endpoint does not reflect how the Cloud
         * Simulator has been started, modify it accordingly.
         */
        return new NoSQLClient({
            serviceType: ServiceType.CLOUDSIM,
            endpoint: 'localhost:8080'
        });
    case 'kvstore':
        /*
         * EDIT: if the endpoint does not reflect how the Proxy
         * Server has been started, modify it accordingly.
         */
        return new NoSQLClient({
            serviceType: ServiceType.KVSTORE,
            endpoint: 'localhost:80'
        });
    default:
        throw new Error('Unknown environment: ' + nosqlEnv);
    }
}

/*
 * Create a table, read and write a record
 */
async function run(client) {
    const createDDL = `CREATE TABLE IF NOT EXISTS ${TABLE_NAME} \
(cookie_id LONG, audience_data JSON, PRIMARY KEY(cookie_id))`;
    console.log('Create table ' + TABLE_NAME);
    let res = await client.tableDDL(createDDL, {
        tableLimits: {
            readUnits: 1,
            writeUnits: 5,
            storageGB: 1
        }
    });
    console.log('  Creating table %s', res.tableName);
    console.log('  Table state: %s', res.tableState.name);

    // Wait for the operation completion
    await client.forCompletion(res);
    console.log('  Table %s is created', res.tableName);
    console.log('  Table state: %s', res.tableState.name);

    // Write a record
    console.log('\nWrite a record');
    res = await client.put(TABLE_NAME, {
        cookie_id: 456,
        audience_data: {
            ipaddr: '10.0.00.yyy',
            audience_segment: {
                sports_lover: '2019-01-05',
                foodie: '2018-12-31'
            }
        }
    });
    if (res.consumedCapacity) {
        console.log('  Write used: %O', res.consumedCapacity);
    }

    // Read a record
    console.log('\nRead a record');
    res = await client.get(TABLE_NAME, { cookie_id: 456 });
    console.log('  Got record: %O', res.row);
    if (res.consumedCapacity) {
        console.log('  Read used: %O', res.consumedCapacity);
    }

    // Drop the table
    console.log('\nDrop table');
    const dropDDL = `DROP TABLE ${TABLE_NAME}`;
    res = await client.tableDDL(dropDDL);
    console.log('  Dropping table %s', res.tableName);

    // Wait for the table to be removed
    await client.forCompletion(res);
    console.log('  Operation completed');
    console.log('  Table state is %s', res.tableState.name);
}

quickstart();
```

### <a name="run_quickstart"></a> Running Quickstart

#### Run Against the Oracle NoSQL Database Cloud Service

Running against the Cloud Service requires an Oracle Cloud account. See
[Configuring for the Cloud Service](https://oracle.github.io/nosql-node-sdk/tutorial-connect-cloud.html#configure_cloud) for information on getting an account and
acquiring required credentials.

1. Collect the following information:

* Tenancy ID
* User ID
* API signing key (private key file in PEM format
* Fingerprint for the public key uploaded to the user's account
* Private key pass phrase, needed only if the private key is encrypted

2. Edit *quickstart.js*  and add your information in the 'cloud' section of the
*createClient()* function.

3. Decide the region you want to use and add that in the same section in the
value for the *region* key.

4. Run the program:

```js
node quickstart.js cloud
```
If you would prefer to create a configuration file for credentials instead of
modifying the program put credentials in a file (see
[Using a Configuration File](https://oracle.github.io/nosql-node-sdk/tutorial-connect-cloud.html#config_file)). Then modify quickstart.js to use the file:

Replace

```ini
iam: {
    tenantId: 'your tenancy OCID',
    userId: 'your user OCID',
    fingerprint: 'your public key fingerprint',
    privateKeyFile: 'path to private key file or private key',
    passphrase: 'pass phrase if set for your private key'
}
```
with

```
iam: {
    configFile: 'path-to-config-file',
    profileName: 'DEFAULT'
}
```

#### Run Against the Oracle NoSQL Cloud Simulator

Running against the Oracle NoSQL Cloud Simulator requires a running Cloud
Simulator instance. See [Using the Cloud Simulator](https://oracle.github.io/nosql-node-sdk/tutorial-connect-cloud.html#cloudsim) for information on how to download
and start the Cloud Simulator.

1. Start the Cloud Simulator based on instructions above. Note the HTTP port
used. By default it is *8080* on *localhost*.

2. The *quickstart.js* program defaults to *localhost:8080* so if the Cloud
Simulator was started using default values no editing is required.

3. Run the program:

```js
node quickstart.js cloudsim
```

#### Run Against Oracle NoSQL on-premise

Running against the Oracle NoSQL Database on-premise requires a running
Oracle NoSQL Database instance as well as a running NoSQL Proxy server instance.
The program will connect to the proxy server.

See [Connecting to an On-Premise Oracle NoSQL Database](https://oracle.github.io/nosql-node-sdk/tutorial-connect-on-prem.html) for information on how to download
and start the database instance and proxy server. The database and proxy should
be started without security enabled for this quickstart program to operate
correctly. A secure configuration requires a secure proxy and more complex
configuration.

1. Start the Oracle NoSQL Database and proxy server  based on instructions above.
Note the HTTP port used. By default the endpoint is *localhost:80*.

2. The *quickstart.js* program defaults to *localhost:80*. If the proxy was started
using a different host or port edit the settings accordingly.

3. Run the program:

```js
node quickstart.js kvstore
```

## License

Please see the [LICENSE](LICENSE.txt) file included in the top-level directory of the
package for a copy of the license and additional information.

## Requirements

This package requires Node.js 10.0.0 or higher.
