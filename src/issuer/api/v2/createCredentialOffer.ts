import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from '#root/issuer/Issuer';
import { CreateCredentialOfferRequestV2, APIGrants } from '#root/types/api/credentialOffer';
import { CreateCredentialData } from '#root/types/internal';
import { PRE_AUTHORIZED_CODE, PRE_AUTHORIZED_CODE_GRANT, AUTHORIZATION_CODE_GRANT } from '#root/types/specification/credential_offer';
import { createCredentialOfferForDataSets } from '#root/issuer/api/createCredentialOffer';
import { claimsToData } from '#root/issuer/lib/claimsToData';

/**
 * Create an offer for multiple credentials. The request is expected to have been validated
 * by validateCreateCredentialOfferV2.
 */
export async function createCredentialOfferV2(issuer:Issuer, request:CreateCredentialOfferRequestV2):Promise<CreateCredentialData>
{
    debug("creating credential offer v2", request);
    const grants:APIGrants = {};
    if (request.grant === PRE_AUTHORIZED_CODE) {
        grants[PRE_AUTHORIZED_CODE_GRANT] = {
            [PRE_AUTHORIZED_CODE]: 'generate',
            ...(request.tx_code && {
                tx_code: {
                    input_mode: request.tx_code.input_mode ?? 'numeric',
                    length: request.tx_code.length ?? 4,
                    description: request.tx_code.description
                }
            })
        };
    }
    else {
        grants[AUTHORIZATION_CODE_GRANT] = { issuer_state: 'generate' };
    }

    return createCredentialOfferForDataSets(issuer, {
        grants,
        credentialMetadata: request.credentialMetadata,
        dataSets: request.credentials.map((credential) => ({
            credentialId: credential.credential_configuration_id,
            data: claimsToData(credential.claims ?? []),
            credential: credential.credential,
            callback: credential.credential_callback
        }))
    });
}
