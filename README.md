# Veramo Agent
Implementation of a generic veramo agent

This configuration is derived in a large part from the Veramo agent configuration of the Sphereon OID4VC-demo

For more details, please see: https://github.com/Sphereon-Opensource/OID4VC-demo

## Installation

Run `yarn install` to install all relevant node modules. Then run `npm run start:dev` to run the basic application.

To get all debugging messages, run using `DEBUG=*:* npm run start:dev`

### Postgres Database

The application uses a Postgres database instead of a local SQLite file. Database encryption has been disabled to allow easier access to the database internals.

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

### OpenObserver

The application can log to an OpenObserver log application. Please provide the service URL and user bearer token in the environment file.

You can run a local dockerised OpenObserver container using the following command:

```bash
docker run -t -i \
    --env-file .env
    --env ZO_DATA_DIR=/data
    --env ZO_ROOT_USER=<root user login/email>
    --env ZO_ROOT_USER_PASSWORD=topsecret
    --env ZO_INGEST_FLATTEN_LEVEL=1
    -v ./data:/data
    -p 5080:5080
    public.ecr.aws/zinclabs/openobserve:latest
```

### Docker Compose

Alternatively, just run `docker compose build` and then `docker compose up` to
install and run the agent, the database and the openobserver log container.

This *won't* install packages, so `yarn install` is still needed. The app
directory is mounted read-only in docker. This way, we can inspect dependencies
in intellisense/lsp while avoiding node_modules to get files and dirs that we
cannot remove on the host.

## Basic Code Setup

Main entry script is `src/agent.ts`
This script first creates a basic Veramo Agent instance with all the relevant plugins. Then it configures the plugins by reading the json configurations. Finally it sets up the Express server to serve the various endpoints.

## Status Lists

This application implements `StatusList2021`, which is an outdated version of `BitstringStatuslist`. See
https://w3c.github.io/vc-bitstring-status-list/ for more information.

If a status list is configured for an issuer, the application will request the status list agent to reserve a bit
in the bitstring. The relevant data is returned in the `credentialStatus` attribute of the credential. This information
is also stored in the database, so it can be used for later revocation and/or suspension.

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

The setup has the following endpoints for the back-end API:

- POST `<base URL>/<institute>/api/create-offer`
- POST `<base URL>/<institute>/api/check-offer`
- POST `<base URL>/<institute>/api/list-credentials`
- POST `<base URL>/<institute>/api/revoke-credential`

#### Create Offer

POST `<base URL>/<institute>/api/create-offer`

This creates a credential offer in the agent database based on supplied credentials. The request contains a JSON object:
```json
{
   "credentials": ["array of string"],
   "grants": {
      "authorization_code": {
         "issuer_state": "generate"
      },
      "urn:ietf:params:oauth:grant-type:pre-authorized_code": {
         "pre-authorized_code": "string",
         "tx_code": boolean, optional,
      }
   },
   "credentialDataSupplierInput": "object containing key-value pairs of the credentials",
   "credentialMetadata": "object containing key-value pairs defining the metadata",
   "pinLength": number
}
```

Please note the following:

- the example displays two grant types. Usually only one of either is used (the front-end-issuer either has authenticated the user, or it has not). Which one is used depends on the configuration of the back-end-issuer for this specific instance
- in the `authorization_code.issuer_state` field, the example shows the content `generate`. This is a special-case situation forcing the back-end-issuer to generate a new state value. Preferably the `issuer_state` was left undefined, but that may cause the entire `authorization_code` object to be removed by intermediate libraries. To prevent that, fill the `issuer_state` with the special `generate` value. The response will provide the actual state identifier used for this session
- the `pre-authorized_code` field can be undefined, in which case a random code is generated. However, to prevent the grant containing an empty object which may be removed by the intermediate libraries, the value `generate` may be used to force a random state code, like for the `issuer_state` in the previous paragraph

The `credentialMetadata` attribute can contain settings about the credential. Currently the following are defined:

- `expiration`: a number representing the seconds after issuance date for the credential to expire. For backwards compatibility, the credential data fields `_exp` and `_ttl` are also supported and serve the same purpose
- `enableStatusLists`: a boolean field that enables or disables generating status list information. If not specified, but status lists are configured for an issuer, status list information is generated. Set this field explicitely to `false` to prevent generating status list information

The call returns a JSON object containing the following elements:

```json
{
   "uri": "the uri that is presented to the wallet as QR code or clickable link (same-device)",
   "txCode":  "optional, transaction code that needs to be shared out of band",
   "id": "a string value containing the unique identifier with which to refer to this offer/session"
}

At the moment, the agent by default creates a 4 digit random code when a tx_code is requested.

#### Check Offer

POST `<base URL>/<institute>/api/check-offer`

The `check-offer` endpoint allows the front-end to poll the status of the offer. Depending on the state of the offer, the front-end
can display different messages or adjust the interface. The offer `id` is the `id` value returned in the `create-offer` call.
The `id` is passed in a POST operation as a json object: `{"id":"<code>"}`

This returns an object as follows:

```json
{
   "createdAt":1725356725408,
   "lastUpdatedAt":1725356725408,
   "status":"CREDENTIAL_ISSUED",
   "uuid": "64d37ada-5671-4d6d-b74d-031b925fe2c9"
}
```

The `uuid` attribute is only available when an actual credential was issued to the wallet. This `uuid` can be used by the issuing front-end
to interface with the revocation api as defined below.

The following statuses are currently supported:

- OFFER_CREATED: the offer has been created, but it has not been consumed yet
- OFFER_URI_RETRIEVED: the offer URI endpoint was called, which normally indicates the QR code was scanned
- ACCESS_TOKEN_CREATED: the wallet requested and received an access token
- CREDENTIAL_ISSUED: the credential offer was successfully completed

The time between `ACCESS_TOKEN_CREATED` and `CREDENTIAL_ISSUED` is very short in practice. There is no manual
step in between. Between `OFFER_URI_RETRIEVED` and `ACCESS_TOKEN_GRANTED`, the wallet requests both the 
transaction code and asks the user if he/she wants to accept the credential.

#### List Credentials

POST `<base URL>/<institute>/api/list-credentials`

This endpoint allows an issuer to list the credentials it has previously issued. This can be used in use cases where
users want to revoke or re-issue/refresh credentials. The POST data field can contain filtering options (each field
is optional):

```
{
   state: <filter based on a specific unique state previously used by the front-end issuer>,
   holder: <filter based on the holder key specification of a wallet>,
   credential: <filter based on the credential type>,
   primaryId: <filter based on the primary identifier for a credential (the unique user id)>,
   issuanceDate: <filter on credentials issued after this date>
}
```

The endpoint returns a JSON array containing all the database rows, including the database id, the uuid, claims, status-list information
and saved-updated dates. This data can be used in further interactions.

#### Revoke Credential

POST `<base URL>/<institute>/api/revoke-credential`

This endpoint allows an issuer to list the credentials it has previously issued. This can be used in use cases where
users want to revoke or re-issue/refresh credentials. The POST data field can contain filtering options (each field
is optional):

```
{
   uuid: <credential uuid>,
   state: <set to 'revoke' to set the bit in the statuslist, or another value to unset it>,
   list: <optional URI of a specific statuslist for which to set/unset the status>
}
```

The endpoint returns a JSON array containing a `state` value indicating the result of the operation:

```
REVOKED: credential was revoked (bit is set)
WAS_REVOKED: credential was already set to revoked, status has not changed
UNREVOKED: credential was unrevoked (bit not set)
WAS_UNREVOKED: credential was not revoked, status has not changed
UNKNOWN: status list cannot be determined, bit was never reserved, etc.
```
