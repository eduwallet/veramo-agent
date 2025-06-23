import { StringKeyedObject } from "#root/types/index";
import { AuthorizationCodeGrant, TxCode } from "#root/types/specification/credential_offer";

/* Creating the initial credential offer */
export interface APIPreAuthGrant {
    'pre-authorized_code'?: string;
    tx_code?: TxCode|boolean;
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
}
  
export type CreateCredentialOfferResponse = {
    uri: string;
    txCode?: string;
    id?: string;
}
