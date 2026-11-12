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
    --env-file .env \
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
- `TRUST_PROXY`: Express `trust proxy` setting (number of proxy hops, `loopback`, a subnet, or `true`/`false`). Set to `1` when running behind a single reverse proxy so rate limiting uses the real client IP. Unset trusts no proxy
- `BASEURL`: base url served by the issuer agent
- `BEARER_TOKEN`: access token for the administration api
- `PASSPHRASE`: **required**. Passphrase used to encrypt private keys at rest; the agent refuses to start without it. Historically this had to be an exactly 32-byte raw AES-256 key, and existing installations that already use such a value keep working unchanged: that exact 32-byte value is still tried first against the already-encrypted keys in the database. Any `PASSPHRASE` of a different length is run through a KDF (scrypt) to derive the actual encryption key, so a normal passphrase of any length can be used for new installations. A 32-byte value that turns out not to match the existing encrypted keys is automatically retried as a KDF input as well, so there is no need to know in advance which of the two interpretations a given installation uses.
- `OIDFED_KEY`: alias of the identifier key to use for OID Federation purposes
- `OIDFED_ADMIN_CONTACT`: contact e-mail address for administrative purposes
- `OIDFED_AUTH`: base url of the directly supervising authority (the authority hint)
- `SINGLE_TENANT`: set this to a non-empty value to simplify configuration for a single-tenant, domain driven setup
- `MAX_BATCH_SIZE`: maximum number of proofs accepted in a single credential request's `proofs[]` array, defaults to `15`. This bounds the amount of signing and database work one request can trigger (each proof results in a separately signed credential). It is currently not advertised to wallets as `batch_credential_issuance.batch_size` in the credential issuer metadata, because wallets such as Paradym then fail (the code in `Issuer.generateMetadata` is commented out).

### File based configuration

Configuration for the Issuer services is done inside the `conf/` directory. There are *6* entities that can be configured:

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

Due to changes over time in the spec, the application supports both the old style `credentialSubject` listing as the newer `claims` listing. Both versions are accepted and converted to the proper output for each credential type.

Please note that the application supports both VCDM 1.1 and VCDM 2.0 type credentials as well as IETF Verifiable Credentials in SD-JWT format. To enable a VCDM 2.0 credential, configure it with format `vc+jwt` instead of `json_vc_jwt`. This is automatically rewritten in the metadata output, because the OID4VCI spec does not understand `vc+jwt`. Use the format `vc+sd-jwt` to get a VCDM 2.0 type credential encoded as an SD-JWT. This is the default format for DIIPv5 implementations.

### DIDs

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

An `origin` path can start with a source selector:

- `#offer`: the data supplied in the `credentialDataSupplierInput` of the v1 `create-offer` call, or the `claims` of a credential in the v2 `create-offer` call. This is also the default if no `origin` is specified for a claim, and for origins without a selector.
- `#accessData`: the user info retrieved from the authorization server.
- `#deferred`: the claims supplied by the back-office for a deferred credential (see below).
- `#any`: the first available value from `#deferred`, then `#accessData`, then `#offer`, using the same path in every source.

The first origin that has a value wins; values are not merged. Please note that a configuration without an `origin` for a claim only reads the offer data.

#### Deferred issuance

A credential configuration can be issued in a deferred manner, as specified in section 8.3 and 9 of OpenID4VCI 1.0. Add a `deferred` attribute to the credential configuration:

```json
    "GenericCredential": {
        ...
        "deferred": {
            "ttl": 3600,
            "interval": 60
        }
    }
```

- `ttl`: the number of seconds that the wallet can collect the credential, at most 172800 (48 hours). The session is kept for as long as the transaction can be open.
- `interval`: optional, the number of seconds the wallet should wait between requests to the deferred endpoint. The default is `ttl / 50`, with a minimum of 10 seconds and a maximum of one hour.

The credential endpoint then always answers with a `202`, a `transaction_id` and an `interval`, also if the claims were already supplied in the `create-offer` call. When creating an offer for a deferred credential, the supplied claims can be incomplete. Deferred and non-deferred credentials can be mixed in one offer, each deferred credential has its own transaction. The back-office must supply the remaining claims (or just approve the credential) before the wallet can collect it at `<base URL>/<tenant>/deferred`. The `deferred_credential_endpoint` is only published in the metadata if at least one credential configuration has a `deferred` setting.

The issuer refuses to start if a deferred credential configuration is incorrect: every claim of a deferred credential must specify its `origin` explicitly, and `ttl` and `interval` must be valid.

The wallet is told to stop requesting a transaction (`credential_request_denied`) if the back-office denies it. The `transaction_id` is invalid after the credential has been collected, or after the `ttl`.

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

If a credential supports a status list implementation, the status list options can be configured in the metadata. Like with the `extends` attribute, this configuration is removed from the metadata output. Please see [doc/StatusLists.md](./doc/StatusLists.md) for more information on statuslists.

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

### Single Tenant

The code base is setup to serve several issuer tenants, each under a specific subpath. This is a convenient setup to allow a small use of resources for a large collection of issuing services. However, under certain circumstances it may be more convenient to have the agent serve only one specific issuer setup and just spawn more different agent containers.

In that case, set the `SINGLE_TENANT` environment variable. This will force the (single) tenant configuration to be served using the `root` Router instance and prevent the tenant-based `.well-known` paths to be generated. Please note that the basic configuration setup does not change much, but it is expected (not enforced!) that only a single entry is available in the `/conf/issuers` configuration path. The name of that issuer is no longer important for generating the subpath (everything is on the root now), but the `baseUrl` setting should match the correct url of the single tenant service. 

## Basic Code Setup

Main entry script is `src/main.ts`. It reads the json configurations, instantiates the issuers and sets up the Express server to serve the various endpoints.

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

Routing and endpoints are set in various places. The endpoints are documented separately:

- [doc/OPENID4VCI.md](./doc/OPENID4VCI.md): the OpenID4VCI endpoints used by wallets (credential, deferred, nonce, credential offer and the well-known metadata)
- [doc/APIV1.md](./doc/APIV1.md): the original back-end API for the front-end issuer (`create-offer`, `check-offer`, `list-credentials`)
- [doc/APIV2.md](./doc/APIV2.md): the v2 back-end API (`create-offer` for multiple credentials, and the deferred credential endpoints)

The status list implementation is described in [doc/StatusLists.md](./doc/StatusLists.md).

Please note that in case of a `SINGLE_TENANT` configured environment, all the `<tenant>/` path elements in the documented paths are removed.

# Changelog / Release Notes

| Version | Commit  | Date       | Comment             |
| ------- | ------- | ---------- | ------------------- |
|         | 05baee7 | 2026-11-03 | Added `/deferred` endpoint and API v2 calls to release and set credential data |
|         | dd8595b | 2026-03-03 | `credential_callback` now returns the full access token claim set |
|         | 55f3438 | 2026-01-27 | Added `/api/export` endpoint to export a zip archive with ready to use configuration files |
|         | 3082911 | 2026-01-08 | Allowing the `claims` attribute in `credentialSubject` to directly set the 'new' `claims` data for metadata |
|         | 613e66c | 2025-12-02 | Implementation of the `credential_callback` url allowing EduBadges to match a credential after authorization |
|         | 441aa60 | 2025-11-25 | Added `/api/version` endpoint that returns commit, tag, node version and package version information |
|         | 13f5167 | 2025-11-19 | Empty BEARER_TOKEN forces `truncate` on vct, context, credential and issuer tables (not identifiers and keys). This ensures a file based configuration and a proper reinitialisation based on (changed) files at restart |
|         | 792ccb1 | 2025-11-12 | Implementation of encoded private keys. When running this version, make sure the PASSPHRASE environment variable is set. If it is not set, the keys are not encoded with the migration (so remain unchanged). This will work, but encoding manually afterwards is a pain. The easiest way to fix this is to remove the EncKey migration from the `migrations` table, which will retry to encode all private keys. |
|         | 1dd29dd | 2025-11-04 | Added `credential` option to `create-offer` api call |
