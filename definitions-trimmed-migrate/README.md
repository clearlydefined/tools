# Migration script to trim definitions-paged

## Goal:

Migrate all blob records to definitions-trimmed collection if record does not yet exist in definitions-trimmed collection

## Things to log in AI:

-   Total count of documents and blobs at the start of the migration steps
-   Start time of migration step
-   Total documents/blobs migrated/processed so far
-   For step 1, the partitionKey
-   Failures

## To Run

-   `npm install`
-   `npm run build`
-   Configure environment variables
-   `npm start`
