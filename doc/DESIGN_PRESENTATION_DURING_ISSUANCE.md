# Design: verification during issuance (embedded authorization server)

Status: **phases 1 to 3 are implemented** (verifier; embedded AS with in-app flow, DPoP and `dcql` in `create-offer`; redirect mode). The demo (9) is not. See 11 for where the implementation differs from this design. This document describes the authorization server (AS) side of the
"verification during issuance" flow, and the changes this needs in `veramo-agent` and `veramo-verifier`.

## 1. Goal

A wallet receives an `authorization_code` credential offer. Before it gets an access token, it has to present a
credential (for example a PID) to the issuer. The verified claims of that presentation are stored with the issuance
session and are available as the `#accessData` source while the credential is built, so that credential claims can
be filled from them.

Two modes are supported by the same embedded AS:

- **In-app (primary)**: the wallet does the presentation inside the app through the *authorization challenge
  endpoint*. There is no browser step and no QR code on a web page (a QR code on the page of the same phone cannot be
  scanned).
- **Redirect (fallback)**: for wallets that cannot do the in-app flow, the AS answers the challenge request with
  `redirect_to_web`, or the wallet uses the `authorization_endpoint` directly. The wallet opens a browser, the AS
  shows the OpenID4VP request (deeplink for same-device, QR code for cross-device), and redirects back to the
  wallet with an authorization code.

Out of scope: the verifier acting as an OpenID Connect provider towards the AS (federation). The verifier stays an
OpenID4VP verifier.

## 2. Status of the protocol (read this first)

The flow is an ecosystem convention, **not one normative specification**. I checked the texts (September 2026):

| Document | What it says about this flow |
|---|---|
| OpenID4VCI 1.0 Final | Mentions presentation during issuance only in a note in §3.4 and in informative use cases (Appendix H.4/H.5). It defines no endpoint, parameter or error code. `issuer_state` (§4.1.1) is opaque to the wallet, and the wallet MUST include it in the authorization request. |
| draft-ietf-oauth-first-party-apps-04 | Defines the *authorization challenge endpoint* (`authorization_challenge_endpoint` metadata, `auth_session`, `insufficient_authorization`, and the `redirect_to_web` error for falling back to a browser flow). It is generic and does not mention OpenID4VP. It defines no `presentation` parameter. |
| OpenID4VP 1.0 Final | The direct_post response is `200` with `Content-Type: application/json` and a JSON object. Extra parameters MAY be returned and the wallet MUST ignore unknown ones. The response MAY contain a `redirect_uri` (§8.2) to which the wallet sends the user agent. `presentation_during_issuance_session` is not defined. |

The pieces that join them (`presentation` in the error response, `presentation_during_issuance_session` in the
direct_post response and in the follow-up challenge request) come from the libraries the wallet uses:
`@openid4vc/oauth2` and `@openid4vc/openid4vci` 0.8.2 and `@credo-ts/openid4vc` 0.8.0-alpha. The implementation to
mirror is `openid4vc-issuer/router/authorizationChallengeEndpoint.mjs` in `@credo-ts/openid4vc`. It can also serve
as an interoperability reference peer in tests. Paradym uses exactly this path
(`acquireCredentialsAuthPresentationDuringIssuance.ts`).

Decisions taken (formerly open questions, see 10): HTTP status for `insufficient_authorization` is **403**; the
wallet does **not** send `client_id` in the challenge request; trust of the presented issuer is a **verifier**
concern; the AS lives at `<tenant>/as`; verified data is exposed through `#accessData`.

## 3. Wire protocol

### 3.1 In-app flow

```
Wallet                         Issuer + AS (<base>/as)                    Verifier (veramo-verifier)
  | 1. GET credential offer (grants.authorization_code.issuer_state)             |
  | 2. GET /.well-known/openid-credential-issuer  -> authorization_servers [<base>/as]
  | 3. GET AS metadata (RFC 8414)  -> authorization_challenge_endpoint, token_endpoint
  | 4. POST /as/authorization-challenge                                           |
  |      issuer_state, authorization_details, code_challenge(+_method), resource   (client_id optional)
  |                                 | create DCQL request ----------------------> |
  |                                 | <-------- state, requestUri, checkUri ----- |
  | <-- 403 {error: insufficient_authorization, auth_session, presentation: <openid4vp uri>}
  | 5. fetch + answer the OpenID4VP request ---------------------------------------->
  | <-- 200 application/json {presentation_during_issuance_session}  (from the verifier)
  |     (a failed verification returns an error body instead, see 4.2)
  | 6. POST /as/authorization-challenge                                           |
  |      auth_session, presentation_during_issuance_session                       |
  |                                 | GET check-offer/<state> ------------------> |
  |                                 | <---- RESPONSE_RECEIVED + result ---------- |
  | <-- 200 {authorization_code}    (claims stored in the session)                |
  | 7. POST /as/token  grant_type=authorization_code, code, code_verifier         |
  | <-- 200 {access_token, authorization_details[credential_identifiers], ...}
  | 8. POST /credentials (per credential_identifier)  -> credential filled from #accessData
```

### 3.2 Redirect flow (fallback)

```
Wallet / browser               Issuer + AS (<base>/as)                    Verifier
  | 4'. POST /as/authorization-challenge  -> 400 {error: redirect_to_web}   (or the wallet skips this step)
  | 5'. open browser: GET /as/authorize?response_type=code&issuer_state&redirect_uri&
  |      code_challenge&code_challenge_method=S256&state&authorization_details&client_id[&dpop_jkt]
  |                                 | validate, create DCQL request -----------> |
  | <-- page: "Open your wallet" (same-device deeplink) + QR code (cross-device)
  | 6'. wallet answers the OpenID4VP request ------------------------------------>
  | <-- 200 {redirect_uri: <base>/as/continue?...&response_code=...}  (verifier, direct_post)
  | 7'. browser GET <base>/as/continue  (same-device: opened by the wallet)
  |                                 | check-offer, policy, store claims
  | <-- 302 <wallet redirect_uri>?code=...&state=...
  | 8'. POST /as/token  ... same as 7 in the in-app flow
```

Cross-device: the authorize page polls `GET /as/authorize/status` (bound to the browser session by a cookie) and
continues to `/as/continue` when the verifier reports `RESPONSE_RECEIVED`. Same-device: the wallet opens the
`redirect_uri` from the direct_post response, which carries a `response_code`. The `response_code` is required
and must match the value stored by the verifier, **and** the request must carry the browser-session cookie
(protects against session fixation, OpenID4VP §14.3). Details in 4.1 and 4.2.3.

### 3.3 What the wallet libraries do

These fix the contract of the in-app flow:

- Step 4 is sent form-encoded. The libraries add `issuer_state` from the offer, `resource` (the credential issuer
  identifier) and PKCE (`code_challenge`, `S256`) **only if** the
  AS metadata lists `code_challenge_methods_supported`. They send no `redirect_uri` for the follow-up call and, as
  decided, **no `client_id`**.
- Step 4 is treated as "presentation during issuance" only when the error is `insufficient_authorization` **and**
  both `presentation` and `auth_session` are present. `presentation` is an OpenID4VP authorization request URL.
- Step 6 sends `auth_session` and `presentation_during_issuance_session` only. The value comes from the JSON body of
  the verifier's direct_post response (`responseJson.presentation_during_issuance_session`).
- **Authorization details or scope.** The released `@openid4vc` libraries (and so `@credo-ts/openid4vc` and
  Paradym) send only `scope`, filled from the `scope` of the offered credential configurations, and never
  `authorization_details`. The AS accepts both, but the offer (bound through `issuer_state`) decides what is
  issued:
  - `authorization_details`, if present, must be valid and may only name offered configurations, otherwise the
    request is `400 invalid_authorization_details`;
  - otherwise each scope value is mapped to configurations through their `scope` in the issuer metadata. A scope
    of a configuration that is not in the offer is `400 invalid_authorization_details`; an unknown scope value
    (for example `openid`) is ignored (RFC 6749, 3.3);
  - without either, the offered configurations apply.

  Give each credential configuration that is offered this way a `scope` in the metadata, so that the wallet can
  send a meaningful value. The token response always returns the `authorization_details` of the offered
  configurations with their `credential_identifiers` (4.1 token endpoint).
- DPoP is used if the AS metadata contains `dpop_signing_alg_values_supported`. We advertise it (see 7).

## 4. Components

### 4.1 Embedded AS in veramo-agent

New module `src/as/` (name open), mounted under the issuer router at `/as`. The AS identifier is
`<issuer.options.baseUrl>/as` (the AS is a subpath of the issuer; for a tenant `<tenant>/as`).

Configuration (new issuer option, instead of reusing `authorizationEndpoint`, which means "external AS" and makes
the agent fetch its own metadata over HTTP):

```json
"embeddedAuthorizationServer": {
    "enabled": true,
    "mode": "both",
    "verifier": { "url": "https://verifier.../<instance>", "verifierToken": "<verifier access token>" },
    "clients": [
        { "clientId": "wallet-a", "redirectUris": ["https://wallet-a.example/cb"] },
        { "clientId": "wallet-b", "redirectUris": ["openid-wallet-b://cb", "https://wallet-b.example/cb"] }
    ],
    "authSessionTtl": 86400,
    "codeTtl": 60
}
```

- `mode`: `in-app` (challenge only), `redirect` (challenge answers `redirect_to_web`, `authorize` enabled) or `both`
  (default).
- `authSessionTtl` (seconds, default `86400`): the maximum life of an `auth_session`. The default is longer than
  the default life of a session in `veramo-agent` and `veramo-verifier` (`SessionStateManager.newState()`: 4
  hours), so in practice the session life decides: the `auth_session` is never valid longer than the expiration
  date of the issuance session, nor longer than the verifier session of the request (4.2). `expires_in` in the 403
  response is the remaining time under these limits. `codeTtl` (default 60) is separate.
- `clients`: the list of supported wallets, each with its `client_id` and the redirect URLs that belong to it. It is
  checked during the process (see the endpoints below): `client_id` must be in the list, and `redirect_uri` must
  match **exactly** (string comparison, no wildcards) one of the `redirectUris` of *that* client. Required when
  `mode` is `redirect` or `both`; client ids must be unique, redirect URIs must be absolute and must not contain a
  fragment.
- `verifier.verifierToken` (optional): the access token that the AS sends as bearer token on `create-dcql-offer`
  and `check-offer`. It is the verifier's own API token (the token of the verifier's `-admin` passport strategy,
  `verifier.adminToken`), which gives the issuer full API rights on the verifier. It is a different value from the
  `adminToken` in the issuer configuration, which is never sent to the verifier, and from the verifier's
  `BEARER_TOKEN`, which belongs to a separate strategy that guards reading the configuration, identifiers and
  presentations; the AS needs no access to those. The verifier needs no new strategy for this. `exportConfig` and
  the logs mask the token. **Without a `verifierToken` the AS cannot start a verification during issuance**: the issuer still
  starts (the option is optional, and the AS metadata stays available), but `create-offer` refuses every request
  that carries a `dcql` query (see 4.5), and the challenge and authorize endpoints answer `400 invalid_request`
  for a session that has a query. The AS never calls the verifier without a token.
- Configuration validation (at startup): the embedded AS can be combined with an external `authorizationEndpoint` (see
  ASREDESIGN.md), which cannot be the issuer or `<base>/as`; `verifier.url` is required; `clients` is required for the
  redirect modes; the TTLs have sane bounds.

Effects on existing code (all places that use `authorizationEndpoint` or decide on the flow):

- `Issuer.usesAuthorisedCodeFlow()` (`Issuer.ts:73`) is also true when the embedded AS is enabled.
- `Issuer.ts:97-106` fetches the keys and metadata of the external AS during initialisation. **Skip this for the
  embedded AS**; the agent would otherwise fetch its own endpoint over HTTP while starting. The AS metadata is
  built locally.
- The issuer metadata `authorization_servers` lists the issuer, `<base>/as` and an external AS (`Issuer.authorizationServers()`).
  The offer names the AS in its grant (`Issuer.authorizationServerFor()`); the token `iss` is checked per session
  (`utils/expectedTokenIssuers.ts`). See ASREDESIGN.md.
- Review the remaining users of `authorizationEndpoint`: `Store.ts`, `types/internal.ts`,
  `endpoints/getOAuthConfiguration.ts`, `endpoints/getOpenidConfiguration.ts`, `admin/exportConfig.ts` and
  `server/__tests__/createRoutesForIssuer.test.ts`. `getOAuthConfiguration.ts` and `getOpenidConfiguration.ts`
  probably need to serve the embedded AS metadata.
- `sessionUsesAuthorisationCodeFlow(session)` in `validateCredentialRequest` decides the flow per session. It must
  treat a session with `authorization.presentation` as authorisation-code flow.
- `verifyAccessTokenJWT` already verifies a JWT against the issuer key first, so self-issued authorization-code
  tokens need no introspection or JWKS fetch. `jwks_uri` can be added to the AS metadata later (not needed by the
  agent itself).

#### Metadata (RFC 8414), served at both

- `/.well-known/oauth-authorization-server<path of /as>` (path insertion, same pattern as
  `getOAuthConfiguration.ts` uses with the `wellKnownRouter` for multi-tenant; for a tenant the path is
  `<tenant>/as`), and
- `<base>/as/.well-known/openid-configuration` as fallback (the agent's own `retrieveServerMetadata` tries both).

```json
{
  "issuer": "<base>/as",
  "authorization_challenge_endpoint": "<base>/as/authorization-challenge",
  "authorization_endpoint": "<base>/as/authorize",
  "token_endpoint": "<base>/as/token",
  "grant_types_supported": ["authorization_code"],
  "response_types_supported": ["code"],
  "code_challenge_methods_supported": ["S256"],
  "token_endpoint_auth_methods_supported": ["none"],
  "dpop_signing_alg_values_supported": ["ES256"]
}
```

`authorization_endpoint` is only present when `mode` is `redirect` or `both`.

#### `POST /as/authorization-challenge` (form-encoded)

*First call* (no `auth_session`):

1. Find the session by `issuer_state` (`issuer.getSessionByState`). It must exist, the offer must have the
   `authorization_code` grant, the session must have `authorization.presentation.dcql`, and it must not be expired.
   Otherwise `400 invalid_request` (do not reveal which condition failed).
2. Require `code_challenge` with `S256` (we advertise it). Store `code_challenge`, `code_challenge_method`.
   `client_id` is **optional** in the in-app flow (wallets do not send it): if it is sent it must be in `clients`
   (otherwise `400 invalid_client`), it is stored, and it is compared at the token endpoint. Without `client_id`
   the PKCE challenge plus the DPoP key (7) are the binding.
   **The `issuer_state` is the secret that gives access to the in-app flow**, comparable to a `client_secret`: it
   is random, 256 bits, and only known to the wallet that received the offer. The `clients` list therefore does
   not restrict who may call the challenge endpoint in the in-app flow; it restricts the redirect flow (where the
   `client_id` and `redirect_uri` are required), and a `client_id` that is sent.
3. If `mode` is `redirect`: respond `400 {"error": "redirect_to_web"}` and stop.
4. Reuse of `issuer_state`: if the session already has an active (unexpired, unused) `auth_session`, invalidate it,
   cancel the earlier verifier request (it simply expires) and start a new one. A session that already issued its
   code (`PRESENTATION_VERIFIED` or later) answers `400 invalid_request`.
5. `POST <verifier>/api/create-dcql-offer` with `{ "dcql": <query>, "presentation_during_issuance": true }`.
   Keep `state`, `requestUri`, `checkUri` in the session.
6. Generate `auth_session` (256 bits, base64url). Store only its SHA-256 and `expiresAt`.
7. Respond `403`:
   ```json
   { "error": "insufficient_authorization", "error_description": "Presentation required before issuance",
     "auth_session": "...", "presentation": "<requestUri as an openid4vp:// URL>", "expires_in": 600 }
   ```
   Status is 403 (decided; the libraries accept any non-2xx with a parseable error body).

*Second call* (with `auth_session`):

1. Look up the session by the hash of `auth_session`. Unknown, expired or used: `400 invalid_session`.
2. `GET <verifier>/api/check-offer/<state>` and map the verifier status:
   - `RESPONSE_PROCESSING` or any status before `RESPONSE_RECEIVED`: `403 insufficient_authorization` with the same
     `auth_session` and `interval` (seconds) so that the wallet backs off. `expires_in` is unchanged.
   - `RESPONSE_RECEIVED`: continue.
   - A request that is itself expired or unknown at the verifier: `400 invalid_session`.
3. Compare the request's `presentation_during_issuance_session` with the value the verifier returned in its
   `result` (constant-time). Mismatch or missing: `400 invalid_session`.
4. Apply the acceptance policy (4.3). Rejected: `400 access_denied`, mark the session `AUTHORIZATION_DENIED`.
5. In one atomic step (4.4): store the verified claims as `session.data.presentationData`, generate the
   authorization code (256 bits, store SHA-256, `codeExpiresAt = now + codeTtl`), invalidate the `auth_session`
   and set the status `PRESENTATION_VERIFIED`.
6. `200 {"authorization_code": "..."}`.

Polling is limited by the challenge rate limiter (6) and by `interval`; the AS performs at most one `check-offer`
per `auth_session` per `interval` and answers repeated calls from the cached state.

#### `GET /as/authorize` and `GET /as/continue` (redirect mode)

`GET /as/authorize` parameters: `response_type=code`, `client_id` (**required**), `redirect_uri` (**required**),
`issuer_state`, `code_challenge`, `code_challenge_method=S256`, `state` (opaque, returned unchanged),
`authorization_details`, and optionally `dpop_jkt` (RFC 9449 §10, binds the code to the wallet's DPoP key, 7).

1. Validate `client_id` and `redirect_uri` first: `client_id` must be in `clients` and `redirect_uri` must
   **exactly** match one of the redirect URIs of that client. If either is invalid, show an error page and
   **never redirect**. Then validate as in the challenge endpoint (session, grant, expiry, PKCE). Other errors are
   returned by redirecting to the validated `redirect_uri` with `error` and `state`. Store `clientId` and
   `redirectUri` with the session.
2. Create the verifier request as for the challenge endpoint, generate a browser-session cookie
   (`HttpOnly`, `Secure`, `SameSite=Lax`, bound to the `auth_session`).
3. Render the page: same-device button (deeplink to the `openid4vp://` URL) and QR code (cross-device), and a small
   script that polls `GET /as/authorize/status`. The page contains no claim data.
4. `GET /as/continue` is the target of the verifier's `redirect_uri` (same-device) and of the poll script
   (cross-device). Same-device: it requires the `response_code` **and** the matching browser-session cookie; the
   code alone is not enough, so a code that leaks through a redirect, log or referrer cannot be used from another
   browser. Cross-device: the browser that shows the QR code proves itself with the cookie only (the phone that
   opens the `redirect_uri` has no cookie and shows an error or "continue on your other device" page). The first of
   the two paths that succeeds consumes the `auth_session` (4.4). Then it runs the same steps 2-5 of the second
   challenge call, and
   finally responds `302 <redirect_uri>?code=<code>&state=<state>`. On rejection:
   `302 <redirect_uri>?error=access_denied&state=<state>`.

#### `POST /as/token` (`grant_type=authorization_code`)

Extend `validateAccessTokenRequest` (or add a handler next to `accessToken.ts`) for the grant `authorization_code`:

- `code` known, not used, not expired. Mark it used **atomically before responding** (4.4). `code_verifier` must
  match the stored `code_challenge`. If a `client_id` was stored (always in the redirect flow), the request must
  carry the same `client_id`, and it must still be in `clients` (the list is checked again here). In the redirect
  flow `redirect_uri` is required and must equal the one of the authorize request. A `client_id` in the token
  request that was not stored: `400 invalid_client`.
- With DPoP: the proof must be valid and its key thumbprint must equal the one stored with the `auth_session` (7).
- Create the token with `createAccessTokenResponse`, which already lists the `credential_identifiers`
  per `credential_configuration_id` (so multiple credentials work as in the pre-authorized flow).
- Access token payload: `iss` = `<base>/as`, `aud` = `credential_issuer`, `client_id` (if known), `iat`, `exp`,
  `jti`, `issuer_state` (the existing code finds the session through this claim), and `cnf.jkt` when DPoP is used.
  **No personal data in the token.**

### 4.2 veramo-verifier changes

1. **`direct_post` response body.** `receiveResponse.ts` now ends with an empty `200`, and its `catch` only logs, so
   a failed verification also answers `200`. OpenID4VP 1.0 §8.2 requires `200` + `application/json` + a JSON
   object. Return `{}` on success. When the request was created with `presentation_during_issuance: true`, return an
   error response instead of a session value if processing failed (OpenID4VP error body, HTTP 400), so that the
   wallet does not continue with a value that the AS will refuse anyway. For requests with a `redirect_uri` the
   body contains `redirect_uri` with a `response_code` (redirect flow).
2. **Session value.** When the request was created with `presentation_during_issuance: true` and the response is
   accepted (status `RESPONSE_RECEIVED`, no error messages), generate a 256-bit random value, return it as
   `presentation_during_issuance_session` in the JSON body, and store it in the verifier session
   (`session.data.presentationDuringIssuanceSession`, deleted with the session) and in the `check-offer` `result` as
   `presentationDuringIssuanceSession`. It is the proof that the party calling the challenge endpoint is the
   party that answered the request. It is never returned on a failed verification.
3. **`create-dcql-offer`** accepts two optional fields. Existing callers send neither and are unaffected.
   - `presentation_during_issuance` (boolean, default `false`): the request belongs to this flow, so the verifier
     generates and returns the session value (2) and the error body of (1).
   - `redirectUri` (string, redirect flow only): the URL (for example `<base>/as/continue`) that the verifier hands
     to the wallet after a successful response, so that the wallet can send the user agent back to the AS.
     Handling of the `response_code`:
     - **Generation**: when the response is accepted, the verifier generates a 256-bit random `response_code`,
       stores it in the verifier session (next to the session value from 2) and returns it in the `direct_post`
       body as `redirect_uri`: `redirectUri` with `response_code=<value>` added as query parameter (existing query
       parameters are kept, a `response_code` already in the URL is rejected at creation). No `redirect_uri` is
       returned on a failed verification or when `redirectUri` was not given.
     - **Handover to the AS**: the verifier also includes the value in the `check-offer` `result` as
       `responseCode`. The AS compares it, in constant time, with the `response_code` that arrives at
       `/as/continue`.
     - **Lifetime and single use**: valid for the lifetime of the verifier session (it is deleted with it) and
       never longer than the `authSessionTtl`. It is single-use: the AS marks the `auth_session` as used when it
       accepts the value (4.4), so a second use fails; the verifier returns it once, in the `direct_post` body.
     - **Validation of `redirectUri`**: it must be an absolute `https` URL (no fragment). The verifier checks it
       against an allow-list in its own configuration (`allowedRedirectUris`, exact match on origin and path); a
       request with another `redirectUri` is refused with `400`. The `verifierToken` gives full API rights, so this
       keeps a leaked token from being usable to make the verifier send wallets to an arbitrary URL.
4. **`check-offer`** only returns `result` when the status is `RESPONSE_RECEIVED` (`checkOffer.ts:30`). That stays;
   the AS treats a missing `result` as "not yet". The status values are the `RPStatus` enum:
   `INITIALIZED`, `AUTHORIZATION_REQUEST_CREATED`, `AUTHORIZATION_REQUEST_RETRIEVED`, `RESPONSE_PROCESSING`,
   `RESPONSE_RECEIVED`.
5. **Multiple credentials per request: no verifier change.** `veramo-verifier` already handles a DCQL query with
   several credential queries in one request. (The README of the verifier says that only one credential is
   supported; that is incorrect and is to be corrected, see 8.) The verifier returns the verified claims per DCQL
   credential id in `result.credentials` (`{ [id]: ExtractedCredential[] }`, `VPResult` in `RP.ts`), which is
   exactly the shape that the AS needs for `presentationData` (4.4). The AS therefore passes the query of
   `create-offer` unchanged to `create-dcql-offer` and reads the claims per id from `check-offer`; it adds no
   verifier logic of its own. What the AS does check, in the acceptance policy (4.3), is that every credential
   query the DCQL requires is present in `result.credentials`.
6. **Verifier token: no verifier change.** The AS authenticates with the `verifierToken` of 4.1, which is the
   token of the existing `<name>-admin` strategy (`bearerAdminForVerifier`). The issuer thereby has full API
   rights on the verifier (for now; a narrower token can be added later). Reading the configuration, identifiers
   and presentations is guarded by another strategy, based on the `BEARER_TOKEN` environment variable of the
   verifier, which is a different token that the issuer does not get.
7. **Relay protection** (see 6): the nonce of the verifier request is bound to the session, as the verifier
   already does; the `presentation_during_issuance_session` must additionally only be released once.

### 4.3 Acceptance policy (in the AS, from the check-offer result)

Accept only if all hold:

- status `RESPONSE_RECEIVED` and **every** message in `result.messages` has an accepted code. The accepted codes
  are `JWT_VERIFIED`, `CREDENTIAL_OK`, `STATUS_LIST_VALID`, `NO_STATUS_LIST`, `VCDM1.1`, `VCDM2` and `OIDFED_OK`;
  every other code is an error. The AS holds only this list of accepted codes (one constant); it does not need a
  list of error codes, so new error codes in the verifier are refused by default.
- `credential_sets` and `multiple` are interpreted by the **wallet**; the verifier only publishes them in the
  request, and the AS does not evaluate them. What the AS checks:
  - the credentials are read from `result.credentials.<credential id>` (`RP.ts`, DCQL processing): an array of
    `ExtractedCredential` (`DCQLSubmission.ts`: `claims`, `issuer`, `holder`, `type`, ...). The AS stores `claims`
    in `presentationData` and `issuer`/`holder` in `presentationMeta` (4.4);
  - the result holds at least one credential, and every id in `result.credentials` is an id of the DCQL query.
    Ids that the DCQL did not ask for are dropped, not stored;
  - if the query has **no** `credential_sets`, every credential query is required (DCQL default), so every id of
    the query must be present in the result;
  - if the query **has** `credential_sets`, the AS does not decide which options were required. It stores what
    arrived. A claim that a credential configuration needs but that was not presented fails when the credential
    is built (mandatory claims, `validateClaims`), which gives the same outcome without the AS reimplementing
    DCQL evaluation;
  - the claims that the query lists for a presented credential must be present (a presented credential without a
    requested claim is rejected, unless the claim query is marked optional by the query itself).
- trust of the presented credential's issuer is enforced by the verifier (decided). The AS adds no allow-list.

### 4.4 Data model, atomicity and `#accessData`

Session additions (JSON in `session.data`, like `deferredTransactions`):

```ts
authorization?: {
    presentation?: { dcql: object, verifierState: string, checkUri: string, authSessionHash: string,
                     expiresAt: number, lastCheckedAt?: number, dpopJkt?: string };
    clientId?: string;
    redirectUri?: string;
    pkce?: { challenge: string, method: 'S256' };
    code?: { hash: string, expiresAt: number, used: boolean };
};
presentationData?: { [dcqlCredentialId: string]: object | object[] };   // the verified claims of that credential
presentationMeta?: { [dcqlCredentialId: string]: { issuer?: string, holder?: string } };   // not part of accessData
// the verifier returns an array per id; the AS stores the claims object when the array has one entry,
// and the array of claims objects when it has more (only possible when the wallet used `multiple: true`)
```

**Atomicity.** `session.data` is a JSON document that is read, modified and written back. Two parallel requests with
the same code or `auth_session` could both pass the check. The use of the code and of `auth_session` therefore needs
an atomic compare-and-set. `utils/SessionStateManager.ts` has no such primitive: `set()` is a plain
`repo.save(session)` of the whole entity, `data` is a `simple-json` column, and the `Session` entity has no version
column, so two requests can both read an unused code and the last write wins (also against the write of
`accessData` in `validateCredentialRequest`).

Implemented without a change of the session store: the single-use steps claim an identifier through
`NonceManager.claim()` (`INSERT ... ON CONFLICT DO NOTHING` on the unique index (uuid, issuer)), which is atomic.
`issuer.asClaims` (a `NonceManager` named `<issuer>#as-claim`) claims `session:<hash of the auth_session>` in the
second challenge call and `code:<hash of the code>` in the token endpoint. Of two parallel requests only one claim
succeeds; the other gets `invalid_session` / `invalid_grant`. The claim expires with the `auth_session` or code.

Two details of the existing managers matter here. `get()` does not fail for an unknown or expired id; it returns a
new, empty session. The AS must therefore test for the data it needs (and the verifier answer of `check-offer` for
an expired or deleted verifier session has no `status`), and treat that as `invalid_session`. And sessions get an
expiration date of 4 hours in `newState()`; they are only removed by `clearAll()` (`Issuer.clearExpired()`), so
the AS checks `expirationDate` itself and does not rely on removal having run.

**Merge.** `validateCredentialRequest.ts:68` currently *replaces* `session.data.accessData` with the token payload on
every credential request. Change it to merge, so the verified data survives:

```ts
session.data.accessData = { ...session.data.presentationData, ...data.payload };
```

The name of the credential, its `id` in the DCQL query, is the first element of the path after `#accessData`. The
claims of the credential are directly below it (no extra namespace). Credential claims select the data with an
existing `origin`:

```json
{ "path": ["given_name"], "origin": [["#accessData", "PID", "given_name"]], "mandatory": true }
```

With several credential queries each has its own id (`["#accessData", "ADDRESS", "locality"]`). Rules:

- **No collisions with token claims.** The credential ids sit next to the access token claims in `accessData`, so
  `create-offer` rejects (`400`) a DCQL query with an id that is a claim name of the token (`iss`, `sub`, `aud`,
  `exp`, `nbf`, `iat`, `jti`, `client_id`, `issuer_state`, `cnf`, `scope`). In the merge the token claims come last, so
  they can never be replaced by presented data.
- **`multiple: true`**: when more than one presentation arrived for an id, the value is an array and the path
  contains the index as a string: `["#accessData", "PID", "0", "given_name"]` (`getAttributeFromPath` handles
  array indices already, since `"0" in array` is true). With one presentation there is no index, so a path without
  index also works for the usual case.
- **Absent credential** (for example an unsatisfied `credential_set` option): the path yields nothing, and the
  claim is handled as any missing claim (`mandatory` fails, optional is left out).
- `#any` works as before (same path in every source), with the same credential id as first element.

Side effects to check and handle:

- `retrieveExternalCredential` (`CredentialType.ts:74`) POSTs the complete `session.data.accessData` to
  `credential.callback`. With the merge, the verified claims of the presented credentials (possibly sensitive
  personal data) are part of that body. This is accepted behaviour: the callback receives the complete
  `accessData`, including the presented claims. The callback endpoint must be trusted accordingly, and this is
  documented in the configuration documentation of `callback`.
- `EduID.ts` and `EduIDEntitlement.ts` read `session.data.accessData` directly (`sub`, `edumember_is_member_of`).
  They are not used with this flow, but the merge must keep the token claims intact; add a test for it.
- `validateClaims` (`CredentialFactory.ts:79`) is called with `accessData` as well. Verify that validation at offer
  time (when no `accessData` exists yet) does not reject offers that rely on `#accessData`, see 4.5.

### 4.5 Offer creation (v2 API)

`POST /api/v2/create-offer`:

```json
{
  "dcql": {
    "credentials": [
      { "id": "PID", "format": "dc+sd-jwt", "meta": { "vct_values": ["..."] },
        "claims": [ { "path": ["given_name"] }, { "path": ["family_name"] } ] },
      { "id": "ADDRESS", "format": "dc+sd-jwt", "meta": { "vct_values": ["..."] },
        "claims": [ { "path": ["locality"] } ] }
    ]
  },
  "credentials": [ { "credential_configuration_id": "..." } ]
}
```

- **The presence of `dcql` is the trigger** for the verification-during-issuance flow. There is no separate flag.
  The front-end supplies the exact query; the agent stores it unchanged (after validation) in
  `session.data.authorization.presentation.dcql` and sends it to the verifier as is.
- `grant` may be omitted when `dcql` is present and defaults to `authorization_code`. `dcql` together with
  `grant: pre-authorized_code` is `400`. The `dcql` field is accepted on `create-offer` only, not on deferred or
  other offer endpoints.
- **Preconditions, checked at `create-offer`** so that the failure is visible to the back-office and not to the
  wallet halfway through the flow. If `dcql` is present and one of these does not hold, the request fails with
  `400` and an error description that names the missing setting, and no offer or session is created:
  - the embedded AS is enabled (`embeddedAuthorizationServer.enabled`);
  - `embeddedAuthorizationServer.verifier.url` is configured;
  - `embeddedAuthorizationServer.verifier.verifierToken` is configured (without it the AS cannot start the
    verification);
  - for `mode: redirect` or `both`, `clients` is configured.
- Validation of the query is deliberately light. **The front-end is responsible for the query**: it has validated
  that the verifier handles it successfully (supported formats, claims, `credential_sets`, `multiple`, and the
  number of credentials and claims). The agent does not check this against the verifier and sets no limits. It
  only checks what it needs itself: `dcql` is an object with a non-empty `credentials` array, and every entry has
  a unique string `id` (the key under which `presentationData` is stored and that `#accessData` origins refer to).
  Anything else is stored and forwarded unchanged. A query that the verifier nevertheless refuses at
  `create-dcql-offer` makes the challenge or authorize call fail (`400 invalid_request` or `server_error`); this
  is logged, and the session status becomes `AUTHORIZATION_DENIED`.
- The agent generates `issuer_state` and puts it in `grants.authorization_code`. `authorization_server` is set by
  the issuer to `<base>/as` for an offer with a `dcql` query (see ASREDESIGN.md).
- The DCQL query comes from the admin-authenticated back-office, never from the wallet.
- "Claims must be complete" for pre-authorized offers (APIV2.md) must **not** apply here: claims can come from
  `#accessData`. `validateCreateCredentialOffer` has to be changed for this. A claim whose origin is
  `#accessData <id> ...` (with `<id>` not a token claim name) must refer to a credential `id` and claim that is in the DCQL query;
  otherwise `400` (a typo would otherwise only show up when the wallet is waiting).

## 5. Status, observability

- New `CredentialOfferStatus` values: `PRESENTATION_REQUESTED` (first challenge or authorize call),
  `PRESENTATION_VERIFIED` (code issued), `AUTHORIZATION_DENIED`. Relation to the existing statuses: for this flow
  `ACCESS_TOKEN_CREATED` follows `PRESENTATION_VERIFIED` when the token is issued. The `ACCESS_TOKEN_CREATED` check
  in `validateCredentialRequest` is only applied to the pre-authorised flow and stays that way.
  `check-offer` returns the values unchanged.
- Store request/response data per phase for the demo timeline: `authorization_challenge-request/-response`,
  `authorize-request`, `presentation-request`, `presentation-response`.
- The demo's `IssuerService::PHASES` maps unknown statuses to `error`. It needs the new values.

## 6. Security

- `issuer_state`, `auth_session`, the authorization code, `response_code` and
  `presentation_during_issuance_session` are random (256 bits). Only hashes of `auth_session` and the code are
  stored.
- The code is single-use, valid for 60 seconds, bound to the PKCE challenge (and to `client_id` and `redirect_uri`
  when present). `auth_session` expires with the verifier request and dies when the code is issued.
- Compare secrets in constant time. Use the atomic update of 4.4 for code and `auth_session`.
- Rate-limit the challenge, authorize, continue and token endpoints with the existing `rateLimiters` pattern.
  Challenge calls with an unknown `issuer_state` cost nothing and reveal nothing. Apply a lower limit per
  `issuer_state` than per IP, so that a leaked `issuer_state` cannot be used to hammer the verifier.
- Redirect mode: `client_id` and `redirect_uri` are checked against the `clients` list (the redirect URI must belong
  to that client), at authorize and again at the token endpoint; no open redirect (an invalid client or
  redirect URI is never redirected to), `state` returned
  unchanged, `response_code` + cookie check against session fixation, `Cache-Control: no-store` on the pages, and
  a CSP on the authorize page.
- **Relay risk.** An attacker who holds the `requestUri` (shown on the authorize page, or taken from the 403
  response) can let another person's wallet answer it. The binding is: the verifier request is bound to the
  `auth_session`, and `presentation_during_issuance_session` is only known to the party that answered it. In the
  in-app flow these are the same device. In the redirect flow the cookie and `response_code` bind the browser to
  the answering wallet. Cross-device remains inherently relayable (a user can be tricked to scan a QR code); this
  is accepted and documented, and the verifier can mitigate it with `aud`/nonce binding it already enforces.
- Personal data: store only the requested claims. Delete `presentationData` when the offer is issued or the session
  expires. Expired sessions are removed by `SessionStateManager.clearAll()` through `Issuer.clearExpired()`;
  verify that this is called periodically in the running agent, and clear `presentationData` and
  `presentationMeta` as soon as the credentials are issued, not only when the session expires.
  Keep claims out of logs and out of the access token. `requestResponseData` for the demo must not echo claim
  values (the demo is allowed to show them; production issuers are not). Claims must not reach
  `credential.callback` (4.4).
- Verifier credentials: `embeddedAuthorizationServer.verifier.verifierToken` is the verifier's API token and gives
  the issuer full API rights on the verifier (4.2.6); it must be stored like a secret. The issuer `adminToken`
  and the verifier's `BEARER_TOKEN` are never involved. The token is not logged. `exportConfig` writes it like it writes the `adminToken` and `clientSecret` (the export is
  a restorable backup of the configuration, protected by the same bearer token).

## 7. DPoP (phase 2, decided to implement immediately)

DPoP is implemented together with the first AS version; the back-end code (`validateDPoPProof`, nonce handling) is
available already. This changes the metadata (`dpop_signing_alg_values_supported`, see 4.1), and with it the
behaviour of the wallet libraries (3.3).

- Challenge endpoint: the first call may carry a DPoP proof. The key thumbprint (`jkt`) is stored with the
  `auth_session` (`authorization.presentation.dpopJkt`). Later calls (second challenge call, token) must use a
  proof with the same key. A different key: `400 invalid_dpop_proof`.
- The code is bound to the same `jkt`. The token endpoint verifies the proof (`htm`, `htu`, `iat`, `jti`
  replay-cache, nonce) and issues the access token with `cnf.jkt`.
- Nonce: the endpoints answer `use_dpop_nonce` with a `DPoP-Nonce` header when the proof lacks a valid nonce. The
  nonce store of the agent is reused. The challenge and token endpoint share one nonce domain per AS.
- `/credentials` already checks the proof; verify that it compares the `jkt` of the token with the proof key for
  tokens issued by the embedded AS.
- Algorithm: `ES256` only for now (`dpop_signing_alg_values_supported`); a proof with another `alg` is refused.
- Redirect flow: there is no proof on the browser request to `/as/authorize`. The wallet gives the thumbprint of
  its DPoP key as `dpop_jkt` (RFC 9449 §10); the AS stores it as `dpopJkt` and the token request must carry a
  proof by that key. Without `dpop_jkt` the session is unbound (see below).
- If the wallet sends no DPoP proof, the AS accepts that (DPoP is optional), but marks the session as unbound.
  A configuration option `requireDpop` can refuse unbound sessions.
- Wallet attestation is out of scope.

## 8. Phases and tests

1. **Verifier**: direct_post JSON body (success and error), session value, the flag, `redirectUri`/`response_code`,
   (no new token strategy). Correct the README (more than one credential per request is supported). Tests in
   the verifier's existing suite, including: error body on failed verification, no session value on failure, value is only
   released once, `check-offer` states, a query with two credentials where one is missing or invalid, and that
   `credential_sets` and `multiple` are published unchanged in the request.
2. **AS (in-app) with DPoP**: metadata (both locations, multi-tenant path `<tenant>/as`), challenge, token,
   session data, `accessData` merge, `v2/create-offer` with `presentation`, configuration validation, skipping the
   external AS initialisation. Unit tests next to the existing `__tests__` (a fake verifier client).
3. **Redirect mode**: `authorize`, `continue`, status polling, `redirect_to_web`, and the demo.

Tests (negative cases are part of the scope, not optional):

- expired `issuer_state`, `auth_session`, code; unknown values; reuse of the code (sequential and parallel);
  wrong PKCE verifier; mismatching `client_id` when sent, and a missing `client_id` accepted;
- wrong `presentation_during_issuance_session`; failed verification; `RESPONSE_PROCESSING` answers 403 with
  `interval`; second `issuer_state` use; invalid `redirect_uri`; wrong DPoP key; missing DPoP nonce;
- credential request after the merge: token claims intact, `#accessData <id> ...` filled (also with an index for `multiple`), callback does
  not receive the credential ids, an id that equals a token claim name is refused at `create-offer`; `PRESENTATION_*` statuses in `check-offer`;
- interoperability: the Paradym wallet, and, for the wire format, `@credo-ts/openid4vc` as a wallet and as a
  reference issuer;
- create-offer: `dcql` triggers the flow; `dcql` with the pre-authorized grant, without an enabled AS, without
  `verifier.url`, without `verifierToken`, without `clients` in a redirect mode, a query without `credentials`,
  duplicate ids, a claim origin that refers to an id not in the query: all `400` and no session created; a query with several
  credentials is stored unchanged and sent to the verifier;
- clients: unknown `client_id`; a `redirect_uri` of another client; a near-match of a redirect URI (trailing slash,
  different case); `client_id` that differs between authorize and token request.

Documentation: update `APIV2.md` (`presentation`, new statuses), the config examples and the README of both
repositories (the new issuer option and the verifier flag).

## 9. The demo (third demo, outline)

Prepare: choose what to verify (PID claims) and show the credential that will be filled. Offer: authorization_code
offer, QR code. Verification: the wallet shows the presentation request. The page shows the timeline from
`check-offer` (`PRESENTATION_REQUESTED` → `PRESENTATION_VERIFIED`). Completed: issued credential with the claims copied
from the presentation. Needs a credential configuration on the sandbox issuer whose claims use `#accessData`
origins, and an enabled `embeddedAuthorizationServer`. A second variant demonstrates the redirect mode in a browser.

## 10. Decisions (formerly open questions)

1. HTTP status for `insufficient_authorization`: **403**.
2. The wallet does **not** send `client_id` in the challenge request. `client_id` is optional and only compared when
   it was stored.
3. Verifier error message codes and the single-credential limit: see the veramo-verifier repository (4.3).
4. Trust of the presented issuer: a task of the **verifier**.
5. Multi-tenant well-known path: **`<tenant>/as`**.
6. Namespacing of verified data: **`accessData`**, with the DCQL credential id as first path element
   (`["#accessData", "PID", "given_name"]`, no extra namespace).
7. Redirect variant: **challenge endpoint with `redirect_to_web` fallback to the redirect flow**. The verifier as
   OIDC provider (federation) is out of scope.

8. Verifier access: an optional **`verifierToken`** in the issuer configuration, which is the verifier's API
   token (full API rights for now). The issuer `adminToken` is not used towards the verifier, and the verifier's
   `BEARER_TOKEN` (configuration, identifiers, presentations) is not given to the issuer. Without a `verifierToken`
   the AS cannot start a verification, and `create-offer` with a `dcql` query fails with `400` (4.5).
9. Redirect URLs: the supported wallets are listed in the issuer configuration (`clients`: `client_id` with its
   redirect URLs) and checked during the process.
10. Several credentials per verification: supported. The front-end gives the DCQL query in `create-offer`
    (`dcql`), and the presence of that field starts the flow. The verifier already supports this (4.2.5).
11. The front-end validates that the verifier can handle the DCQL query it sends. The agent only checks the
    structure it needs itself (4.5).
12. `credential_sets` and `multiple` are interpreted by the wallet; the verifier publishes them correctly in the
    request, and the AS does not evaluate them (4.3).
13. The `issuer_state` acts as the secret of the in-app flow (like a `client_secret`); `clients` is enforced in the
    redirect flow and for a `client_id` that is sent (4.1).
14. Both `authorization_details` and `scope` are accepted; the offer decides what is issued (3.3). Originally only `authorization_details` was supported, but the released wallet libraries send only `scope`.
15. Accepted verifier message codes: `JWT_VERIFIED`, `CREDENTIAL_OK`, `STATUS_LIST_VALID`, `NO_STATUS_LIST`,
    `VCDM1.1`, `VCDM2`, `OIDFED_OK`; all others are errors (4.3).
16. DPoP: `ES256` only (7).
17. `authSessionTtl` defaults to 86400 s, longer than the 4 hour session life, which therefore decides (4.1).
18. The `credential.callback` receives the complete `accessData`, including presented claims (4.4).
19. No recovery when the wallet misses the authorization code response, and the verifier's debug logging of tokens
    stays as it is (development project).

## 11. Implementation notes (where the code differs from, or adds to, this design)

Verifier (`veramo-verifier`):

- `direct_post` waits for the verification (`RP.processResponse(..., awaitVerification)`) when the request was
  created with `presentation_during_issuance`; without the flag the verifier still answers before the verification
  has finished, as before. The response is always `200` with a JSON body now.
- `allowedRedirectUris` is a column of the verifier table (migration 8, `allowed_redirect_uris`), the admin API
  and `exportConfig` carry it.
- `src/verifier/PresentationDuringIssuance.ts` holds the accepted message codes, the redirect URI validation and
  the helpers; the session state is `session.data.presentationDuringIssuance`.

Agent (`veramo-agent`):

- Code is in `src/as/` (`config`, `constants`, `util`, `verifierClient`, `policy`, `dpop`, `challenge`, `token`,
  `metadata`, `routes`, `dcqlOffer`). The configuration is stored in a new `embeddedAuthorizationServer` column of
  the issuer table (migration 13), in the admin API and in `exportConfig`.
- `auth_session` and the authorization code have the form `<session uuid>.<secret>`; only the SHA-256 of the
  secret is stored. This lets the AS find the session without scanning the session data.
- The atomic single use is done with `NonceManager.claim()` (see 4.4), not with a version column.
- `Issuer.signToken` only sets `iss` when it is not set yet, so that the embedded AS can sign under `<base>/as`.
  `createAccessTokenResponse` takes optional token claims. The access token of the AS expires after 30 minutes
  (the existing pre-authorized token computes `exp` from a value in milliseconds; that is left as it is).
- `usesAuthorisedCodeFlow()` is true for both kinds of AS; `usesExternalAuthorizationServer()` is the old
  meaning and decides on the introspection of opaque tokens in `verifyAccessTokenJWT`.
- The `authorization_details` or the `scope` of the challenge and authorize requests are validated against the
  offered configuration ids (`validAuthorizationRequest` in `presentation.ts`, see 3.3). The
  token response lists the identifiers of all data sets of the session, as the pre-authorized flow does.
- `src/issuer/api/validateCredentialRequest.ts` merges `presentationData` into `accessData` and now checks the
  DPoP proof for tokens of the embedded AS (also in `validateDeferredRequest.ts`).
- Tests: `src/as/__tests__` (policy, `create-offer` validation, configuration, and the complete flow with a fake
  verifier, including DPoP, PKCE, parallel use of the code and the negative cases).

Redirect mode (3.2), `src/as/authorize.ts`, `authorizePage.ts` and `presentation.ts` (the steps that both flows share):

- `GET /as/authorize` validates `client_id` and `redirect_uri` against `clients` first and never redirects when they
  are invalid. It starts the verifier request with `redirectUri = <base>/as/continue`, so **that URL must be in the
  `allowedRedirectUris` of the verifier**. The page has the deeplink and a QR code (`qrcode`, a new dependency),
  and a script (CSP with nonce) that polls `GET /as/authorize/status`.
- The cookie `as_session` (`HttpOnly`, `SameSite=Lax`, `Secure` for https, path `<base path>/as`) holds
  `<session uuid>.<secret>`; only the hash is stored (`presentation.browserHash`).
- `GET /as/continue` requires the cookie. A `response_code` is optional there: if the wallet redirected the browser
  it is present and must equal the verifier's `responseCode`; the page of the cross-device flow continues without
  it, with the cookie only. A phone without the cookie cannot complete the session.
- `/as/token` requires the `redirect_uri` (and the `client_id`) of the authorization request in the redirect flow.
- `dpop_jkt` on the authorize request binds the session to the DPoP key, as 7 describes.
- The poll endpoint and `continue` use separate throttles (`lastPolledAt`, `lastCheckedAt`).
- Tests: `src/as/__tests__/redirect.test.ts`.

Not implemented: the demo (9). The `getOAuthConfiguration`/`getOpenidConfiguration` of the issuer itself are
unchanged, and the credential endpoint is not covered by a test for the `accessData` merge.
