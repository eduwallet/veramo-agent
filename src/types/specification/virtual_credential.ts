// https://www.w3.org/TR/vc-data-model/

export type Credential = CredentialBasic;

export interface CredentialBasic {
    '@context': string[];
     id?:string;
     type:string[];
     credentialSubject: CredentialSubject | CredentialSubject[];
     issuer: string|Issuer;
     issuanceDate:string;     // XMLSCHEMA11-2 date-time like '2010-01-01T19:23:24Z'
     expirationDate?: string; // XMLSCHEMA11-2 date-time like '2010-01-01T19:23:24Z'
     credentialStatus?:CredentialStatus;
}

// the encoded JWT or a non-encoded ldp_vc
export type VerifiableCredential = VerifiableCredentialBasic | string;

export interface VerifiableCredentialBasic extends CredentialBasic {
    proof: any;
    credentialStatus: CredentialStatus;
}

export interface CredentialStatus {
    id:string;
    type: string;
    [x:string]: any;
}

export interface Issuer {
    id: string;
    [x:string]: any;
}

export interface CredentialSubject {
    [x:string]:any;
}