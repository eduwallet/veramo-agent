
export interface AuthorizationDetail {
    [x:string]: any;
}

export interface AccessTokenResponse {
    access_token: string;
    scope?: string;
    token_type?: string;
    expires_in?: number; // in seconds
    c_nonce?: string;
    c_nonce_expires_in?: number; // in seconds
    authorization_pending?: boolean;
    interval?: number; // in seconds
    authorization_details?:AuthorizationDetail[];
}
