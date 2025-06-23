// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-credential-response

export interface CredentialResponse {
    credential?:any;
    transaction_id?:string;
    c_nonce?:string;
    c_nonce_expires_in?:number;
    notification_id?:string;
}
