
// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-authorization-endpoint
export interface AuthorizationDetailCommon {
    type:string; // must be set to 'openid_credential' for this spec, but can be anything in general
    credential_configuration_id?:string;
    format?:string;
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-authorization-details
export interface AuthorizationDetailCredentialSubjectValue {
    mandatory?: boolean;
}

export interface AuthorizationDetailCredentialSubject {
    [key:string]: AuthorizationDetailCredentialSubjectValue;
}

export interface AuthorizationDetailJWTCredential {
    type?: string[]; // list of credential types supported by this credential
    credentialSubject?: AuthorizationDetailCredentialSubject;
}

export interface AuthorizationDetailJWT {
    credential_definition?: AuthorizationDetailJWTCredential;
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-authorization-details-2
export interface AuthorizationDetailsLDCredential {
    "@context"?: string[]; // must only be present if the format attribute is present in the authorization_details
    type?: string[];
    credentialSubject?:AuthorizationDetailCredentialSubject;
}

export interface AuthorizationDetailsLD {
    credential_definition?: AuthorizationDetailsLDCredential;
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-authorization-details-5
export interface AuthorizationDetailsSD {
    vct: string; // required, but it must only be present if the format attribute is present in the authorization_details
    claims?: AuthorizationDetailCredentialSubject;
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-request-issuance-of-a-certa
export type AuthorizationDetail = AuthorizationDetailCommon & AuthorizationDetailJWT & AuthorizationDetailsLD & AuthorizationDetailsSD;
