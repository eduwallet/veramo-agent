/*
 * Credential Issuer metadata
 *
 * https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-credential-issuer-metadata
 */
export interface Metadata {
    credential_issuer: string;            // https URI without fragments or query
    authorization_servers?: string[];     // list of OAuth 2.0 authorization servers
    credential_endpoint: string;          // URL of the issuer credential endpoint
    batch_credential_endpoint?:string;    // URL of the issuer batch credential endpoint
    deferred_credential_endpoint?:string; // URL of the issuer deferred credential endpoint 
}
