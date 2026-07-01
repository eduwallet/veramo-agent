import { ExtendableCredentialConfiguration } from "#root/types/api/metadata";
import { CredentialConfiguration, CredentialConfigurationClaimData, CredentialConfigurationVCDM, CredentialFormat } from "#root/types/specification/metadata";

export function convertConfigToVCDM(credentialId:string, config:ExtendableCredentialConfiguration): CredentialConfiguration
{
    const claims = (config?.credential_definition.claims ?? []).filter((c) => (c.value_type !== 'internal'));
    const vcdm:CredentialConfigurationVCDM = {
        format: config.format,
        // skip credential_signing_algs_supported, it is added in the issuer
        // skip cryptographic_binding_methods_supported, it is added in the issuer
        // skip proof_types_supported, it is added in the issuer
        ...(config.scope && {scope: config.scope}),
        credential_definition: {
            type: config.credential_definition.type
        },
        credential_metadata: {
            ...(config.display && {display: config.display}),
            claims
        }
    }

    if (config.format == 'jwt_vc_json') {
        vcdm.credential_metadata!.claims = prependAllClaimPaths(vcdm.credential_metadata!.claims!, 'vc');
    }

    for (const key of Object.keys(config?.credential_definition?.credentialSubject ?? {})) {
        const value = config.credential_definition.credentialSubject![key];
        if (value.value_type == 'internal') {
            continue;
        }
        // at this point we only support simple claims: single path elements
        // for more complicated claims, populate the claims attribute directly
        let path = [key];
        if (config.format == 'jwt_vc_json') {
            // old skool VCDM 1.0, which puts the credential in a vc top claim
            path = ['vc', 'credentialSubject', key];
        }
        else {
            // VCDM 2 puts everything in the credentialSubject claim
            path = ['credentialSubject', key];
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

function prependAllClaimPaths(claims:CredentialConfigurationClaimData[], key:string)
{
    const retval:CredentialConfigurationClaimData[] = [];
    for (const clm of claims) {
        const claim = JSON.parse(JSON.stringify(clm)); // clone the data
        claim.path.unshift(key);
        retval.push(claim);
    }
    return retval;
}