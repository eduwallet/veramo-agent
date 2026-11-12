import { StringKeyedObject } from "#root/types/index";
import { AuthorizationCodeGrant } from "#root/types/specification/credential_offer";


export interface TxCodeRequest {
    input_mode?: 'numeric' | 'text';
    length?: number;
    description?: string;
    code?: string;
}


/* Creating the initial credential offer */
export interface APIPreAuthGrant {
    'pre-authorized_code'?: string;
    tx_code?: TxCodeRequest|boolean;
    interval?: number;
    authorization_server?: string;
}

export interface APIGrants {
    authorization_code?: AuthorizationCodeGrant;
    'urn:ietf:params:oauth:grant-type:pre-authorized_code'?: APIPreAuthGrant;
}

export interface CreateCredentialOfferRequest {
    credentials: string[];
    grants: APIGrants;
    credentialDataSupplierInput?: StringKeyedObject;
    credentialMetadata?: StringKeyedObject;
    credential?:any;
    credential_callback?:string;
}
  
export type CreateCredentialOfferResponse = {
    uri: string;
    txCode?: string;
    id?: string;
}


/* v2: creating a credential offer for one or more credentials */

// a single claim: the path in the credential data (for example ['credentialSubject', 'name']) and its value
export interface ClaimRequest {
    path: (string|number)[];
    value: string|boolean|number;
}

// One credential of the offer. The issuer creates a data set from the claims
export interface CredentialRequestV2 {
    credential_configuration_id: string;    // key in the credential_configurations_supported of the issuer metadata
    claims?: ClaimRequest[];
    credential?: any;
    credential_callback?: string;
}

// The transaction code of the offer. The input_mode and length have defaults, the description is required
export interface TxCodeRequestV2 {
    input_mode?: 'numeric' | 'text';        // default numeric
    length?: number;                        // default 4
    description: string;
}

export interface CreateCredentialOfferRequestV2 {
    grant: 'pre-authorized_code' | 'authorization_code';
    tx_code?: TxCodeRequestV2;              // only for the pre-authorized_code grant
    credentials: CredentialRequestV2[];
    credentialMetadata?: StringKeyedObject;
}
