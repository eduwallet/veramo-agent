# OpenID4VCI endpoints

These are the endpoints a wallet interacts with. They follow the OpenID for Verifiable Credential Issuance specification. The endpoints for the front-end (back-office) issuer application are described in [APIV1.md](./APIV1.md) and [APIV2.md](./APIV2.md).

The current setup supports the basic endpoints:

- `<base URL>/<tenant>/credentials`
- `<base URL>/<tenant>/deferred` (only if a credential is issued in a deferred manner)
- `<base URL>/<tenant>/nonce`
- `<base URL>/<tenant>/get-credential-offer/:id`

It also supports publishing well-known metadata:

- `<base URL>/<tenant>/.well-known/openid-credential-issuer`
- `<base URL>/<tenant>/.well-known/openid-configuration`
- `<base URL>/<tenant>/.well-known/oauth-authorization-server`
- `<base URL>/.well-known/openid-credential-issuer/<tenant>`
- `<base URL>/.well-known/openid-configuration/<tenant>`
- `<base URL>/.well-known/oauth-authorization-server/<tenant>`
- `<base URL>/<tenant>/.well-known/did.json`

The 1st and 4th URL serves the JSON metadata that configures the issuer tenant. It publishes the available credential templates and the URI to the endpoint that issues the actual credential. The metadata is constructed from the configured `metadata` configuration and any referenced `credential` and `vct` metadata. Credential types are extended automatically to include applicable attributes. Specifically, the `credentialSubject` attribute is converted to the `claims` attribute. For historical reasons, the `credentialSubject` entry is still used in the metadata specification.

The `openid-configuration` and `oauth-authorization-server` are published to configure the token endpoint in the pre-authorized_code flow. The UniMe wallet
requires the latter and does not read the former. Sphereon reads both. The spec does not require any of them, but then the token endpoint is undefined.

The `did.json` endpoint provides a convenient way of publishing the `did:web` configuration. Configure a reverse proxy on the actual domain of the 
`did:web` to point to this endpoint to complete the configuration. In this way, the agent contains both public and private keys and if the agent
is restarted or keys refreshed, the key configuration will be correct. The did specification also allows a `path` setting to host the did directly on the root of the issuer, which is convenient if there is only one actual issuer tenant. Make sure to include the `:.well-known` subpath if you want to use the did directly on the published path above, e.g.: `did:web:example.com:tenant:.well-known` for the did on `https://example.com/tenant`.

The `credentials` URL serves the credential, provided the user can supply the required data (grant, authorization code, pin, credential reference, etc.). This follows the basic OpenID4VC specification. During this call, the issuer will perform a `credential_callback` if such a callback was specified in the `create-offer` request (described below). Also, for `authorization_code` flow, the issuer will establish some basic user info for the authorized user, which can be used in the creation of credentials. An implementation of this is in the `EduID` and `EduIDEntitlement` credentials.

The `nonce` POST endpoint serves a fresh nonce value, not linked to any session. This follows the basic OpenID4VC specification version 1.16 and higher.

The `get-credential-offer` endpoint serves the actual credential issuance offer, which is referenced by URI in the QR code.

Please note that in case of a `SINGLE_TENANT` configured environment, all the `<tenant>/` path elements in the endpoint paths of this document are removed. In this case, there is no tenant name or path element.

## Multiple credentials in one offer

An offer can contain multiple credentials (see [APIV2.md](./APIV2.md)). The `credential_configuration_ids` of the credential offer list every offered credential configuration once. Every requested credential has its own data set in the session, identified as `<credential_configuration_id>#<index>`, for example `GenericCredential#2`.

The token response lists these in the `authorization_details`: one entry per `credential_configuration_id`, with the identifiers of all of its data sets in `credential_identifiers`:

```json
{
    "authorization_details": [
        {
            "type": "openid_credential",
            "credential_configuration_id": "GenericCredential",
            "credential_identifiers": ["GenericCredential#0", "GenericCredential#2"]
        },
        {
            "type": "openid_credential",
            "credential_configuration_id": "OtherCredential",
            "credential_identifiers": ["OtherCredential#1"]
        }
    ]
}
```

The wallet loops over the `authorization_details` and sends a credential request to the `credentials` endpoint for every `credential_identifier`. If a wallet only sends a `credential_configuration_id`, the first data set of that configuration that was not yet issued is used. Without either, the request is only accepted if the offer contains a single credential.

Credentials that are issued in a deferred manner and credentials that are not can be mixed in one offer. The credential request for a deferred data set is answered with a `202` and its own `transaction_id`; the other credentials are issued immediately. The wallet collects each deferred credential at the `deferred` endpoint using the `transaction_id` it received.
