# Veramo Agent
Implementation of a generic veramo agent

This configuration is derived in a large part from the Veramo agent configuration of the Sphereon OID4VC-demo

For more details, please see: https://github.com/Sphereon-Opensource/OID4VC-demo

## Installation

Run `npm install` to install all relevant node modules. Then run `npm run start:dev` to run the basic application.

To get all debugging messages, run using `DEBUG=*:* npm run start:dev`

## Postgres Database

The script has been updated to use a Postgres database instead of a local SQLite file. Database encryption has been disabled to allow easier access to the database internals.

Configure the database using the relevant values in the `.env` or `.env.local` configuration:

- `DB_HOST` (`localhost`)
- `DB_USER` (`postgres`)
- `DB_PASSWORD`
- `DB_NAME` (`postgres`)
- `DB_SCHEMA` (`agent`)

You can run a local dockerised Postgres database using the following command:

```bash
docker run -t -i \
   -e POSTGRES_DB=postgres \
   -e POSTGRES_USER=postgres \
   -e POSTGRES_PASSWORD=postgres \
   -v ./database:/var/lib/postgresql/data \
   -v <veramo-agent-path>/scripts/dbinit:/docker-entrypoint-initdb.d \
   -p 5432:5432 \
   postgres:16-bookworm
```

Make sure to replace the `POSTGRES_PASSWORD` and the `<veramo-agent-path>` with proper values and in general match the vales with the `.env` or `.env.local` configuration.

## Basic Code Setup

Main entry script is `src/agent.ts`
This script first creates a basic Veramo Agent instance with all the relevant plugins. Then it configures the plugins by reading the json configurations. Finally it sets up the Express server to serve the various endpoints.

## Endpoints

Routing and endpoints are set in various places.

### PDManager interface

The agent configuration from the Sphereon demo had an interface to the PDManager. The PDManager manages all Presentation-Definitions:

- `pdmGetDefinition`
- `pdmGetDefinitions`: lists all available presentations
- `pdmAddDefinition`
- `pdmUpdateDefinition`
- `pdmRemoveDefinition`

You could address this interface as follows:

***List all available definitions***
`curl -v http://<host:port>/pdmGetDefinitions -d t=t | jq '.[].id'`

***Inspect a specific definition***
`curl -v http://<host:port>/pdmGetDefinition -d id=43c0725e-3815-4a18-b007-9f5184cc000e | jq '.'`

As interfacing like this with the PDManager is not required for this setup, no such interface is available.
