import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from '#root/issuer/Issuer';
import { ErrorCodes } from '#root/types/api';
import { CreateCredentialOfferRequestV2 } from '#root/types/api/credentialOffer';
import { ApiState } from '#root/types/internal';
import { PRE_AUTHORIZED_CODE, AUTHORIZATION_CODE_GRANT } from '#root/types/specification/credential_offer';
import { isValidCallbackUrl } from '#root/issuer/lib/isValidCallbackUrl';
import { claimsToData, isValidClaim } from '#root/issuer/lib/claimsToData';

function invalid(description:string):ApiState
{
    debug("invalid createCredentialOffer: " + description);
    return { error: ErrorCodes.INVALID_REQUEST, description };
}

export function validateCreateCredentialOfferV2(issuer:Issuer, request:CreateCredentialOfferRequestV2):ApiState
{
    debug("validating createCredentialOffer v2", request);

    if (!request || typeof(request) != 'object') {
        return invalid("Missing request");
    }
    if (request.grant !== PRE_AUTHORIZED_CODE && request.grant !== AUTHORIZATION_CODE_GRANT) {
        return invalid("Invalid or missing grant");
    }

    if (request.tx_code !== undefined) {
        if (request.grant !== PRE_AUTHORIZED_CODE) {
            return invalid("A transaction code requires the pre-authorized_code grant");
        }
        const tx = request.tx_code;
        if (tx === null || typeof(tx) != 'object' || Array.isArray(tx)) {
            return invalid("Invalid transaction code");
        }
        if (typeof(tx.description) != 'string' || tx.description.trim() === '') {
            return invalid("Transaction code requires a description");
        }
        if (tx.input_mode !== undefined && tx.input_mode !== 'numeric' && tx.input_mode !== 'text') {
            return invalid("Invalid transaction code input_mode");
        }
        if (tx.length !== undefined && (!Number.isInteger(tx.length) || tx.length < 1 || tx.length > 32)) {
            return invalid("Invalid transaction code length");
        }
    }

    if (!Array.isArray(request.credentials) || request.credentials.length === 0) {
        return invalid("Missing credentials list");
    }

    for (const credential of request.credentials) {
        const id = credential?.credential_configuration_id;
        if (!id || typeof(id) != 'string' || !issuer.hasCredentialConfiguration(id)) {
            return invalid("Credential type not supported");
        }
        if (credential.claims !== undefined && (!Array.isArray(credential.claims) || !credential.claims.every(isValidClaim))) {
            return invalid("Invalid claims for credential " + id);
        }

        if (credential.credential_callback !== undefined && !isValidCallbackUrl(credential.credential_callback)) {
            return invalid("Invalid credential_callback for credential " + id + ": it must be an http(s) URL");
        }

        // for the pre-authorized code flow, the proper credential data should be present. For deferred
        // credentials the claims can be incomplete: the back-office supplies the remaining claims.
        if (request.grant === PRE_AUTHORIZED_CODE && !issuer.getDeferredSettings(id) && !issuer.checkCredentialData(id, claimsToData(credential.claims ?? []))) {
            return invalid("Missing required claims for credential " + id);
        }
    }

    debug("create credential offer v2 is valid");
    return { error: ErrorCodes.NO_ERROR, description: '' };
}
