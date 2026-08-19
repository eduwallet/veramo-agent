# StatusLists

StatusLists are external tokens (from the perspective of the credential) that encode the status of the credential in a long list of possible credential statusses. The idea is to offer 'herd anonimity' by encoding the state of many credentials into one token and allowing the consuming application to cache this state list for some time, decoupling the retrieval of the state list from the actual use of the credential.

There are a number of problems with this approach:

- if an issuer creates a status list unique for each credential, it will still have a reasonable idea of which verifier is verifying which credential at which time.
- this problem may also occur as credentials are revoked. If only one credential remains, this has become the same case as above.
- encoding the status list information creates a uniquely identifiable url for this credential. It effectively makes something in the credential linkable to exactly that instance of a credential, allowing verifiers to cross-link usage of this credential, even if the issuer does not explicitely export a `jti` or `credentialSubject.id` identifier. However, there are more fields that suffer from this, like the JWT signature itself.
- credentials that never expire require lists that live forever

This application implements several types of status lists:

- `StatusList2020`, `RevocationList2020Status`, `SuspensionList2020Status`: an outdated version of `BitstringStatusList`
- `StatusList2021`, `RevocationList2021Status`, `SuspensionList2021Status`: an outdated version of `BitstringStatusList`
- `BitstringStatusList`: see https://w3c.github.io/vc-bitstring-status-list/ for more information (the `W3C` version)
- `statuslist+jwt`: see https://datatracker.ietf.org/doc/draft-ietf-oauth-status-list/21/ (the `IETF` version)

The `W3C` version is specifically designed to work with `VCDM 2` credentials, while the `IETF` version is specifically designed to work with `SD-JWT` (`dc+sd-jwt`) credentials. This implementation allows to apply these attributes cross-wise in some way. If a `W3C` statuslist is defined for a `SD-JWT` credential, the `W3C` status list data is exported to the `status.statuslist` claim of the result. And vice versa, if an `IETF` statuslist is defined for a `VCDM` credential, the `IETF` status list data is exported as part of the `credential.credentialStatus` attribute. As much as possible, the `IETF` status list token is exported to the `status` claim in a `JOSE` encoding. The `VCDM` specification allows more than 1 credential status definition, whereas `IETF` only defines one claim option, so be careful when defining the status lists in combination with credential formats.

## Configuration

Statuslists are defined by a globally unique name, for example `abcrevoke` or `pidsuspend`. Each statuslist can have one or more sublists, depending on the size of the list. By default, a status-sublist can encode 131072 entries, which is more than will ever be used by this application. The size can be configured to be smaller or larger as needed. When the statuslist implementation detects that the status-sublist is used for more than 90%, it will automatically create an additional status-sublist with again the number of possible entries defined by the `size` attribute. This happens transparently, but as the default size is presumably never reached, chances that this will ever occur in reality are very slim.

Statuslists are configured for a specific credential in the issuer metadata. The `statuslist` configuration lists the available status lists for this issuer for each credential available:

```json
{
    ...
    "CredentialId2": {
        ...
        "statuslist": [
            {
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
        ]
    }
    ...
}
```


If a statuslist is configured for a credential of an issuer, the issuer will reserve the appropiate bits on that statuslist and add the relevant attribute to the credential output. The `messages` attribute is optional and will be automatically filled for `BitstringStatusList` entries in credentials, which require a `messages` list if the `bitSize` is larger than 1.

As the name of the statuslist should be globally unique, you can 'link up' statuslists of several credentials by reusing the name. You can specify a generic `revocation` list for example and attach it to each credential for each issuer, which then ends up defining a single status list instance in the database. This will make the herd size much larger. However, because the status list credential needs to be signed by an issuer, there will be several endpoints that make the same statuslist credential available, one for each issuer.

For example, redefining the `revocation` status list:

```json
{
    ...
    "CredentialId1": {
        ...
        "statuslist": [
            {
                "name": "revocation",
                "size": 65535,
                "bitSize": 1,
                "purpose": "revocation",
                "type": "statuslist+jwt"
            }, ...
            ...
        ]
    },
    "CredentialId2": {
        ...
        "statuslist": [
            {
                "name": "revocation",
                "size": 65535,
                "bitSize": 1,
                "purpose": "revocation",
                "type": "statuslist+jwt"
            }, ...
            ...
        ]
    }
    ...
}
```

## API

Statuslists come with the following api extensions:

- GET `<base URL>/<tenant>/sl/<status list name>/<list index>` (publicly available)
- POST `<base URL>/<tenant>/api/revoke-credential`
- POST `<base URL>/<tenant>/api/sl/<status-list>/revoke`
- GET `<base URL>/<tenant>/api/sl/<status-list>/status/<list-index>/<element-index>`
- POST `<base URL>/<tenant>/api/sl/<status-list>/status`

Except for the first endpoint, all endpoints are protected using the administrative API token.

### Status List Credential

GET `<base URL>/<tenant>/sl/<status list name>/<list index>`

The statuslist credential is published either as JWT following the `IETF` specification, or as VirtualCredential following the `W3C` specification. This only depends on the `type` setting of the statuslist, not on the availability of the statuslist information inside the credential. 

This API endpoint is a simple `GET` call returning a JWT token, signed with the key of the issuer `<tenant>`. This latter feature is a requirement by some wallet builders to be able to verify that the statuslist content is actually under control of the issuer of the credential.

Example:

```shell
curl http://example.com/statuslist/1
```

The IETF Token Status List returns a JWT with a `status_list` claim:

```json
{
    status_list: {
        bits: <bit size of this list>,
        lst: <encoded status>
    }
}
```

The `encoded status` is a base64url encoded, zlib compressed representation of the bit string content.

The W3C implementations return a Virtual Credential JWT with a `credentialSubject` claim:

```json
{
    type: ['VerifiableCredential', <status list credential type>],
    credentialSubject: {
        id: <list URI>,
        type: <relevant type string>,
        statusPurpose: <purpose description>,
        encodedList: <encoded status>
    }
}
```

The 'old' W3C StatusList implementation has credential type 'StatusListCredential'. The `credentialSubject` type can be anything from `StatusList2020`, `SuspensionList2020` to `RevocationList2021`, etc. The `encodedList` is a base64url encoded gzip compressed representation of the bit string content.

The W3C BitstringStatusList implementation has credential type 'BitstringStatusListCredential'. The `credentialSubject` type should be `BitstringStatusList`. The `encodedList` is a multibase base64url encoded gzip compressed representation of the bit string content. It is very similar to the W3C StatusList value, but preceded by the multibase `u` prefix to indicate the base64url encoding. The spec suggests a base58btc encoding can also be used, which would have a `z` prefix. This implementation only uses the base64url encoded version.

The result looks like the following (decoded JWT header and payload):

```json
{
    "alg": "ES256",
    "kid": "did:web:issuer.dev.eduid.nl#0",
    "typ": "statuslist+jwt"
}
{
    "iss": "did:web:issuer.dev.eduid.nl",
    "exp": 1783690726,
    "iat": 1783423416,
    "sub": "https://status.dev.eduid.nl/eduID/1",
    "ttl": 300,
    "status_list": {
        "bits": 1,
        "lst": "eJzt2ksSwiAMgGF0XHTpETxKj-bRXam0Uy0teQH_t7UjTIckkJISil29J9CqR-mDs-481ornBXFT1c8yg-QIbgAfN5thPPPOxXHsSGSKDYZ3KKDyyLdJNk-TUbb0u7vSPkPclf8_p7I-ThSZfleLCb8whx7BoKhbICyv43hnOMey_gPoV0mfw65SzSlNXWQ3jiu_RPvARsPTxjsidNtaRh16LLjEECkWm6JVGABAbOUbCpEDsfD-xfieJNAwTv3xddEIBCTt9Ov_bioIKEBPS3eGK5tkyz57lLPH8FdqaH1iX5RwDWX43FGPL3Lt-uaEF514CCc"
    }
}
```

The result in the example is an `IETF` based token status list and the `lst` attribute content needs to be evaluated according to the specs to find the status of relevant credentials.

### Revoke Credential

POST `<base URL>/<tenant>/api/revoke-credential`

This endpoint allows an issuer to revoke the credentials it has previously issued. This can be used in use cases where
users want to revoke or re-issue/refresh credentials.:

```json
{
    "uuid": <credential uuid>,
    "state": <set to 'revoke' to set the bit in the statuslist, or another value to unset it>,
    "list": <optional URI of a specific statuslist for which to set/unset the status>
}
```

The `uuid` value points to a specific credential issuance and is returned by the issuer to the front-end application after successful issuance. Please note that during issuance multiple credentials may be provided to the wallet. Each credential must be revoked in turn in that case, there is no support to mass revoke credentials.

The endpoint returns a JSON object containing a `status` attribute indicating the status of the revocation:

- `REVOKED`: credential was revoked (bit is set)
- `WAS_REVOKED`: credential was already set to revoked, state has not changed
- `UNREVOKED`: credential was unrevoked (bit not set)
- `WAS_UNREVOKED`: credential was not revoked, state has not changed
- `UNKNOWN`: status list cannot be determined, bit was never reserved, etc.

### Revoke Status List Bit

POST `<base URL>/<tenant>/api/sl/<status-list>/revoke`

This is factually a short hand (original) version to set the status of a specific bit in the statuslist.

Request object:

```json
{
    list: <status list credential URL>,
    index: <element index>,
    status: <string value: revoked or unrevoked>
}
```

Response object:

```json
{
    "status": <status change indication>
}
```

The `list` value must be the `url` value from the reservation step. This must match the `statuslist-name` as present in the API path.
The `status` field is a text field containing the actual text `revoked`, or anything else (for `unrevoked`).

This sets the value of the element to `1` (`revoked`) or to `0` (`unrevoked`).

The response indicates if the element value has changed. If it changed, the result value is returned as a string value (`REVOKED`, `UNREVOKED`). If it did not change, the `status` value is `UNCHANGED`.

Example Response:

```json
{
    "status": "REVOKED"
}
```

This interface is usable for status lists of bit size 1. The endpoint below can be used for statuslists of any size, including 1.

### Get Status List Status

GET `<base URL>/<tenant>/api/sl/<status-list>/status/<list-index>/<element-index>`

This is a convenience method to determine the state of a specific element index in the bitstring list. This value can also be determined by parsing the bitstring credential.

`<list-index>` is the numeric index of the status list. This index is returned in the call to reserve a bit above. It is also the last path element of the `statuslist credential uri` as present in the credential status claim. The `<element-index>` is of course the numeric index of the status list element.

Response object:

```json
{
    "status": <numeric or textual status>
}
```

The response status is `REVOKED` or `UNREVOKED` for statuslists with a bit size of 1. `REVOKED` indicates a value of `1` and `UNREVOKED` a value of `0`.

For statuslists with a larger bit size, the `status` response field is an integer value representing the bit element status value.

### Set Status List Status

POST `<base URL>/<tenant>/api/sl/<status-list>/status`

Request object:

```json
{
    list: <statuslist credential URL, like `https://agent.dev.eduwallet.nl/mbob/sl/revocation/1`>,
    index: <element index>,
    status: <integer status value>,
    mask: <optional mask value>
}
```

Response object:

```json
{
    "status": <status change indication>
}
```

The `list` value must be the `url` value from the reservation step. This must match the `statuslist-name` as present in the API path.
The `status` field is an integer to which the new status of the list element must be set. An optional `mask` value can be passed to only set specific bits of the list element and keep other bits unchanged. By default the `mask` will cover all bits.

The response indicates if the element value has changed (`CHANGED`) or not (`UNCHANGED`).

Example POST:

This sets bit 3 using a 2 bit mask for bits 2 and 3.

```json
{
    "list": "https://agent.dev.eduwallet.nl/mbob/sl/revocation/1",
    "index": 2,
    "status": 8,
    "mask": 10
}
```

Example Response:

```json
{
    "status": "CHANGED"
}
```
