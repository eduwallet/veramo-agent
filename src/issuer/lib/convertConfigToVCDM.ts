import { ExtendableCredentialConfiguration } from "#root/types/api/metadata";
import { CredentialConfiguration, CredentialConfigurationClaimData, CredentialConfigurationVCDM, CredentialFormat } from "#root/types/specification/metadata";

export function convertConfigToVCDM(credentialId:string, config:ExtendableCredentialConfiguration): CredentialConfiguration
{
    let format:CredentialFormat = 'jwt_vc_json';
    switch (config.format) {
        default:
        case 'jwt_vc_json':
        case 'vc+jwt':
            format = 'jwt_vc_json';
            break;
        case 'jwt_vc_json-ld':
        case 'ldp_vc':
            format = config.format;
            break;
    }
    const vcdm:CredentialConfigurationVCDM = {
        format,
        // skip credential_signing_algs_supported, it is added in the issuer
        // skip cryptographic_binding_methods_supported, it is added in the issuer
        // skip proof_types_supported, it is added in the issuer
        ...(config.scope && {scope: config.scope}),
        credential_definition: {
            type: config.credential_definition.type
        },
        credential_metadata: {
            ...(config.display && {display: config.display}),
            claims: []
        }
    }

    for (const key of Object.keys(config?.credential_definition?.credentialSubject ?? {})) {
        const value = config.credential_definition.credentialSubject![key];
        // at this point we only support simple claims: single path elements
        let path = [key];
        if (config.format == 'jwt_vc_json') {
            // old skool VCDM 1.0, which puts the credential in a vc top claim
            path = ['vc', 'credentialSubject', 'key'];
        }
        else {
            // VCDM 2 puts everything in the credentialSubject claim
            path = ['credentialSubject', 'key'];
        }
        const claim:CredentialConfigurationClaimData = {
            path,
            mandatory: value.mandatory ? true : false,
            ...(value.display && {display: value.display})
        };
        vcdm.credential_metadata!.claims!.push(claim);
    }
    return vcdm as CredentialConfiguration;    
}