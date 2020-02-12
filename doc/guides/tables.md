Applications using the Oracle NoSQL Database use tables to store and access
data.  The Node.js SDK supports table and index creation and removal, reading,
updating and deleting records, as well as queries.  This guide provides an
overview of these capabilities.  For complete description of the APIs and
available options, see the API reference.

## Create a NoSQLClient Instance

Class {@link NoSQLClient} represents the main access point to the service.  To
create instance of {@link NoSQLClient} you need to provide appropriate
configuration information.  This information is represented by a plain
JavaScript object and may be provided to the constructor of
{@link NoSQLClient} as the object literal.  Alternatively, you may choose to
store this information in a JSON configuration file and the constructor of
{@link NoSQLClient} with the path (absolute or relative to the application's
current directory) to that file.

Required configuration properties are different depending on what
{@link ServiceType} is used by your application.  Supported service types are
Oracle NoSQL Cloud Service ({@link ServiceType.CLOUD}), Cloud Simulator
({@link ServiceType.CLOUDSIM}) and On-Premise Oracle NoSQL Database
({@link ServiceType.KVSTORE}).  All service types require service endpoint
or region and some require authentication/authorization information.
Other properties are optional and default values will be used if not explicitly
provided.

See {@tutorial connect-cloud} guide on how to configure and connect to the
Oracle NoSQL Database Cloud Service as well as the Cloud Simulator.

See {@tutorial connect-on-prem} guide on how to configure and connect to the
On-Premise Oracle NoSQL Database.

The first example below creates instance of {@link NoSQLClient} for the Cloud
Service using configuration object literal.  It also adds a default compartment
and overrides some default timeout values in the configuration object:

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;

let client = new NoSQLClient({
    region: Region.US_ASHBURN_1,
    timeout: 20000,
    ddlTimeout: 40000,
    compartment: 'mycompartment',
    auth: {
        iam: {
            configFile: '~/myapp/.oci/config',
            profileName: 'Jane'
        }
    }
});
```

The second example stores the same configuration in a JSON file *config.json*
and uses it to create {@link NoSQLClient} instance:

config.json:
```json
{
    "region": "US_ASHBURN_1",
    "timeout": 20000,
    "ddlTimeout": 40000,
    "compartment": "mycompartment",
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

Application code:
```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
let client = new NoSQLClient('config.json');
```

Note that it may not be possible to store the configuration in a file if
it has property values that cannot be represented as JSON types.  In this
case, use the object literal as in the first example above.

### Using a NoSQLClient Instance

{@link NoSQLClient} instance is created synchronously, but most of the
methods of {@link NoSQLClient} are asynchronous since network communication
is required to access the service.  Each of these methods returns *Promise*
object that resolves with the result of corresponding operation or rejects
with an error.  You may use these methods with *async/await* or with Promise
chains.  The following sections show how to use some of the
{@link NoSQLClient} methods with *async/await*.

Note that you may only need one {@link NoSQLClient} instance for your
application, as it is safe to execute multiple concurrent operations
on the same {@link NoSQLClient} instance.  This would be equivalent to
this class being thread-safe in other programming languages.

When you are done using {@link NoSQLClient} instance, you must call
{@link NoSQLClient#close} method to release any resources it may hold.
Failure to call this method may cause your application to hang on exit.

Most methods of {@link NoSQLClient} take an *opt* argument as an optional
last argument.  This is an options object (plain JavaScript object) which
allows you to customize the behavior of each operation.  You may pass it as
object literal.  Any option you specify in this object will override the
corresponding option that was specified in {@link Config} object when
{@link NoSQLClient} instance was created, for this particular operation.
If not specified, option values in {@link Config} will be used.

## Create Tables and Indexes

Learn how to create tables and indexes in the Oracle NoSQL Database.

Creating a table is the first step of developing your application.  To create
tables and execute other Data Definition Language (DDL) statements, such as
creating, modifying and dropping tables as well as creating and dropping
indexes, use method {@link NoSQLClient#tableDDL}.

Before creating a table, learn about:

* Supported data types for the Oracle NoSQL Database. See
[Supported Data Types](https://docs.oracle.com/pls/topic/lookup?ctx=en/cloud/paas/nosql-cloud&id=CSNSD-GUID-833B2B2A-1A32-48AB-A19E-413EAFB964B8).
* Cloud limits. See [Oracle NoSQL Database Cloud Limits](https://docs.oracle.com/pls/topic/lookup?ctx=en/cloud/paas/nosql-cloud&id=CSNSD-GUID-30129AB3-906B-4E71-8EFB-8E0BBCD67144).

Examples of DDL statements are:
```sql

   /* Create a new table called users */
   CREATE IF NOT EXISTS users (id INTEGER, name STRING, PRIMARY KEY (id));

   /* Create a new table called users and with TTL value to of days */
   CREATE IF NOT EXISTS users (id INTEGER, name STRING, PRIMARY KEY (id))
   USING TTL 4 days;

   /* Create a new index called nameIdx on the name field in the users table */
   CREATE INDEX IF NOT EXISTS nameIdx ON users(name);
```

Table DDL statements are executed by {@link NoSQLClient#tableDDL} method.
Like most other methods of {@link NoSQLClient} class, this method is
asynchronous and it returns a *Promise* of {@link TableResult}.
{@link TableResult} is a plain JavaScript object that contains status of DDL
operation such as its {@link TableState}, name, schema and its
{@link TableLimits}.  See {@link TableResult} for description.
{@link TableState} is an enumeration that tells you the current
state of the table.

As well as the statement to execute, {@link NoSQLClient#tableDDL} method
takes *opt* object as the 2nd optional argument.  When you are creating a
table, you must specify its {@link TableLimits} as part of the *opt*
argument.  {@link TableLimits} specifies maximum throughput and storage
capacity for the table as the amount of read units, write units, and
Gigabytes of storage.

Note that {@link NoSQLClient#tableDDL} method only launches the specified
DDL operation in the underlying store and does not wait for its completion.
The resulting {@link TableResult} will most likely have one of intermediate
table states such as {@link TableState.CREATING}, {@link TableState.DROPPING}
or {@link TableState.UPDATING} (the latter happens when table is in the
process of being altered by *ALTER TABLE* statement, table limits are being
changed or one of its indexes is being created or dropped).

When the underlying operation completes, the table state should change to
{@link TableState.ACTIVE} or {@link TableState.DROPPED} (the latter if the
DDL operation was *DROP TABLE*).

You may asynchronously wait for table DDL operation completion in one of
the following ways:

* The recommended way is using {@link NoSQLClient#forCompletion}
and passing the {@link TableResult} of {@link NoSQLClient#tableDDL} to it.
{@link NoSQLClient#forCompletion} will modify the {@link TableResult} passed
to it to reflect operation completion.
* Call {@link NoSQLClient#getTable} method periodically to get the
{@link TableResult} information about the table at a given moment until the
table state changes to {@link TableState.ACTIVE} (or
{@link TableState.DROPPED} for *DROP TABLE* operation).  There are more
convenient ways of accomplishing this described below.
* If you are only interested in operation completion and not any intermediate
states, you may pass *complete* option set to *true* when calling
{@link NoSQLClient#tableDDL}.  In this case, {@link NoSQLCLient#tableDDL}
returns {@link TableResult} only when the operation is completed in the
underlying store, or results in error if the execution of the operation failed
at any time.

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
const TableState = require('oracle-nosqldb').TableState;
.....
const client = new NoSQLClient('config.json');

async function createUsersTable() {
    try {
        const statement = 'CREATE TABLE IF NOT EXISTS users(id INTEGER, ' +
            'name STRING, PRIMARY KEY(id))';
        let result = await client.tableDDL(statement, {
            tableLimits: {
                readUnits: 20,
                writeUnits: 10,
                storageGB: 5
            }
        });
        result = await client.forCompletion(result);
        console.log('Table users created');
    } catch(error) {
        //handle errors
    }
}
```
After the above call returns, *result* will reflect final state of
the operation.

Alternatively, to use *complete* option, substitute the code in *try-catch*
block above with the following:

```js
    const statement = 'CREATE TABLE IF NOT EXISTS users(id INTEGER, ' +
        'name STRING, PRIMARY KEY(id))';
    let result = await client.tableDDL(statement, {
        tableLimits: {
            readUnits: 20,
            writeUnits: 10,
            storageGB: 5
        },
        complete: true
    });
    console.log('Table users created');
```

You need not specify {@link TableLimits} for any DDL operation other
than *CREATE TABLE*.  You may also change table limits of the table
after it has been created by calling {@link NoSQLClient#setTableLimits}
method.  This may also require waiting for the completion the operation
in the same way as waiting for completion of operations initiated by
{@link NoSQLClient#tableDDL}.

## Add Data

Add rows to your table.

When you store data in table rows, your application can easily retrieve, add to,
or delete information from the table.

Method {@link NoSQLClient#put} is used to insert a single row into the table.
It takes table name, row value as plain JavaScript object and *opts*
as an optional 3rd argument.  This method can be used for unconditional and
conditional puts to:

* Overwrite existing row with the same primary key if present. This is the
default.
* Succeed only if the row with the same primary key does not exist.
Specify *ifAbsent* in the *opt* argument for this case: *{ ifAbsent: true }*.
 Alternatively, you may use {@link NoSQLClient#putIfAbsent} method.
* Succeed only if the row with the same primary key exists. Specify
*ifPresent* in the *opt* argument for this case: *{ ifPresent: true }*.
Alternatively, you may use {@link NoSQLClient#putIfPresent} method.
* Succeed only if the row with the same primary key exists and its
{@link Version} matches a specific {@link Version} value.  Set *matchVersion*
in the *opt* argument for this case to the specific version:
*{ matchVersion: my_version }*.  Alternatively, you may use
{@link NoSQLClient#putIfVersion} method and specify the version value
as the 3rd argument (after table name and row).

Each put method returns a *Promise* of {@link PutResult} which is a plain
JavaScript object containing information such as success status and resulting
row {@link Version}.

Note that the property names in the provided row object should be the same
as underlying table column names.  See {@link Row}.

To add rows to your table:

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
.....
const client = new NoSQLClient('config.json');

async function putRowsIntoUsersTable() {
    const tableName = 'users';
    try {
        // Uncondintional put, should succeed
        let result = await client.put(tableName, { id: 1, name: 'John' });

        // Will fail since the row with the same primary key exists
        result = await client.putIfAbsent(tableName, { id: 1, name: 'Jane' });
        // Expected output: putIfAbsent failed
        console.log('putIfAbsent ' + result.success ? 'succeeded' : 'failed');

        // Will succeed because the row with the same primary key exists
        res = await client.putIfPresent(tableName, { id: 1 , name: 'Jane' });
        // Expected output: putIfAbsent succeeded
        console.log('putIfPresent ' + result.success ?
            'succeeded' : 'failed');

        let version = result.version;
        // Will succeed because the version matches existing row
        result = await client.putIfVersion(tableName, { id: 1, name: 'Kim' },
            version);
        // Expected output: putIfVersion succeeded
        console.log('putIfVersion ' + result.success ? 'succeeded' : 'failed');

        // Will fail because the previous put has changed the row version, so
        // the old version no longer matches.
        result = await client.putIfVersion(tableName, { id: 1, name: 'June' },
            version);
        // Expected output: putIfVersion failed
        console.log('putIfVersion ' + result.success ? 'succeeded' : 'failed');

    } catch(error) {
        //handle errors
    }
}
```

Note that {@link PutResult}#success results in *false* value only if
conditional put operation fails due to condition not being satisfied (e.g. row
exists for {@link NoSQLClient#putIfAbsent}, row doesn't exist for
{@link NoSQLClient#putIfPresent} or version doesn't match for
{@link NoSQLClient#putIfVersion}).  If put operation fails for any other
reason, the resulting *Promise* will reject with an error (which you can catch
in *async* function).  For example, this may happen if a column value
supplied is of a wrong type, in which case the put will result in
{@link NoSQLArgumentError}.

You can perform a sequence of put operations on a table that share the same
shard key using {@link NoSQLClient#putMany} method.  This sequence will
be executed within the scope of single transaction, thus making this operation
atomic.  The result of this operation is a *Promise* of
{@link WriteMultipleResult}.  You can also use {@link NoSQLClient#writeMany}
if the sequence includes both puts and deletes.  For details, see the API
Reference.

Using columns of type *JSON* allows more flexibility in the use of data as
the data in the JSON column does not have predefined schema.  To put data
into JSON column, provide either plain JavaScript object or a JSON string
as the column value.  Note that the data in plain JavaScript object must be of
supported JSON types.

## Read Data

Learn how to read data from your table.

You can read single rows using the {@link NoSQLClient#get} method.
This method allows you to retrieve a record based on its primary key value. In
order to read multiple rows in a single operation, see *Use Queries*, below.

You can set consistency of read operation using {@link Consistency}
enumeration. By default all read operations are eventually consistent, using
{@link Consistency.EVENTUAL}.  This type of read is less costly than those
using absolute consistency, {@link Consistency.ABSOLUTE}.  This default
consnstency for read operations can be set in the initial configuration used
to create {@link NoSQLClient} instance using {@link Config}#consistency
property.  You may also change it for a single read operation by setting
*consistency* property in the *opt* argument of the {@link NoSQLClient#get}
method.

{@link NoSQLClient#get} method returns *Promise* of {@link GetResult} which
which is plain JavaScript object containing the resulting row and its
{@link Version}.  If the provided primary key does not exist in the table,
the value of {@link GetResult}#row property will be null.

Note that the property names in the provided primary key key object should be
the same as underlying table column names.  See {@link Key}.

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
const Consistency = require('oracle-nosqldb').Consistency;
.....
const client = new NoSQLClient('config.json');

async function getRowsFromUsersTable() {
        const tableName = 'users';
        try {
            let result = await client.get(tableName, { id: 1 });
            console.log('Got row: ' + result.row);
            // Use absolute consistency
            result = await client.get(tableName, 'users',
                { id: 1 }, { consistency: Consistency.ABSOLUTE });
            console.log('Got row with absolute consistency: ' + result.row);
        } catch(error) {
            //handle errors
        }
    } catch(error) {
        //handle errors
    }
}
```

## Use Queries

Learn about  using queries in your application.

The Oracle NoSQL Database provides a rich query language to read and
update data. See [SQL For NoSQL Specification](http://www.oracle.com/pls/topic/lookup?ctx=en/cloud/paas/nosql-cloud&id=sql_nosql)
for a full description of the query language.

To execute a query use {@link NoSQLClient#query} method. For example, to
execute a *SELECT* query to read data from your table:

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
.....
const client = new NoSQLClient('config.json');

async function queryUsersTable() {
    try {
        let result = await client.query(
            'SELECT * FROM users WHERE NAME = "Taylor"');
        for(let row of result.rows) {
            console.log(row);
        }
    } catch(error) {
        //handle errors
    }
}
```

{@link NoSQLClient#query} method returns *Promise* of {@link QueryResult}
which is plain JavaScript object that contains an *Array* of resulting
rows as well as continuation key.

The amount of data returned by the query is limited by the system default
and could be further limited by setting *maxReadKB* property in the *opt*
argument of {@link NoSQLClient#query}, which means that one invocation of
{@link NoSQLClient#query} method may not return all available results.
This situation is dealt with by using {@link QueryResult}#continuationKey
property.  Not-null continuation key means that more query results may be
available.  This means that queries should generally run in a loop,
looping until continuation key becomes *null*.  Note that it is possible
for {@link QueryResult}#rows to be empty yet have not-null
{@link QueryResult}#continuationKey, which means the query loop should
continue.  See {@link NoSQLClient#query} and {@link QueryResult} for details.

To continue receiving additional results after getting not-null continuation
key, set *continuationKey* property in the *opt* argument of the next
{@link NoSQLClient#query} call:

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
.....
const client = new NoSQLClient('config.json');

async function queryUsersTable() {
    const opt = {};
    try {
        do {
            const result = await client.query('SELECT * FROM users', opt);
            for(let row of result.rows) {
                console.log(row);
            }
            opt.continuationKey = result.continuationKey;
        } while(result.continuationKey);
    } catch(error) {
        //handle errors
    }
}
```

When using queries it is important to be aware of the following considerations:

* The Oracle NoSQL Database provides the ability to prepare queries
for execution and reuse. It is recommended that you use prepared queries
when you run the same query for multiple times. When you use prepared
queries, the execution is much more efficient than starting with a query
string every time. The query language and API support query variables to
assist with query reuse. See {@link NoSQLClient#prepare} and
{@link PreparedStatement} for more information.
* Using *opt* argument of {@link NoSQLClient#query} allows you to set the
read consistency for query as well as modifying the maximum amount of data
it reads in a single call. This can be important to prevent a query from
getting throttled.

Use {@link NoSQLClient#prepare} method to prepare the query.  This method
returns *Promise* of {@link PreparedStatement} object.  Use
{@link PreparedStatement#set} method to bind query variables.  To run prepared
query, pass {@link PreparedStatement} to the {@link NoSQLClient#query} method
instead of the statement string.

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
.....
const client = new NoSQLClient('config.json');

async function queryUsersTable() {
    const statement = 'DECLARE $name STRING; SELECT * FROM users WHERE ' +
        'name = $name';
    try {
        let prepStatement = await client.prepare(statement);

        // Set value for $name variable
        prepStatement.set('$name', 'Taylor');
        let result = await client.query(prepStatement);
        for(let row of result.rows) {
            console.log(row);
        }
        // Set different value for $name and re-execute the query
        prepStatement.set('$name', 'Jane');
        result = await client.query(prepStatement);
        for(let row of result.rows) {
            console.log(row);
        }
    } catch(error) {
        //handle errors
    }
}
```

## Delete Data

Learn how to delete rows from your table.

To delete a row, use {@link NoSQLClient#delete} method.  Pass to it the
table name and primary key of the row to delete.  In addition, you can
make delete operation conditional by specifying on a {@link Version} of the
row that was previously returned by {@link NoSQLClient#get} or
{@link NoSQLClient#put}.  You can pass it as *matchVersion* property of the
*opt* argument: *{ matchVersion: my_version }*.  Alternatively you may use
{@link NoSQLClient#deleteIfVersion} method.

{@link NoSQLClient#delete} and {@link NoSQLClient#deleteIfVersion} methods
return *Promise* of {@link DeleteResult}, which is plain JavaScript object,
containing success status of the operation.  Inaddition, it may contain
information about existing row if the delete operation failed due to
version mismatch and *returnExisting* property was set to *true* in the *opt*
argument.

Note that the property names in the provided primary key key object should be
the same as underlying table column names.  See {@link Key}.

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
.....
const client = new NoSQLClient('config.json');

async function deleteRowsFromUsersTable() {
    const tableName = 'users';
    try {
        let result = await client.put(tableName, { id: 1, name: 'John' });

        // Unconditional delete, should succeed
        result = await client.delete(tableName, { id: 1 });
        // Expected output: delete succeeded
        console.log('delete ' + result.success ? 'succeeded' : 'failed');

        // Delete with non-existent primary key, will fail
        result = await client.delete(tableName, { id: 2 });
        // Expected output: delete failed
        console.log('delete ' + result.success ? 'succeeded' : 'failed');

        // Re-insert the row
        result = await client.put(tableName, { id: 1, name: 'John' });
        let version = result.version;

        // Will succeed because the version matches existing row
        result = await client.deleteIfVersion(tableName, { id: 1 }, version);
        // Expected output: deleteIfVersion succeeded
        console.log('deleteIfVersion ' + result.success ?
            'succeeded' : 'failed');

        // Re-insert the row
        result = await client.put(tableName, { id: 1, name: 'John' });

        // Will fail because the last put has changed the row version, so
        // the old version no longer matches.  The result will also contain
        // existing row and its version because we specified returnExisting in
        // the opt argument.
        result = await client.deleteIfVersion(tableName, { id: 1 }, version,
            { returnExisting: true });
        // Expected output: deleteIfVersion failed
        console.log('deleteIfVersion ' + result.success ?
            'succeeded' : 'failed');
        // Expected output: { id: 1, name: 'John' }
        console.log(result.existingRow);
    } catch(error) {
        //handle errors
    }
}
```

Note that similar to put operations, {@link DeleteResult}#success results in
*false* value only if trying to delete row with non-existent primary key or
because of version mismatch when matching version was specified.  Failure
for any other reason will result in error.

You can delete multiple rows having the same shard key in a single
atomic operation using {@link NoSQLClient#deleteRange} method.  This method
deletes set of rows based on partial primary key (which must be a shard key or
its superset) and optional {@link FieldRange} which specifies a range of
values of one of the other (not included into the partial key) primary key
fields.  For more information, see {@link NoSQLClient#deleteRange} and
{@link FieldRange}.

## Modify Tables

Learn how to modify tables. You modify a table to:

* Add new fields to an existing table
* Delete currently existing fields from a table
* To change the default time-to-live (TTL) value
* Modify table limits

Other than modifying table limits, you use {@link NoSQLClient#tableDDL} to
modify a table by issuing a DDL statement against this table.

Examples of DDL statements to modify a table are:
```sql
   /* Add a new field to the table */
   ALTER TABLE users (ADD age INTEGER);

   /* Drop an existing field from the table */
   ALTER TABLE users (DROP age);

   /* Modify the default TTL value*/
   ALTER TABLE users USING TTL 4 days;
```

Table limits can be modified using {@link NoSQLClient#setTableLimits} method.
It takes table name and new {@link TableLimits} as arguments and returns
*Promise* of {@link TableResult}.

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
const TableState = require('oracle-nosqldb').TableState;
.....
const client = new NoSQLClient('config.json');

async function modifyUsersTableLimits() {
    const tableName = 'users';
    try {
        let result = await client.setTableLimits(tableName, {
            readUnits: 40,
            writeUnits: 10,
            storageGB: 5
        });
        // Wait for the operation completion using specified timeout and
        // specified polling interval (delay)
        await client.forCompletion(result, TableState.ACTIVE, {
            timeout: 30000,
            delay: 2000
        });
        console.log('Table limits modified');
    } catch(error) {
        //handle errors
    }
}
```

As with table creation, when modifying a table, both
{@link NoSQLClient#tableDDL} and {@link NoSQLClient#setTableLimits} may
return before the actual operation is completed in the underlying store and
the {@link TableState} upon return will most likely be intermediate state
{@link TableState.UPDATING}.  Before using the table again, you should wait
for the operation completion in one of the ways described in
**Create Tables and Indexes** section.

Note that {@link NoSQLClient#forCompletion} works by polling for the information
about the operation at regular intervals.  You may customize the wait timeout
(*timeout* property) and the polling interval (*delay* property) by
setting them in the *opt* argument as shown above (otherwise applicable
default values are used).

## Delete Tables and Indexes

Learn how to delete a table or index that you have created in the Oracle NoSQL
Database.

To drop a table or index, use the *DROP TABLE* or *DROP INDEX* DDL statement,
for example:
```sql

   /* Drop the table named users (implicitly drops any indexes on that table) */
   DROP TABLE users;

   /*
    * Drop the index called nameIndex on the table users. Don't fail if the
    * index doesn't exist
    */
   DROP INDEX IF EXISTS nameIndex ON users;
```

These statements are executed by {@link NoSQLClient#tableDDL} method.  As
with table creation and modification, you may wait for the completion of the
operation in the underlying store in one of the ways described in
**Create Tables and Indexes** section.

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
const TableState = require('oracle-nosqldb').TableState;
.....
const client = new NoSQLClient('config.json');

async function dropNameIndexUsersTable() {
    try {
        let result = await client.tableDDL('DROP INDEX nameIndex ON users');
        // Before using the table again, wait for the operation completion
        // (when the table state changes from UPDATING to ACTIVE)
        await client.forCompletion(result);
        console.log('Index dropped');
    } catch(error) {
        //handle errors
    }
}

async function dropTableUsers() {
    try {
        // Here we are waiting until the drop table operation is completed
        // in the underlying store
        let result = await client.tableDDL('DROP TABLE users', {
            completion: true
        });
        console.log('Table dropped');
    } catch(error) {
        //handle errors
    }
}
```

## Handle Errors

Asynchronous methods of {@link NoSQLClient} return *Promise* as a result
and if an error occurs it results in the *Promise* rejection with that
error.  This error can be processed with *.then* and *.catch* statements
of the promise chain as shown:
```js
    client.get('users', { id: 1})
        .then(result => {
            //process get result
        })
        .catch(error => {
            //handle errors
        });
```
or if using *async* function with *async/await* then regular *try/catch*
statement may be used as shown in previous examples.

For synchronous methods such as {@link NoSQLClient} constructor errors
are thrown as exceptions and can be processed using *try/catch*.

All errors used by the SDK are instances of {@link NoSQLError} or one of
its subclasses.  In addition to the error message, each error has
{@link NoSQLError#errorCode} property set to one of standard error codes
defined by the {@link ErrorCode} enumeration.  {@link NoSQLError#errorCode}
may be useful to execute conditional logic depending on the nature of the
error.

For some error codes, specific subclasses of {@link NoSQLError} are
defined, such as {@link NoSQLArgumentError}, {@link NoSQLProtocolError},
{@link NoSQLTimeoutError}, etc.  {@link NoSQLAuthorizationError} may have one
of several error codes depending on the cause of authorization failure.

In addition, errors may have {@link NoSQLError#cause} property set to the
underlying error that caused the current error.  Note that the cause is
optional and may be an instance of an error that is not part of the SDK.

See API reference for {@link ErrorCode}, {@link NoSQLError} and its subclasses
for details.

In addition, error codes are split into 2 broad categories:
* Errors that may be retried with the expectation that the operation may
succeed on retry. Examples of these are {@link ErrorCode.READ_LIMIT_EXCEEDED}
and {@link ErrorCode.WRITE_LIMIT_EXCEEDED} which are throttling errors
(relevant for the Cloud environment), and also {@link ErrorCode.NETWORK_ERROR}
since most network conditions are temporary.
* Errors that should not be retried, as the operation will most likely fail
again. Examples of these include {@link ErrorCode.ILLEGAL_ARGUMENT}
(represented by {@link NoSQLArgumentError}),
{@link ErrorCode.TABLE_NOT_FOUND}, etc.

You can determine if the {@link NoSQLError} is retryable by checking
{@link NoSQLError#retryable} property.  Its value is set to *true* for
retryable errors and is *false* or *undefined* for non-retryable errors.

### Retry Handler

The driver will automatically retry operations on a retryable error.  Retry
handler determines:
* Whether and how many times the operation will be retried.
* How long to wait before each retry.

{@link RetryHandler} is an interface with with 2 properties:
* {@link RetryHandler}#doRetry that determines whether the operation should be
retried based on the operation, number of retries happened so far and the
error occurred.  This property is usually a function, but may be also be set
to boolean *false* to disable automatic retries.
* {@link RetryHandler}#delay that determines how long to wait before each
successive retry based on the same information as provided to
{@link RetryHandler}#doRetry.  This property is usually a function, but may
also be set to number of milliseconds for constant delay.

The driver is configured with default retry handler that will retry retryable
errors depending on the operation type and whether number of retries reached
preconfigured maximum.  It will also use exponential backoff delay to wait
between retries starting with preconfigured base delay.  Maximum number of
retries, base delay and other properties may be customized in
{@link RetryConfig} object which is part of {@link Config} used to create
{@link NoSQLClient} instance.

Alternatively, instead of using default {@link RetryHandler} you may choose to
create your own {@link RetryHandler} and set it as {@link RetryConfig}#handler
property to use custom retry logic.

See documentation for {@link RetryConfig} and {@link RetryHandler} for details.

## Handle Resource Limits

This section is relevant only for the Oracle NoSQL Database Cloud Service
({@link ServiceType.CLOUD} and {@link ServiceType.CLOUDSIM}) and not for the
on-premise NoSQL Database ({@link ServiceType.KVSTORE}).

Programming in a resource-limited environment can be challenging. Tables have
user-specified throughput limits and if an application exceeds those limits
it may be throttled, which means an operation may fail with one of the
throttle errors such as {@link ErrorCode.READ_LIMIT_EXCEEDED} or
{@link ErrorCode.WRITE_LIMIT_EXCEEDED}. This is most common using queries,
which can read a lot of data, using up capacity very quickly. It can also
happen for get and put operations that run in a tight loop.

Even though throttling errors will be retried and using custom
{@link RetryHandler} may allow more direct control over retries, an
application should not rely on retries to handle throttling as this will
result in poor performance and inability to use all of the throughput
available for the table.

The better approach would be to avoid throttling entirely by rate-limiting
your application. In this context *rate-limiting* means keeping operation
rates under the limits for the table.

When you run your operations in a loop, rate-limiting may be as simple as
adding constant delay between your operations in the loop (the delay, like
operations themselves, should be done asynchronously).  This applies to single
row operations such as {@link NoSQLClient#get} and {@link NoSQLClient#put},
as well as to reading {@link NoSQLClient#query} results in a loop using
continuation key, or calling {@link NoSQLClient#deleteRange} over a range
of rows in a loop also using continuation key.

This approach may be improved by computing the delay based on how much
throughput has been consumed by an operation. All data-related operation
results such as {@link GetResult}, {@link PutResult}, {@link DeleteResult},
{@link MultiDeleteResult}, {@link WriteMultipleResult}, {@link PrepareResult}
and {@link QueryResult} include *consumedCapacity* property.
{@link ConsumedCapacity} tells you how many write and read units, as well as
write and read KB has been consumed by an operation.  You may use this
information to keep the throughput within the table limits.

For queries, another option would be to reduce the amount of data read in
a single {@link NoSQLClient#query} call by setting *maxReadKB* parameter in the
*opt* argument.  The same can be done for {@link NoSQLClient#deleteRange}
operation by using *maxWriteKB*.

## Data Types

Plain JavaScript objects (object literals) are used as rows for *put*
operations and as primary keys for *get* and *delete* operations.  The
property names of these objects must match corresponding column names of
the table.  See {@link Row} and {@link Key} for more details on the format
of rows and primary keys.

In addition, the property values of {@link Row} and {@link Key} objects must
be compatible with the underlying database types for corresponding columns.
This means that there are mappings between Oracle NoSQL database types and
JavaScript and Node.js types used by the SDK.

For details on Oracle NoSQL database types, see
[Supported Data Types](https://docs.oracle.com/pls/topic/lookup?ctx=en/cloud/paas/nosql-cloud&id=CSNSD-GUID-833B2B2A-1A32-48AB-A19E-413EAFB964B8).

For example, if the table was created using the following statement:
```sql
CREATE TABLE mytable(id INTEGER, name STRING, created TIMESTAMP,
address RECORD(street STRING, city STRING, zip INTEGER), PRIMARY KEY(id))
```
you may insert the following record using {@link NoSQLClient#put}:
```js
let res = await client.put('mytable', {
    id: 1,
    name: 'myname',
    created: new Date(),
    address: {
        street: '14 My Street',
        city: 'Hometown',
        zip: 12345
    }
});
```

The mappings between JavaScript/Node.js types and the database types are
described in detail in {@link FieldValue}.

Note that for some database types more than one JavaScript/Node.js type may
be used on input (such as {@link Row}s for put operations or {@link Key}s for
get and delete operations).  In general the system is permissive in terms of
valid conversions among types and that any lossless conversion is allowed.
For values returned by the driver (such as results of {@link NoSQLClient#get}
or {@link NoSQLClient#query}) there is a definite JavaScript/Node.js type for
each database type.  {@link FieldValue} describes data type mappings in both
directions.

## Administrative Operations (On-Premise only)

If you are using Node.js SDK with On-Premise Oracle NoSQL Database,  you may
perform administrative operations on the store using
{@link NoSQLClient#adminDDL} method.  These are operations that don't affect
a specific table.  Examples of Data Definition Language (DDL) statements
used with {@link NoSQLClient#adminDDL} include:

* CREATE NAMESPACE mynamespace
* CREATE USER some_user IDENTIFIED BY password
* CREATE ROLE some_role
* GRANT ROLE some_role TO USER some_user

{@link NoSQLClient#adminDDL} method is similar to {@link NoSQLClient#tableDDL}
method and returns a *Promise* of {@link AdminResult} which contains current
operation state (which is either {@link AdminState.COMPLETE} or
{@link AdminState.IN_PROGRESS}), operation id and operation output if any
available.

Like for {@link NoSQLClient#tableDDL} method, {@link AdminResult} returned
by {@link NoSQLClient#adminDDL} does not imply operation completion in the
underlying store.

Similarly, you may asynchronously wait for admin DDL operation completion in
one of the following ways:

* Call {@link NoSQLClient#adminStatus} method periodically to get the
{@link AdminResult} information about the operation at given moment until the
state of the operation changes from {@link AdminState.IN_PROGRESS} to
{@link AdminState.COMPLETE}.  There are more convenient ways of
accomplishing this described below.
* Using {@link NoSQLClient#forCompletion} method and passing the
{@link AdminResult} of {@link NoSQLClient#adminDDL} to it.  This is similar
to using {@link NoSQLClient#forCompletion} for table DDL operations.
{@link NoSQLClient#forCompletion} will modify the {@link AdminResult} passed
to it to reflect operation completion.
* If you are only intrested in operation completion and not any intermediate
states, you may pass *complete* option set to *true* when calling
{@link NoSQLClient#adminDDL}.  In this case, {@link NoSQLClient#adminDDL}
returns {@link AdminResult} only when the operation is completed in the
underlying store, or results in error if the execution of the operation failed
at any time.

Because some of admin DDL statements may include passwords, you may pass them
as *Buffer* containing UTF-8 encoded statement string so that it can be
erased afterwards to avoid keeping sensitive information in memory.

```js
const NoSQLClient = require('oracle-nosqldb').NoSQLClient;
const AdminState = require('oracle-nosqldb').AdminState;
.....
const client = new NoSQLClient('config.json');

async function createUser(userName, password) {
    // password argument above is a Buffer
    const statement = Buffer.concat(
        Buffer.from(`CREATE USER ${userName} IDENTIFIED BY `),
        password);
    try {
        let result = await client.adminDDL(statement);
        await client.forCompletion(result);
        console.log('User created');
    } catch(error) {
        // handle errors
    } finally {
        statement.fill(0); //erase the statement containing password
    }
}

async function createNamespace(namespaceName) {
    try {
        // asynchronously wait for operation completion
        const result = await client.adminDDL(
            `CREATE NAMESPACE ${namespaceName}`, {
                complete: true
            });
        console.log('Namespace created');
    } catch(error) {
        // handle errors
    }
}
```

In addition, there are methods such as {@link NoSQLClient#listNamespaces},
{@link NoSQLClient#listUsers} and {@link NoSQLClient#listRoles} that return
namespaces, users and roles, respectively, present in the store.  These
methods get this information by executing *SHOW* DDL commands (such as
*SHOW AS JSON NAMESPACES*) via {@link NoSQLClient#adminDDL} and parsing the
JSON output of the command which is returned as {@link AdminResult}#output.
