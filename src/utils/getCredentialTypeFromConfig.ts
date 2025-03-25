
import { CredentialConfiguration, CredentialConfigurationJwtVC, CredentialConfigurationLdpVC } from "types/specification/metadata";

export function getCredentialTypeFromConfig(config:CredentialConfiguration): string
{
    let type:string = '';
    switch ((config.format) as string) {
        case 'jwt_vc_json':
        case 'jwt_vc':
            const jwtcfg = (config as CredentialConfigurationJwtVC);
            const types = jwtcfg.credential_definition.type.filter((i) => i != 'VerifiableCredential');
            if (types.length > 0) {
                type = types[0];
            }
            break;
        case 'ldp_vc':
        case 'jwt_vc_json-ld':
            const ldpcfg = (config as CredentialConfigurationLdpVC);
            const ldtypes = ldpcfg.credential_definition.type.filter((i) => i != 'VerifiableCredential');
            if (ldtypes.length > 0) {
                type = ldtypes[0];
            }
            break;
        case 'vc+sd-jwt':
        case 'dc+sd-jwt': // fall through
            // used to be sdcfg.vct, but the vct attribute is a uri and we want a credential type
            if (config.scope) {
                type = config.scope;
            }
            break;        
    }
    return type;
}