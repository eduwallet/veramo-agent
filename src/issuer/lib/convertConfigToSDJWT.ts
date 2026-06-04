import { ExtendableCredentialConfiguration } from "#root/types/api/metadata";
import { CredentialConfiguration, CredentialConfigurationClaimData, CredentialConfigurationDCSD, CredentialConfigurationVCSD } from "#root/types/specification/metadata";
import { getVctForCredentialType } from "#root/vct/Store";

export function convertConfigToDCSDJWT(credentialId:string, config:ExtendableCredentialConfiguration): CredentialConfiguration
{
    const vct = getVctForCredentialType(credentialId);
    const sdjwt:CredentialConfigurationDCSD = {
        format: config.format,
        vct: vct?.vct ?? 'unknown',
        // skip credential_signing_algs_supported, it is added in the issuer
        // skip cryptographic_binding_methods_supported, it is added in the issuer
        // skip proof_types_supported, it is added in the issuer
        ...(config.scope && {scope: config.scope}),
        credential_metadata: {
            ...(config.display && {display: config.display}),
            claims: config?.credential_definition.claims ?? []
        }
    }

    for (const key of Object.keys(config?.credential_definition?.credentialSubject ?? {})) {
        const value = config.credential_definition.credentialSubject![key];
        // at this point we only support simple claims: single path elements
        const claim:CredentialConfigurationClaimData = {
            path: [key],
            mandatory: value.mandatory ? true : false,
            ...(value.display && {display: value.display})
        };
        sdjwt.credential_metadata!.claims!.push(claim);
    }
    return sdjwt as CredentialConfiguration;
}

export function convertConfigToVCSDJWT(credentialId:string, config:ExtendableCredentialConfiguration): CredentialConfiguration
{
    const sdjwt:CredentialConfigurationVCSD = {
        format: config.format,
        credential_definition: {
            type: config.credential_definition.type
        },
        // skip credential_signing_algs_supported, it is added in the issuer
        // skip cryptographic_binding_methods_supported, it is added in the issuer
        // skip proof_types_supported, it is added in the issuer
        ...(config.scope && {scope: config.scope}),
        credential_metadata: {
            ...(config.display && {display: config.display}),
            claims: config?.credential_definition.claims ?? []
        }
    }

    for (const key of Object.keys(config?.credential_definition?.credentialSubject ?? {})) {
        const value = config.credential_definition.credentialSubject![key];
        // at this point we only support simple claims: single path elements
        const claim:CredentialConfigurationClaimData = {
            path: ['credentialSubject', key],
            mandatory: value.mandatory ? true : false,
            ...(value.display && {display: value.display})
        };
        sdjwt.credential_metadata!.claims!.push(claim);
    }
    return sdjwt as CredentialConfiguration;
}