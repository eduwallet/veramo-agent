import { CredentialIssuerMetadataOpts, CredentialSupportedJwtVcJson } from '@sphereon/oid4vci-common'

export function findCredentialDefinitionInMetadata(metadata:CredentialIssuerMetadataOpts, credentialName:string): CredentialSupportedJwtVcJson
{
    var retval = {
        format: 'jwt_vc_json',
        types: ['VerifiableCredential'],
    };
    // this library lists the credentials as a list of objects
    // version 13 changed this to a name indexed object
    metadata.credentials_supported.forEach((v:any) => {
        // in all version, the credential id is inside the credential configuration
        if (v.id == credentialName) {
            retval = v;
        }
    });
    return retval as CredentialSupportedJwtVcJson;
}