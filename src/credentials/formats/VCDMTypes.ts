// https://www.w3.org/TR/vc-data-model-2.0/

export interface ClaimSet {
    [x:string]: string|number|ClaimSet;
}

// https://www.w3.org/TR/vc-data-model-2.0/#language-and-base-direction
export interface LanguageObject {
    "@value": string;
    "@language"?:string;
    "@direction"?:string;
}

export interface IssuerObject {
    id: string;
    [x:string]: string|LanguageObject[];
}

export interface CredentialStatus {
    id?:string;
    type:string;
    [x:string]: string|number|undefined|ClaimSet;
}

export interface CredentialSchema {
    id: string;
    type: string;
}

export interface EmbeddedProof {
    [x:string]: any;
}

export interface RelatedSource {
    id:string;
    mediaType?:string;
    digestSRI?:string|string[];
    digestMultibase?:string|string[];
}

export interface ExternalService {
    type:string;
    [x:string]: string|number|undefined|ClaimSet;
}

export interface VCDM {
    "@context": string[];               // https://www.w3.org/TR/vc-data-model-2.0/#contexts
    id?:string;                         // https://www.w3.org/TR/vc-data-model-2.0/#identifiers
    type: string[];                     // https://www.w3.org/TR/vc-data-model-2.0/#types
    name?: string|LanguageObject[];     // https://www.w3.org/TR/vc-data-model-2.0/#names-and-descriptions
    description?:string|LanguageObject[];
    issuer: string|IssuerObject;        // https://www.w3.org/TR/vc-data-model-2.0/#issuer
    credentialSubject: ClaimSet;        // https://www.w3.org/TR/vc-data-model-2.0/#credential-subject
    validFrom?:string;                  // https://www.w3.org/TR/vc-data-model-2.0/#validity-period
    validUntil?:string;
    credentialStatus?:ExternalService|ExternalService[];//  https://www.w3.org/TR/vc-data-model-2.0/#status
    credentialSchema?:CredentialSchema|CredentialSchema[]; // https://www.w3.org/TR/vc-data-model-2.0/#data-schemas
    proof?:EmbeddedProof;               // https://www.w3.org/TR/vc-data-model-2.0/#securing-mechanisms
    relatedResource?:RelatedSource|RelatedSource[]; // https://www.w3.org/TR/vc-data-model-2.0/#integrity-of-related-resources
    refreshService?:ExternalService|ExternalService[]; // https://www.w3.org/TR/vc-data-model-2.0/#refreshing
    termsOfUse?:ExternalService|ExternalService[]; // https://www.w3.org/TR/vc-data-model-2.0/#terms-of-use
    evidence?:ExternalService|ExternalService[]; // https://www.w3.org/TR/vc-data-model-2.0/#evidence
}

export interface W3CJWT {
    vc: W3C;
}

export interface W3C {
    "@context": string[];               // https://www.w3.org/TR/vc-data-model/#contexts
    id?:string;                         // https://www.w3.org/TR/vc-data-model/#identifiers
    type: string[];                     // https://www.w3.org/TR/vc-data-model/#types
    name?:string;                       // commonly used, but not specced
    description?:string;                // commonly used, but not specced
    issuer: string|IssuerObject;        // https://www.w3.org/TR/vc-data-model/#issuer
    credentialSubject: ClaimSet;        // https://www.w3.org/TR/vc-data-model/#credential-subject
    issuanceDate?:string;               // https://www.w3.org/TR/vc-data-model/#issuance-date
    expirationDate?:string;             // https://www.w3.org/TR/vc-data-model/#expiration
    credentialStatus?:ExternalService|ExternalService[]; // https://www.w3.org/TR/vc-data-model/#status
    credentialSchema?:CredentialSchema|CredentialSchema[]; // https://www.w3.org/TR/vc-data-model/#data-schemas
    proof?:EmbeddedProof;                              // https://www.w3.org/TR/vc-data-model/#proofs-signatures
    refreshService?:ExternalService|ExternalService[]; // https://www.w3.org/TR/vc-data-model/#refreshing
    termsOfUse?:ExternalService|ExternalService[];     // https://www.w3.org/TR/vc-data-model/#terms-of-use
    evidence?:ExternalService|ExternalService[];       // https://www.w3.org/TR/vc-data-model/#evidence
}
