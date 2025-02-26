
/* Credential Offer Parameters
 *
 * https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-credential-offer-parameters
 */

/* Grants */
export const AUTHORIZATION_CODE_GRANT = "authorization_code";
export const PRE_AUTHORIZED_CODE = 'pre-authorized_code';
export const PRE_AUTHORIZED_CODE_GRANT = 'urn:ietf:params:oauth:grant-type:pre-authorized_code';

export interface TxCode {
    input_mode?: 'numeric' | 'text';
    length?: number;
    description?: string;
}

export interface AuthorizationCodeGrant {
    issuer_state?: string;
    authorization_server?: string;
}

export interface PreAuthGrant {
    'pre-authorized_code': string;
    tx_code?: TxCode;
    interval?: number;
    authorization_server?: string;
}

export interface Grants {
    authorization_code?: AuthorizationCodeGrant;
    'urn:ietf:params:oauth:grant-type:pre-authorized_code'?: PreAuthGrant;
}
