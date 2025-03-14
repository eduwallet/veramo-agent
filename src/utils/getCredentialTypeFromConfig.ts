import { CredentialConfigurationSupportedJwtVcJsonLdAndLdpVcV1_0_13, CredentialConfigurationSupportedJwtVcJsonV1_0_13, CredentialConfigurationSupportedSdJwtVcV1_0_13, CredentialConfigurationSupportedV1_0_13 } from "@sphereon/oid4vci-common";

export function getCredentialTypeFromConfig(config:CredentialConfigurationSupportedV1_0_13): string
{
    let type:string;
    switch (config.format) {
        case 'jwt_vc_json':
        case 'jwt_vc':
            const jwtcfg = (config as CredentialConfigurationSupportedJwtVcJsonV1_0_13);
            const types = jwtcfg.credential_definition.type.filter((i) => i != 'VerifiableCredential');
            if (types.length > 0) {
                type = types[0];
            }
            break;
        case 'ldp_vc':
        case 'jwt_vc_json-ld':
            const ldpcfg = (config as CredentialConfigurationSupportedJwtVcJsonLdAndLdpVcV1_0_13);
            const ldtypes = ldpcfg.credential_definition.type.filter((i) => i != 'VerifiableCredential');
            if (ldtypes.length > 0) {
                type = ldtypes[0];
            }
            break;
        case 'vc+sd-jwt':
        case 'dc+sd-jwt': // fall through
            const sdcfg = (config as CredentialConfigurationSupportedSdJwtVcV1_0_13);
            // used to be sdcfg.vct, but the vct attribute is a uri and we want a credential type
            if (sdcfg.scope) {
                type = sdcfg.scope;
            }
            break;        
    }
    return type;
}