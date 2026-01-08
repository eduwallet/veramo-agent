import { CredentialConfigurationClaimData, CredentialFormat, Metadata, SupportedProofTypes } from "#root/types/specification/metadata";

export interface MetadataConfiguration extends Omit<Metadata, 'credential_configurations_supported'> {
    "@context"?: string[];
    credential_configurations_supported:ExtendableCredentialConfigurations;
}

export interface ExtendableCredentialConfigurations {
    [key:string]: ExtendableCredentialConfiguration;
}

export interface ExtendableCredentialConfiguration extends CredentialConfigurationJwtVC {
    extends?:string;
    vct?:string;
}

export interface CredentialConfigurationJwtVC {
    format: CredentialFormat;
    scope?:string;                                     // optional scope used in the OAuth process
    cryptographic_binding_methods_supported?:string[]; // cryptographic key material representations supported
    credential_signing_alg_values_supported?:string[]; // array of signing algorithms implemented
    proof_types_supported?:SupportedProofTypes;
    display?:CredentialDisplay[];                      // array of display properties for this credential
    credential_definition: CredentialDefinition;
}

export interface CredentialDefinition {
    type:string[];
    credentialSubject?:CredentialSubjects;
    claims?:CredentialConfigurationClaimData[]; // new style definitions
}

// TODO: support nested claims... or move to path descriptions
export interface CredentialSubjects {
    [x:string]:CredentialSubjectConfiguration;
}

export interface CredentialSubjectConfiguration {
    mandatory?:boolean;
    value_type?:string;
    display?:CredentialDisplay[];
}

export interface CredentialDisplay {
    name?:string;
    locale?:string;
}