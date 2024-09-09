# Veramo Agent
Implementation of a generic veramo agent

This configuration is derived in a large part from the Veramo agent configuration of the Sphereon OID4VC-demo

For more details, please see: https://github.com/Sphereon-Opensource/OID4VC-demo

## Installation

Run `yarn install` to install all relevant node modules. Then run `npm run start:dev` to run the basic application.

To get all debugging messages, run using `DEBUG=*:* npm run start:dev`

## Postgres Database

The script has been updated to use a Postgres database instead of a local SQLite file. Database encryption has been disabled to allow easier access to the database internals.

Configure the database using the relevant values in the `.env` or `.env.local` configuration. Copy the [`.env.example`](./.env.example) to `.env` and optionally change the values. The defaults should work for local development.

You can run a local dockerised Postgres database using the following command:

```bash
docker run -t -i \
   --env-file .env
   -v ./database:/var/lib/postgresql/data \
   -v <veramo-agent-path>/scripts/dbinit:/docker-entrypoint-initdb.d \
   -p 5432:5432 \
   postgres:16-bookworm
```

Make sure to replace the `POSTGRES_PASSWORD` and the `<veramo-agent-path>` with proper values and in general match the vales with the `.env` or `.env.local` configuration.

## Docker Compose

Alternatively, just run `docker compose build` and then `docker compose up` to
install and run both the agent and the database. 

This *won't* install packages, so `yarn install` is still needed. The app
directory is mounted read-only in docker. This way, we can inspect dependencies
in intellisense/lsp while avoiding node_modules to get files and dirs that we
cannot remove on the host.

## Basic Code Setup

Main entry script is `src/agent.ts`
This script first creates a basic Veramo Agent instance with all the relevant plugins. Then it configures the plugins by reading the json configurations. Finally it sets up the Express server to serve the various endpoints.

## Endpoints

Routing and endpoints are set in various places. There are two kinds of endpoints: OpenID4VC endpoints and API endpoints.

### OpenID4VC endpoints

The current setup supports the basic endpoints:

- `<base URL>/<instance>/.well-known/openid-credential-issuer`
- `<base URL>/<instance>/.well-known/openid-configuration`
- `<base URL>/<instance>/.well-known/oauth-authorization-server`
- `<base URL>/<instance>/.well-known/did.json`
- `<base URL>/<instance>/credentials`
- `<base URL>/<instance>/get-credential-offer/:id`

The first URL serves the JSON metadata that configures the issuer. It publishes the available credential templates and the URI to the endpoint that issues the actual credential.

The `openid-configuration` and `oauth-authorization-server` are published to configure the token endpoint in the pre-authorized_code flow. The UniMe wallet
requires the latter and does not read the former. Sphereon reads both. The spec does not require any of them, but then the token endpoint is undefined.

The `did.json` endpoint provides a convenient way of publishing the `did:web` configuration. Configure a reverse proxy on the actual domain of the 
`did:web` to point to this endpoint to complete the configuration. In this way, the agent contains both public and private keys and if the agent
is restarted or keys refreshed, the key configuration will be correct.

The `credentials` URL serves the credential, provided the user can supply the required data (grant, authorization code, pin, credential reference, etc.). This follows the basic OpenID4VC specification.

The `get-credential-offer` endpoint serves the actual credential issuance offer, which is referenced by URI in the QR code.

### API endpoints

The setup has 2 endpoints for the back-end API:

- POST `<base URL>/<institute>/api/create-offer`
- POST `<base URL>/<institute>/api/check-offer`

The first URL creates a credential offer in the agent database based on supplied credentials. The request contains a JSON object:
```json
{
   "credential_issuer": "string",
   "credential_configuration_ids": ["array of string"],
   "grants": {
      "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
         "pre-authorized_code": "string",
         "tx_code": boolean, optional,
      }
   },
   "credentialDataSupplierInput": "object containing key-value pairs of the credentials"
}
```
It returns a JSON object containing the following elements:

- uri (required, the uri that is presented to the wallet as QR code or clickable link (same-device))
- txCode (optional, transaction code that needs to be shared out of band)

At the moment, the agent creates a 4 digit random code when a tx_code is requested.

The `check-offer` endpoint allows the front-end to poll the status of the offer. Depending on the state of the offer, the front-end
can display different messages or adjust the interface. The offer `id` is the pre-authorized_code passed in the `create-offer` call.
The `id` is passed in a POST operation as a json object: `{"id":"<code>"}`

This returns an object as follows:
```json
{
   "createdAt":1725356725408,
   "lastUpdatedAt":1725356725408,
   "status":"OFFER_CREATED"
}
```

The following statuses are currently supported:

- OFFER_CREATED: the offer has been created, but it has not been consumed yet
- OFFER_URI_RETRIEVED: the offer URI endpoint was called, which normally indicates the QR code was scanned
- ACCESS_TOKEN_CREATED: the wallet requested and received an access token
- CREDENTIAL_ISSUED: the credential offer was successfully completed

The time between `ACCESS_TOKEN_CREATED` and `CREDENTIAL_ISSUED` is very short in practice. There is no manual
step in between. Between `OFFER_URI_RETRIEVED` and `ACCESS_TOKEN_GRANTED`, the wallet requests both the 
transaction code and asks the user if he/she wants to accept the credential.
