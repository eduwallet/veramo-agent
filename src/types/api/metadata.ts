import { Metadata } from "types/specification";
import { CredentialConfigurationJwtVC } from "types/specification/metadata";

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
