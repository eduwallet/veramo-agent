import { CredentialConfigurationSupportedJwtVcJsonLdAndLdpVcV1_0_13, CredentialConfigurationSupportedJwtVcJsonV1_0_13, CredentialConfigurationSupportedSdJwtVcV1_0_13, CredentialConfigurationSupportedV1_0_13 } from "@sphereon/oid4vci-common";

export function getCredentialTypeFromConfig(config:CredentialConfigurationSupportedV1_0_13): string[]
{
    let types:string[] = [];
    switch (config.format) {
        case 'jwt_vc_json':
        case 'jwt_vc':
            const jwtcfg = (config as CredentialConfigurationSupportedJwtVcJsonV1_0_13);
            types = jwtcfg.credential_definition.type.filter((i) => i != 'VerifiableCredential');
            break;
        case 'ldp_vc':
        case 'jwt_vc_json-ld':
            const ldpcfg = (config as CredentialConfigurationSupportedJwtVcJsonLdAndLdpVcV1_0_13);
            types = ldpcfg.credential_definition.type.filter((i) => i != 'VerifiableCredential');
            break;
        case 'vc+sd-jwt':
        case 'dc+sd-jwt': // fall through
            const sdcfg = (config as CredentialConfigurationSupportedSdJwtVcV1_0_13);
            // used to be sdcfg.vct, but the vct attribute is a uri and we want a credential type
            types = [sdcfg.scope!];
            break;        
    }
    return types;
}