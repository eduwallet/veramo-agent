import { IssuerMetadataV1_0_13, CredentialConfigurationSupportedJwtVcJsonV1_0_13 } from '@sphereon/oid4vci-common'

export function findCredentialDefinitionInMetadata(metadata:IssuerMetadataV1_0_13, credentialName:string): CredentialConfigurationSupportedJwtVcJsonV1_0_13
{
    var retval = {
        format: 'jwt_vc_json',
        credential_definition: {
            type: ['VerifiableCredential']
        }
    };
    // this library lists the credentials as a list of objects
    // version 13 changed this to a name indexed object
    if (metadata.credential_configurations_supported[credentialName]) {
        retval = metadata.credential_configurations_supported[credentialName] as CredentialConfigurationSupportedJwtVcJsonV1_0_13;
    }
    return retval as CredentialConfigurationSupportedJwtVcJsonV1_0_13;
}