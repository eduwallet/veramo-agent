/*
 * Credential Issuer metadata
 *
 * https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-credential-issuer-metadata
 * https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#section-12.2.4
 */
export interface Metadata {
    credential_issuer: string;                 // https URI without fragments or query
    authorization_servers?: string[];          // list of OAuth 2.0 authorization servers
    credential_endpoint: string;               // URL of the issuer credential endpoint
    nonce_endpoint?: string;                   // optional URL of the nonce endpoint
    batch_credential_endpoint?:string;         // URL of the issuer batch credential endpoint
    deferred_credential_endpoint?:string;      // URL of the issuer deferred credential endpoint 
    notification_endpoint?:string;             // URL of the issuer notification endpoint
    credential_request_encryption?:any;
    credential_response_encryption?:CredentialResponseEncryptionOptions;
    credential_identifiers_supported?:boolean; // if true, the credential_identifiers parameter is used in authorization_details
    signed_metadata?:string;                   // signed JWT containing metadata as claims
    display?:CredentialIssuerDisplay[];
    credential_configurations_supported:CredentialConfigurations;
}

export interface CredentialResponseEncryptionOptions {
    alg_values_supported:string[];        // list of JWE encryption algorithms (alg) supported
    enc_values_supported:string[];        // list of JWE encryption algorithms (enc) supported
    encryption_required:boolean;          // if true, the wallet MUST provide encryption keys in the request
}

export interface CredentialIssuerDisplay {
    name?:string;                         // credential issuer name
    description?:string;                  // not mentioned in the specification
    locale?:string;                       // language identification following RFC5646
    logo?:CredentialIssuerLogo;
}

export interface CredentialIssuerLogo {
    uri:string;                           // URI referencing the Credential issuer logo
    alt_text?:string;                     // alternative image text
    url?:string;                          // backwards compatibility attribute
}

export interface CredentialConfigurations {
    [x:string]: CredentialConfiguration;
}

export type CredentialConfiguration = CredentialConfigurationCommon & 
    (CredentialConfigurationJwtVC | CredentialConfigurationLdpVC | CredentialConfigurationIsoMdl | CredentialConfigurationSdJwt);
export type CredentialConfigurationSD = CredentialConfigurationCommon & CredentialConfigurationSdJwt;
export type CredentialConfigurationVCDM = CredentialConfigurationCommon & CredentialConfigurationJwtVC;

export type CredentialFormat = 'jwt_vc_json' | 'jwt_vc_json-ld' | 'vc+sd-jwt' | 'dc+sd-jwt' | 'ldp_vc' | 'vc+jwt';

export interface CredentialConfigurationCommon {
    format: CredentialFormat;
    scope?:string;                                     // optional scope used in the OAuth process
    cryptographic_binding_methods_supported?:string[]; // cryptographic key material representations supported
    credential_signing_alg_values_supported?:string[]; // array of signing algorithms implemented
    proof_types_supported?:SupportedProofTypes;
    credential_metadata?: CredentialConfigurationMetadata;
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-A.1.1.2
export interface CredentialConfigurationJwtVC {
    credential_definition: CredentialDefinition;
}

export interface CredentialDefinition {
    type: string[];
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-A.1.2.2
export interface CredentialConfigurationLdpVC extends CredentialConfigurationJwtVC {
    "@context":string[];
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-A.2.2
export interface CredentialConfigurationIsoMdl {
    doctype: string;
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-A.3.2
export interface CredentialConfigurationSdJwt {
    vct: string;
}

export interface CredentialConfigurationMetadata {
    display?: CredentialDisplay[];
    claims?: CredentialConfigurationClaimData[];
};

export interface CredentialConfigurationDisplay {
    name?:string;
    locale?:string;
}

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#appendix-B.2
export interface CredentialConfigurationClaimData {
    path: string[];
    mandatory?:boolean;
    display?: CredentialConfigurationDisplay[];
}

export type SupportedProofTypes = Partial<Record<"jwt" | "cbor" | "alg", SupportedProofType>>;

export interface SupportedProofType {
    proof_signing_alg_values_supported:string[];       // list of algorithms supported for a proof type
}

export interface CredentialDisplay {
    name?:string;                         // credential issuer name
    locale?:string;                       // language identification following RFC5646
    logo?:CredentialIssuerLogo;
    description?:string;
    background_color?:string;
    text_color?:string;
    background_image?:CredentialImage;
}

export interface CredentialImage {
    uri:string;
    url?:string;                          // backwards compatibility value
}
