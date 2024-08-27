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

## Basic Code Setup

Main entry script is `src/agent.ts`
This script first creates a basic Veramo Agent instance with all the relevant plugins. Then it configures the plugins by reading the json configurations. Finally it sets up the Express server to serve the various endpoints.

## Endpoints

Routing and endpoints are set in various places. There are two kinds of endpoints: OpenID4VC endpoints and API endpoints.

### OpenID4VC endpoints

The current setup supports the basic endpoints:

- `<base URL>/<institute>/.well-known/openid-credential-issuer`
- `<base URL>/<institute>/credentials`

The first URL serves the JSON metadata that configures the issuer. It publishes the available credential templates and the URI to the endpoint that issues the actual credential.

The second URL serves the credential, provided the user can supply the required data (grant, authorization code, pin, credential reference, etc.). This follows the basic OpenID4VC specification.

### API endpoints

The setup has 3 endpoints for the back-end API:

- POST `<base URL>/<institute>/api/create-offer`
- GET `<base URL>/<institute>/api/get-offer/:id`
- POST `<base URL>/<institute>/api/check-offer/`

The first URL creates a credential offer in the agent database based on supplied credentials. The request contains a JSON object:
```json
{
   "credential_issuer": "string",
   "credential_configuration_ids": ["array of string"],
   "grants": {
      "authorization_code": {
         "issuer_state": "string, optional",
         "authorization_server": "string, optional"
      },
      "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
         "pre-authorized-code": "string",
         "tx_code": {
            "input_mode": "'numeric'|'text'",
            "length": "numeric, optional",
            "description": "string, optional"
         },
         "interval": "number, optional",
         "authorization_server": "string, optional",
         "user_pin_required": "optional, boolean"
      }
   },
   "client_id": "string, optional",
   "credential_offer_uri": "string, optional",
   "baseUri": "string, optional",
   "scheme": "string, optional",
   "pinLength": "number, optional",
   "qrCodeOpts": "optional",
   "credentialDataSupplierInput": "object containing key-value pairs of the credentials"
}
```
It returns a JSON object containing the following elements:

- uri
- userPin (optional, string)
- tsCode (option, transaction code description containing information on the constitution of the transaction code for the wallet)
