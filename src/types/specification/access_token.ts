// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-token-endpoint
// https://www.rfc-editor.org/rfc/rfc6749.html

export enum GrantTypes {
    AUTHORIZATION_CODE = 'authorization_code',
    PRE_AUTHORIZED_CODE = 'urn:ietf:params:oauth:grant-type:pre-authorized_code',
}
  
export interface TokenRequest {
    grant_type: GrantTypes;
    scope?: string;

    // only required if this application is an AS, which we never are
    client_id?: string;
    code?: string;
    code_verifier?: string;
    redirect_uri?: string;

    'pre-authorized_code': string;
    tx_code?: string;
    user_pin?: string; // backwards compatibility attribute
    authorization_details?:AuthorizationDetail[];
}

export interface AuthorizationDetail {
    [x:string]: any;
}

export interface AccessTokenResponse {
    access_token: string;
    scope?: string;
    token_type?: string;
    expires_in?: number; // in seconds
    c_nonce?: string; // no longer supported in ID2
    c_nonce_expires_in?: number; // in seconds, no longer supported in ID2
    authorization_pending?: boolean;
    interval?: number; // in seconds
    authorization_details?:AuthorizationDetail[];
}
