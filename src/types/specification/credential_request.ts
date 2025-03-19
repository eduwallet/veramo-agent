import { JWK } from 'jose'
import { ClaimsList, NameSpacedClaimsList } from './metadata';

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-credential-request
export type CredentialRequest = CredentialRequestBase &
  (
    | CredentialRequestJwtVC
    | CredentialRequestLdpVC
    | CredentialRequestIsoMdl
    | CredentialRequestSdJwt);

export interface CredentialRequestBase {
    format?:string;  // REQUIRED when credential_identifiers was NOT returned from the token response
    proof?: ProofOfPossession;
    credential_identifier?: string;
    credential_response_encryption?:CredentialResponseEncryption;
}

export interface CredentialRequestJwtVC {
    credential_definition?: CredentialRequestCredentialDefinition;
}

export interface CredentialRequestCredentialDefinition {
    type:string[];
    credentialSubject?:CredentialRequestSubjects;
}

export interface CredentialRequestSubjects {
    [x:string]:CredentialRequestSubjects|CredentialRequestSubject|CredentialRequestSubject[];
}

export interface CredentialRequestSubject {
    mandatory?:boolean;
}

export interface CredentialRequestLdpVC {
    credential_definition?: CredentialRequestCredentialDefinitionWithContext;
}

export interface CredentialRequestCredentialDefinitionWithContext {
    "@context"?:string[];
    type:string[];
    credentialSubject?:CredentialRequestSubjects;
}

export interface CredentialRequestIsoMdl {
    doctype?:string;
    claims: NameSpacedClaimsList;
}

export interface CredentialRequestSdJwt {
    vct?:string;
    claims: ClaimsList;
}

export interface CredentialResponseEncryption {
    jwk: JWK;
    alg: string; // RFC 7516/RFC7518 alg algorithm for encrypting responses
    enc: string; // RFC 7516/RFC7518 enc algorithm for encrypting responses
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#proof-types
export interface ProofOfPossession {
    proof_type: string;
    jwt?:string;            // REQUIRED for proof_type jwt
    cwt?:string;            // REQUIRED for proof type cwt
    ldp_vp:any;             // REQUIRED for proof type ldp_vp. Composition of this object is not further implemented
}