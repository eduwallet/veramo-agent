// Claim names of the access tokens of the embedded authorization server. Credential ids of a DCQL query sit next
// to these in session.data.accessData (see DESIGN_PRESENTATION_DURING_ISSUANCE.md, 4.4), so they cannot be used as id.
export const RESERVED_TOKEN_CLAIMS = [
    'iss', 'sub', 'aud', 'exp', 'nbf', 'iat', 'jti', 'client_id', 'issuer_state', 'cnf', 'scope', 'token_type'
];

// message codes of the verifier that signal a success; every other code is an error
export const ACCEPTED_MESSAGE_CODES = [
    'JWT_VERIFIED', 'CREDENTIAL_OK', 'STATUS_LIST_VALID', 'NO_STATUS_LIST', 'VCDM1.1', 'VCDM2', 'OIDFED_OK'
];

// seconds a wallet should wait between two polls of the authorization challenge endpoint
export const POLL_INTERVAL = 5;
// lifetime of the access token, in seconds
export const ACCESS_TOKEN_TTL = 30 * 60;
