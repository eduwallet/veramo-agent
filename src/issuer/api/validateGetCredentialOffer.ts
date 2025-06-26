import Debug from 'debug';
const debug = Debug('issuer:api');
import { Request } from 'express'
import { Issuer } from 'issuer/Issuer.js';
import { ErrorCodes } from 'types/api.js';
import { ApiState } from 'types/internal.js';

export async function validateGetCredentialOffer(issuer:Issuer, request:Request)
{
    debug("validating get-credential-offer", request.params);
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    const { id } = request.params;
    const session = await issuer.getSessionById(id);
    if (!session) {
        debug("invalid because session not found", id);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }
    
    //if ([CredentialOfferStatus.ERROR, CredentialOfferStatus.CREDENTIAL_ISSUED].includes(session.status)) {
    //    debug("invalid because session status is incorrect", session.status);
    //    error.error = ErrorCodes.INVALID_REQUEST;
    //    error.description = "Credential offer status has expired";
    //    return error;
    //}

    if (!session.data.credentialOffer || !session.data.credentialOffer.grants) {
        debug("error because no credential offer found", session.data.credentialOffer);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No credential offer found";
        return error;
    }

    debug("getCredentialOffer validated");
    error.data = { session };
    return error;
}