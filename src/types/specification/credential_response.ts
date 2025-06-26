// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-credential-response

export interface CredentialResponse {
    credential?:any;
    credentials?:any; // one or more credentials as defined in ID2
    transaction_id?:string;
    c_nonce?:string; // no longer used in ID2
    c_nonce_expires_in?:number; // no longer used in ID2
    notification_id?:string;
}
