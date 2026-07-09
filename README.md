# Veramo Agent
Implementation of a generic OID4VCI issuing agent.

This application has evolved out of an earlier version of the Sphereon OID4VC-demo

For more details about the Sphereon code, please see: https://github.com/Sphereon-Opensource/OID4VC-demo

Although it is called the 'veramo-agent', it no longer implements the veramo libraries, nor any Sphereon modules.


## Preface

Please note the difference between `credentialId` and `credentialType`. The `credentialId` is the identifier used as key in the metadata `credential_configurations_supported` which defines a combination of claims/credentialSubject, display values and formats.

The `type` or `scope` attribute of such a credential configuration defines the `credentialType` in this setup. It is assumed that all credentials of the same `credentialType` (but possibly with different `credentialId`s) share the same set of claims and claim requirements. This is not enforced anywhere though. To help the implementor to achieve this, the metadata specification can reuse credential metadata, so that the `credentialType` (credential metadata) can be easily reused across different issuers, or even within the same issuer using different `credentialId`s. In this way the claim definitions remain identical for the same type.

## Installation

Run `yarn install` to install all relevant node modules. Then run `npm run start:dev` to run the basic application.

To get all debugging messages, run using `DEBUG=*:* npm run start:dev`

### Postgres Database

The application uses a Postgres database instead of a local SQLite file. Database encryption has been disabled to allow easier access to the database internals. Please note that this makes the private key material readable for anyone with database access.

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

### Docker instance

The project comes with a `Dockerfile` with a basic configuration to run the `veramo-agent` directly inside a container.

First build the container:
`docker build -t eduwalletagent .`

Then install the `node_modules` through the container:
`docker run --rm -v ./:/app --entrypoint yarn eduwalletagent install`

Make sure to install the environment file `.env` and  configurations in the `/conf` directory. And then finally run the container:
`docker run --rm -v ./:/app eduwalletagent`

### Docker Compose

Run `docker compose build` and then `docker compose up` to build and run the agent, the database and the openobserver log container.

The Docker setup installs all dependencies inside the container, so there's no need to run `yarn install` locally unless you're developing outside of Docker.

## Configuration

### Environment variables

- `CONF_PATH`: base path for the file based configuration
- `DB_TYPE`: database driver type, only `postgres` is currently actively tested
- `DB_HOST`: hostname for database connections
- `DB_USER`: user to connect as to the database
- `DB_PASSWORD`: password to connect with to the database
- `DB_NAME`: name of the database (`postgres`)
- `DB_SCHEMA`: name of the database schema
- `PORT`: port for the Express server
- `LISTEN_ADDRESS`: local bind address for the Express server
- `BASEURL`: base url served by the issuer agent
- `BEARER_TOKEN`: access token for the administration api
- `PASSPHRASE`: encoding passphrase used to encrypt secrets. This is a 32 character alpha-numeric string
- `OIDFED_KEY`: alias of the identifier key to use for OID Federation purposes
- `OIDFED_ADMIN_CONTACT`: contact e-mail address for administrative purposes
- `OIDFED_AUTH`: base url of the directly supervising authority (the authority hint)

### File based configuration

Configuration for the Issuer services is done inside the `conf/` directory. There are *5* entities that can be configured:

- `contexts`: linked data proof (`json-ld`) contexts that are served by this issuer.
- `credentials`: credential configuration metadata for credential types that are reused between issuers
- `dids`: issuer key configuration, allowing reuse of keys between issuers
- `metadata`: issuer metadata, listing the issuer endpoints and the credential configuration
- `issuer`: issuer configuration, connecting the key data, metadata configuration and statuslist information
- `vct`: virtual credential type metadata configuration, used in `vc+sd-jwt` and `dc+sd-jwt` issuance

### Contexts

The `json-ld` contexts are defined in the `conf/contexts/` directory. Each file there defines a context that is served at the issuer agent root. The configuration looks as follows:

```json
{
    "basePath": <base path from the issuer root where to serve this configuration>,
    "document": <context document content, usually starting with an "@context" attribute>
}
```

The issuer agent reads all files in the configuration directory and serves the context documents at the indicated path. The context documents are also preloaded in the default context lists.

### Credentials

The credential configuration as defined by the OpenID4VCI spec as part of the `credential_configurations_supported` array. This configuration has to follow the actual credential implementation in the source code, to avoid issues with supported formats and claims.

Please note that the application assumes the credential metadata is in `vc_jwt` format, so the credential attributes are listed in the `credential_definition.credentialSubject` attribute. The content of this attribute is converted automatically if the credential has format `vc+sd-jwt`, which uses a `claims` attribute instead.

Please note that the application supports both VCDM 1.1 and VCDM 2.0 type credentials. To enable a VCDM 2.0 credential, configure it with format 'vc+jwt' instead of 'json_vc_jwt'. This is automatically rewritten in the metadata output, because the OID4VCI spec does not understand 'vc+jwt'.

### Dids

The key material configuration is stored in the `conf/dids/` directory. Each entry looks as follows:

```json
{
    "did": <(optional) full did name, only usable for did:web keys where the key name is known in advance>,
    "alias": <(optional) string alias that can be used with issuers>,
    "provider": "type of identifier, like did:web, did:key or did:jwk",
    "type": "type of the key, like ed25519, Secp256r1, RSA",
    "path": "optional path at which to serve this key as a did document",
    "services": ["optional list of service objects for the did document"]
}
```

If the key is not found at start-up, it is created.

The keys used for issuers are served at the `/<issuer>/.well-known/did.json` endpoint as well, if configured as a `did:web`. The `path` attribute here can be used to also serve a specific key as a `did:web` on the root of the application for example.

`did:web` keys served as part of an issuer get the `OID4VCI` service with an endpoint pointing to the issuer base url.

### Metadata

The metadata is configured separately from the issuer configuration for historic reasons. The issuer configuration and the metadata are linked based on the name of the configuration file. *Please note: there used to be a `correlationId` element for this and the metadata content would be in a metadata attribute. This metadata has been moved up.*

To allow credential configuration reuse, the metadata configuration `credential_configurations_supported` attribute is parsed when the metadata is loaded. Each credential defined there is extended with any credential data defined for the same identifier in the `conf/credentials/` configuration. In that way, the basic credential display information can be centralized, but branding information can be specified in the issuer metadata configuration.

The credential claim data is located in the `credential_definition` attribute. It can either be specified using the older type of `credentialSubject` or the new `claims` attribute. The following example specifies both, but if both exist, the `credentialSubject` elements are added at the end of the existing `claims` elements. The code automatically converts the data to the required output, depending on the type of the resulting credential ('w3c', 'vcdm' or 'sd-jwt').

```json
    "GenericCredential": {
        "format": "credential format, like jwt_vc_json",
        "scope": "optional scope attribute",
        "display": <display object for the entire credential>,
        "credential_definition": {
            "type": ["VerifiableCredential", "another type name"],
            "credentialSubject": {
                "key1": {
                    "mandatory": <optional boolean>,
                    "value_type": "unused optional type indication",
                    "display": <display object with attribute names>
                },
                ...
            },
            "claims": [
                {
                    "path": ["list of path elements"],
                    "origin": [["optional list of path elements"], ...]
                    "mandatory": "optional boolean",
                    "display": <display object with attribute names>
                },
                ...
            ]
        }
    }
```

Please note: for the 'w3c' type, the `vc` prefix is automatically prepended to the path specifiers, it should not be added explicitely in this claims definition.

The `credentialSubject.key1.{}` way of specifying claims only supports single layered, single value claims. Use the `claims` array to specificy more complex claim structures.

The optional `origin` value allows some degree of mapping external claim data to a specific credential claim. It is a list of lists, each evaluated in turn and the first valid entry is used. It can be used when the external data retrieved from an `authorisation_code` flow returns a data structure that can change for users or situations. In `pre-authorized` code flow, the data structure is assumed to be defined up front by the front-end issuing application and can be set precisely to the fields the credential requires.

Optionally, instead of extending a credential based on the credential identifier, an `extends` attribute can be configured that points to a specific credential identifier to extend. This can be used to allow an `vc+sd-jwt` or `dc+sd-jwt` credential to extend a regular `vc_jwt` credential. The metadata of the latter is automatically converted to the same metadata of the former:

```json
{
    ...
    "CredentialId2": {
        "format": "vc+sd-jwt",
        "extends": "CredentialId1"
    }
    ...
}
```

The `extends` attribute is removed from the output if it was present.

If a credential supports a status list implementation, the status list options can be configured in the metadata. Like with the `extends` attribute, this configuration is removed from the metadata output:

## Status Lists

The statuslist configuration lists the available status lists for this issuer for each credential available:

```json
{
    ...
    "CredentialId2": {
        ...
        "statusLists": {
            "AcademicBaseCredential": {
                "name": "generic name, like revoke or suspend, to be able to distinguish multiple status lists for the same credential",
                "size": <number of entries allowed in this list, by default and at least set to 131072>,
                "bitSize": <number of bits per entry, being 1, 2, 3 or 4>,
                "purpose": "optional string like revocation, suspension",
                "type": "type specification, by default set to BitstringStatusList",
                "messages": [
                    {
                        "status": "string representation in hex of the message value, like 0x01",
                        "message": "message related to this bit value"
                    }, ...
                ]
            }, ...
            ...
        }
    }
    ...
}
```

This application implements several types of status lists:

- `StatusList2020`, `RevocationList2020Status`, `SuspensionList2020Status`: an outdated version of `BitstringStatusList`
- `StatusList2021`, `RevocationList2021Status`, `SuspensionList2021Status`: an outdated version of `BitstringStatusList`
- `BitstringStatusList`: see https://w3c.github.io/vc-bitstring-status-list/ for more information
- `statuslist+jwt`: see https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/21/

If a statuslist is configured for a credential of an issuer, the issuer will reserve the appropiate bits on that statuslist and add the relevant attribute to the credential output. The `messages` attribute is optional and will be automatically filled for `BitstringStatusList` entries in credentials, which require a `messages` list if the `bitSize` is larger than 1.

### Issuers

The issuer configurations are specified in the `conf/issuer/` directory. Each entry there will instantiate an issuer service. The configuration is as follows (*Please note: this configuration has changed significantly*):

```json
{
    "name": "human readable name for the issuer",
    "baseUrl": <base path for this issuer service>,
    "clientId": <optional string client id to be used for authorization code flow>,
    "clientSecret": <optional string client secret to be used for authorization code flow>,
    "adminToken": <string bearer token to be passed by front end agents to create credential offers>,
    "authorizationEndpoint": <optional authorization server to be used for authorized code flow>,
    "tokenEndpoint": <optional token endpoint to be used for authorized code flow>,
    "did": <did alias or did name as configured in the did section above>,
    "key": "optional key reference index, like '0', depending on the identifier key format",
    "usesNonces": <boolean value that indicates if a nonce value should be generated in the access token>
}
```

The definition is available in the `src/types/internal.ts` file, `IssuerConfiguration` interface.

The `key` attribute is automatically set based on the type of the key, usually to '0'. If you have a very specific key configuration, you can override it with the `key` attribute, but it should not be necessary. The `did:jwk` keys always have a key reference of '0'. The `did:web` implementation has a key reference of '0' as well. The `did:key` specification indicates the key reference is the multibase encoded public key, but that is not known in advance if the key needs to be generated fresh.

See the chapter on StatusLists below for the status list configuration options.

The `usesNonces` setting is used to enforce the use of nonce values in access tokens from external authorization servers. Because it it not known in advance if such AS entities do or do not use nonce values, their presence can be enforced with this setting. Please note that there is no way for the issuer to know if this nonce value is actually correct without having a separate api to check this. For this reason, using nonce values with external AS entities does not increase security. For the `pre-authorized_code` flow, nonce values _are_ used regardless of this setting.


### VCTs

The `vct` (Virtual Credential Type metadata) definitions are defined in the `conf/vct/` directory. Each file there defines metadata belonging to one or more credential types and is required for the implementation of `vc+sd-jwt`. The metadata looks as follows:

```json
{
    "path": <base path from the issuer root where to serve this metadata, usually something like /vct/<type>>,
    "credentials": <array of credential types that support this metadata>,
    "document": <metadata document content>
}
```

Upon reading the metadata configuration, the `document` is extended automatically with a `vct` attribute that points to the full path of the VCT metadata. Also, any template content marked with `{{ here }}` is also replaced with this full path.

There is currently no support for serving `schema` metadata directly.

Please see https://www.ietf.org/archive/id/draft-ietf-oauth-sd-jwt-vc-08.html for more information about the VCT metadata.

## Basic Code Setup

Main entry script is `src/agent.ts`
This script first creates a basic Veramo Agent instance with all the relevant plugins. Then it configures the plugins by reading the json configurations. Finally it sets up the Express server to serve the various endpoints.

## Authorization Code Flow

The Issuer application does _not_ implement an AS server. Instead, it allows configuration of an external authorization server using the `authorizationEndpoint` configuration parameter. This value is automatically transferred to the correct `metadata` parameter.

The issuer tries to decode the `access token` returned by the AS to see if it implements RFC 9068: https://datatracker.ietf.org/doc/html/rfc9068
This RFC describes how to encode the `access token` as a `JWT` so that the consumer RP can both establish the authenticity and does not need to
call an additional token introspection endpoint. For this to work, the issuer tries to find the AS OAuth configuration setup and determines the 
`jwk_uri_endpoint` to preload the JWKs used by the AS for encoding the token.

If the `access token` is a JWT, the issuer tries to retrieve the `issuer_state` attribute from it to determine the current issuance session. Based on
the session, the issuer will then determine the credential subject data. There is currently no implementation to retrieve additional data based
on the authenticated user, like requesting a user info endpoint or further dissecting the `access token`.


## Endpoints

Routing and endpoints are set in various places. There are two kinds of endpoints: OpenID4VC endpoints and API endpoints.

### OpenID4VC endpoints

The current setup supports the basic endpoints:

- `<base URL>/<tenant>/.well-known/openid-credential-issuer`
- `<base URL>/.well-known/openid-credential-issuer/<tenant>`
- `<base URL>/<tenant>/.well-known/openid-configuration`
- `<base URL>/.well-known/openid-configuration/<tenant>`
- `<base URL>/<tenant>/.well-known/oauth-authorization-server`
- `<base URL>/.well-known/oauth-authorization-server/<tenant>`
- `<base URL>/<tenant>/.well-known/did.json`
- `<base URL>/<tenant>/credentials`
- `<base URL>/<tenant>/nonce`
- `<base URL>/<tenant>/get-credential-offer/:id`

The first and second URL serves the JSON metadata that configures the issuer tenant. It publishes the available credential templates and the URI to the endpoint that issues the actual credential. The metadata is constructed from the configured `metadata` configuration and any referenced `credential` and `vct` metadata. Credential types are extended automatically to include applicable attributes. Specifically, the `credentialSubject` attribute is converted to the `claims` attribute. For historical reasons, the `credentialSubject` entry is still used in the metadata specification.

The `openid-configuration` and `oauth-authorization-server` are published to configure the token endpoint in the pre-authorized_code flow. The UniMe wallet
requires the latter and does not read the former. Sphereon reads both. The spec does not require any of them, but then the token endpoint is undefined.

The `did.json` endpoint provides a convenient way of publishing the `did:web` configuration. Configure a reverse proxy on the actual domain of the 
`did:web` to point to this endpoint to complete the configuration. In this way, the agent contains both public and private keys and if the agent
is restarted or keys refreshed, the key configuration will be correct. The did specification also allows a `path` setting to host the did directly on the root of the issuer, which is convenient if there is only one actual issuer tenant. Make sure to include the `:.well-known` subpath if you want to use the did directly on the published path above, e.g.: `did:web:example.com:tenant:.well-known` for the did on `https://example.com/tenant`.

The `credentials` URL serves the credential, provided the user can supply the required data (grant, authorization code, pin, credential reference, etc.). This follows the basic OpenID4VC specification. During this call, the issuer will perform a `credential_callback` if such a callback was specified in the `create-offer` request (described below). Also, for `authorization_code` flow, the issuer will establish some basic user info for the authorized user, which can be used in the creation of credentials. An implementation of this is in the `EduID` and `EduIDEntitlement` credentials.

The `nonce` POST endpoint serves a fresh nonce value, not linked to any session. This follows the basic OpenID4VC specification version 1.16 and higher.

The `get-credential-offer` endpoint serves the actual credential issuance offer, which is referenced by URI in the QR code.

### API endpoints

The setup has the following endpoints for the back-end API:

- POST `<base URL>/<tenant>/api/create-offer`
- POST `<base URL>/<tenant>/api/check-offer`
- POST `<base URL>/<tenant>/api/list-credentials`
- POST `<base URL>/<tenant>/api/revoke-credential`

#### Create Offer

POST `<base URL>/<tenant>/api/create-offer`

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
            "tx_code": boolean|object, optional,
        }
    },
    "credentialDataSupplierInput": "object containing key-value pairs of the credentials",
    "credentialMetadata": "object containing key-value pairs defining the metadata",
    "credential": "optional object containing a prefilled credential, including metadata",
    "credential_callback": "optional URL to use as a callback to retrieve a prefilled credential"
}
```

Please note the following:

- the example displays two grant types. Usually only one of either is used (the front-end-issuer either has authenticated the user, or it has not). Which one is used depends on the configuration of the back-end-issuer for this specific instance
- in the `authorization_code.issuer_state` field, the example shows the content `generate`. This is a special-case situation forcing the back-end-issuer to generate a new state value. Preferably the `issuer_state` was left undefined, but that may cause the entire `authorization_code` object to be removed by intermediate libraries. To prevent that, fill the `issuer_state` with the special `generate` value. The response will provide the actual state identifier used for this session
- the `pre-authorized_code` field can be undefined, in which case a random code is generated. However, to prevent the grant containing an empty object which may be removed by the intermediate libraries, the value `generate` may be used to force a random state code, like for the `issuer_state` above
- the `tx_code` can either be a boolean or an object. If boolean `true`, a pin code of 4 digits is generated. If it is an object, it is expected to contain attributes `input_mode` ('text' or 'numeric' (default)), `length` (default: 4) and a `description` (default 'PIN'). This information is transferred to the `tx_code` attribute of the pre-auth-grant in the offer and used to generate the `txCode` return value. Front end issuers can indicate a transaction code of their own by supplying that code in the `code` field, which is then reflected back to the caller.

The `credentialMetadata` attribute can contain settings about the credential. Currently the following are defined:

- `expiration`: a number representing the seconds after issuance date for the credential to expire. For backwards compatibility, the credential data fields `_exp` and `_ttl` are also supported and serve the same purpose
- `enableStatusLists`: a boolean field that enables or disables generating status list information. If not specified, but status lists are configured for an issuer, status list information is generated. Set this field explicitely to `false` to prevent generating status list information
- `evidence`: an object or array containing evidence data as specified in the VCDM spec.

The `credential` attribute can contain a full credential, some values of which will be overwritten or adjusted by the issuer during issuance. Fields that are supported, like `@context`, `name`, `description`, `credentialStatus` or `evidence`, will be interpreted if possible, other fields (including `credentialSubject`) are transported verbatim to the output. This feature is mainly used for the `VCDM` `OpenBadgeCredential` implementation and should be used with care.

The `credential_callback` attribute is used to validate an `authorization_code` flow authorization against an external application, which can then return a full credential or an error status. In case of errors (unauthorized, not found), the credential issuance is halted. If the callback succeeds, the return value is used as the preset credential following the same implementation as if the credential was set using the `credential` attribute described above.

The `credential_callback` is done using a `POST` call and contains a JSON object (content type `application/json`) with a variety of parameters depending on the authorization flow that was performed. In case of a `pre-authorized_code` flow, the parameters contain the `issuer_state`, issuance and expiration information of the access token. In case of a `authorization_code` flow, the parameters contain all accumulated data as received from the Authorization Server, which depends heavily on the implementation of the AS.

The create-offer call finally returns a JSON object containing the following elements:

```json
{
    "uri": "the uri that is presented to the wallet as QR code or clickable link (same-device)",
    "txCode":  "optional, transaction code that needs to be shared out of band",
    "id": "a string value containing the unique identifier with which to refer to this offer/session"
}
```

At the moment, the agent by default creates a 4 digit random code when a tx_code is requested.

#### Check Offer

POST `<base URL>/<tenant>/api/check-offer`

The `check-offer` endpoint allows the front-end to poll the status of the offer. Depending on the state of the offer, the front-end
can display different messages or adjust the interface. The offer `id` is the `id` value returned in the `create-offer` call.
The `id` is passed in a POST operation as a json object: `{"id":"<code>"}`

This returns an object as follows:

```json
{
    "createdAt":1725356725408,
    "lastUpdatedAt":1725356725408,
    "status":"CREDENTIAL_ISSUED",
    "requests": <optional request data object>,
    "uuid": "64d37ada-5671-4d6d-b74d-031b925fe2c9"
}
```

The `requests` object contains data about the incoming and outgoing requests for this issuance state. It can be used for debugging purposes to see what kind of data flows in and out in the protocol.

The `uuid` attribute is only available when an actual credential was issued to the wallet. This `uuid` can be used by the issuing front-end
to interface with the revocation api as defined below.

The following statuses are currently supported:

- OFFER_CREATED: the offer has been created, but it has not been consumed yet
- OFFER_URI_RETRIEVED: the offer URI endpoint was called, which normally indicates the QR code was scanned
- ACCESS_TOKEN_CREATED: the wallet requested and received an access token
- CREDENTIAL_ISSUED: the credential offer was successfully completed

The time between `ACCESS_TOKEN_CREATED` and `CREDENTIAL_ISSUED` is very short in practice. There is no manual
step in between. Between `OFFER_URI_RETRIEVED` and `ACCESS_TOKEN_CREATED`, the wallet requests both the
transaction code and asks the user if he/she wants to accept the credential.

#### List Credentials

POST `<base URL>/<tenant>/api/list-credentials`

This endpoint allows an issuer to list the credentials it has previously issued. This can be used in use cases where
users want to revoke or re-issue/refresh credentials. The POST data field can contain filtering options (each field
is optional):

```json
{
    "state": <filter based on a specific unique state previously used by the front-end issuer>,
    "holder": <filter based on the holder key specification of a wallet>,
    "credential": <filter based on the credential type>,
    "primaryId": <filter based on the primary identifier for a credential (the unique user id)>,
    "issuanceDate": <filter on credentials issued after this date>
}
```

The endpoint returns a JSON array containing all the database rows, including the database id, the uuid, claims, status-list information
and saved-updated dates. This data can be used in further interactions.

#### Revoke Credential

POST `<base URL>/<tenant>/api/revoke-credential`

This endpoint allows an issuer to list the credentials it has previously issued. This can be used in use cases where
users want to revoke or re-issue/refresh credentials.:

```json
{
    "uuid": <credential uuid>,
    "state": <set to 'revoke' to set the bit in the statuslist, or another value to unset it>,
    "list": <optional URI of a specific statuslist for which to set/unset the status>
}
```

The endpoint returns a JSON object containing a `status` attribute indicating the status of the revocation:

- `REVOKED`: credential was revoked (bit is set)
- `WAS_REVOKED`: credential was already set to revoked, state has not changed
- `UNREVOKED`: credential was unrevoked (bit not set)
- `WAS_UNREVOKED`: credential was not revoked, state has not changed
- `UNKNOWN`: status list cannot be determined, bit was never reserved, etc.

# Changelog / Release Notes

| Version | Commit  | Date       | Comment             |
| ------- | ------- | ---------- | ------------------- |
|         | dd8595b | 2026-03-03 | `credential_callback` now returns the full access token claim set |
|         | 55f3438 | 2026-01-27 | Added `/api/export` endpoint to export a zip archive with ready to use configuration files |
|         | 3082911 | 2026-01-08 | Allowing the `claims` attribute in `credentialSubject` to directly set the 'new' `claims` data for metadata |
|         | 613e66c | 2025-12-02 | Implementation of the `credential_callback` url allowing EduBadges to match a credential after authorization |
|         | 441aa60 | 2025-11-25 | Added `/api/version` endpoint that returns commit, tag, node version and package version information |
|         | 13f5167 | 2025-11-19 | Empty BEARER_TOKEN forces `truncate` on vct, context, credential and issuer tables (not identifiers and keys). This ensures a file based configuration and a proper reinitialisation based on (changed) files at restart |
|         | 792ccb1 | 2025-11-12 | Implementation of encoded private keys. When running this version, make sure the PASSPHRASE environment variable is set. If it is not set, the keys are not encoded with the migration (so remain unchanged). This will work, but encoding manually afterwards is a pain. The easiest way to fix this is to remove the EncKey migration from the `migrations` table, which will retry to encode all private keys. |
|         | 1dd29dd | 2025-11-04 | Added `credential` option to `create-offer` api call |
