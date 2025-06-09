import Debug from 'debug';
const debug = Debug('issuer:api');
import { Request } from 'express'
import { Issuer } from 'issuer/Issuer.js';
import { CredentialOfferStatus, ErrorCodes } from 'types/api.js';
import { ApiState } from 'types/internal.js';

export function validateGetCredentialOffer(issuer:Issuer, request:Request)
{
    debug("validating get-credential-offer", request.params);
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    const { id } = request.params;
    const session = issuer.getSessionById(id);
    if (!session) {
        debug("invalid because session not found", id);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }
    
    if ([CredentialOfferStatus.ERROR, CredentialOfferStatus.CREDENTIAL_ISSUED].includes(session.status)) {
        debug("invalid because session status is incorrect", session.status);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Credential offer status has expired";
        return error;
    }

    if (!session.credentialOffer || !session.credentialOffer.grants) {
        debug("error because no credential offer found", session.credentialOffer);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No credential offer found";
        return error;
    }

    debug("getCredentialOffer validated");
    error.data = { session };
    return error;
}