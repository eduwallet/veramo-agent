// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-credential-response

import { W3CVerifiableCredential } from "@veramo/core";

export interface CredentialResponse {
    credential?:W3CVerifiableCredential;
    transaction_id?:string;
    c_nonce?:string;
    c_nonce_expires_in?:number;
    notification_id?:string;
}
