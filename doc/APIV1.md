# Front-end API (v1)

The original back-end API for the front-end issuer application. These endpoints are authenticated with the admin bearer token of the issuer (see the `adminToken` configuration). An offer created with this API contains a single credential; use the [v2 API](./APIV2.md) to offer multiple credentials.

The setup has the following endpoints:

- POST `<base URL>/<tenant>/api/create-offer`
- POST `<base URL>/<tenant>/api/check-offer`
- POST `<base URL>/<tenant>/api/list-credentials`

In a `SINGLE_TENANT` configuration, the `<tenant>/` element is removed from all these paths.

## Create Offer

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

Notes on the request fields:

- the example displays two grant types. Usually only one of either is used (the front-end-issuer either has authenticated the user, or it has not). Which one is used depends on the configuration of the back-end-issuer for this specific instance
- in the `authorization_code.issuer_state` field, the example shows the content `generate`. This is a special-case situation forcing the back-end-issuer to generate a new state value. Preferably the `issuer_state` was left undefined, but that may cause the entire `authorization_code` object to be removed by intermediate libraries. To prevent that, fill the `issuer_state` with the special `generate` value. The response will provide the actual state identifier used for this session
- the `pre-authorized_code` field can be undefined, in which case a random code is generated. However, to prevent the grant containing an empty object which may be removed by the intermediate libraries, the value `generate` may be used to force a random state code, like for the `issuer_state` above
- the `tx_code` can either be a boolean or an object. If boolean `true`, a pin code of 4 digits is generated. If it is an object, it is expected to contain attributes `input_mode` ('text' or 'numeric' (default)), `length` (default: 4) and a `description` (default 'PIN'). This information is transferred to the `tx_code` attribute of the pre-auth-grant in the offer and used to generate the `txCode` return value. Front end issuers can indicate a transaction code of their own by supplying that code in the `code` field, which is then reflected back to the caller.

The `credentialMetadata` attribute can contain settings about the credential. The following settings are defined:

- `expiration`: a number representing the seconds after issuance date for the credential to expire. For backwards compatibility, the credential data fields `_exp` and `_ttl` are also supported and serve the same purpose
- `enableStatusLists`: a boolean field that enables or disables generating status list information. If not specified, but status lists are configured for an issuer, status list information is generated. Set this field explicitely to `false` to prevent generating status list information
- `evidence`: an object or array containing evidence data as specified in the VCDM spec.

The `credential` attribute can contain a full credential, some values of which will be overwritten or adjusted by the issuer during issuance. Fields that are supported, like `@context`, `name`, `description`, `credentialStatus` or `evidence`, will be interpreted if possible, other fields (including `credentialSubject`) are transported verbatim to the output. This feature is mainly used for the `VCDM` `OpenBadgeCredential` implementation and should be used with care.

The `credential_callback` must be an `http` or `https` URL; other values result in a `400` response. It is used to validate an `authorization_code` flow authorization against an external application, which can then return a full credential or an error status. In case of errors (unauthorized, not found), the credential issuance is halted. If the callback succeeds, the return value is used as the preset credential following the same implementation as if the credential was set using the `credential` attribute described above.

The `credential_callback` is done using a `POST` call and contains a JSON object (content type `application/json`) with a variety of parameters depending on the authorization flow that was performed. In case of a `pre-authorized_code` flow, the parameters contain the `issuer_state`, issuance and expiration information of the access token. In case of a `authorization_code` flow, the parameters contain all accumulated data as received from the Authorization Server, which depends heavily on the implementation of the AS.

The `create-offer` call returns a JSON object with the following elements:

```json
{
    "uri": "the uri that is presented to the wallet as QR code or clickable link (same-device)",
    "txCode":  "optional, transaction code that needs to be shared out of band",
    "id": "a string value containing the unique identifier with which to refer to this offer/session"
}
```

At the moment, the agent by default creates a 4 digit random code when a tx_code is requested.

## Check Offer

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
    "uuid": "64d37ada-5671-4d6d-b74d-031b925fe2c9",
    "expiresAt": 1725360325408,
    "reason": "optional reason for denying a deferred credential"
}
```

The `expiresAt` (epoch milliseconds) and `reason` attributes are only present for deferred credentials. The optional `deferred` array lists every deferred transaction of the offer, with its `id` (as used in the [v2 API](./APIV2.md#deferred-credentials)), `credential_configuration_id`, `status`, `expiresAt` and optional `reason`. `expiresAt` is the latest expiry of those transactions and `reason` the reason of the first denied one.

The `requests` object contains data about the incoming and outgoing requests for this issuance state. It can be used for debugging purposes to see what kind of data flows in and out in the protocol.

The `uuid` attribute is only available when an actual credential was issued to the wallet. This `uuid` can be used by the issuing front-end
to interface with the revocation API (`POST <base URL>/<tenant>/api/revoke-credential`).

The `status` attribute can have the following values:

- OFFER_CREATED: the offer has been created, but it has not been consumed yet
- OFFER_URI_RETRIEVED: the offer URI endpoint was called, which normally indicates the QR code was scanned
- ACCESS_TOKEN_CREATED: the wallet requested and received an access token
- CREDENTIAL_PENDING: (deferred) the wallet requested the credential, which waits for the back-office
- CREDENTIAL_READY: (deferred) the back-office released the credential, waiting for the wallet to collect it
- CREDENTIAL_DENIED: (deferred) the back-office denied the credential
- CREDENTIAL_ISSUED: the credential offer was successfully completed

The time between `ACCESS_TOKEN_CREATED` and `CREDENTIAL_ISSUED` is very short in practice. There is no manual
step in between. Between `OFFER_URI_RETRIEVED` and `ACCESS_TOKEN_CREATED`, the wallet requests both the
transaction code and asks the user if he/she wants to accept the credential.

## List Credentials

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