# Documentation for the Oracle NoSQL Database Node.js SDK

This is a README for the gh-pages branch of the
[Oracle NoSQL Database Node.js SDK repository](https://github.com/oracle/nosql-node-sdk). This branch is used to publish documentation on GitHub.

## Building and Publishing Documentation

Generated documentation is published on
[GitHub](https://oracle.github.io/nosql-node-sdk/) using the GitHub Pages
facility. Publication is automatic based on changes pushed to this (gh-pages)
branch of the
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
