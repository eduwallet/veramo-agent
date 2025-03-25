import { Request } from 'express'
import { Issuer } from 'issuer/Issuer';
import { CredentialOfferStatus, ErrorCodes } from 'types/api';
import { ApiState } from 'types/internal';

export function validateGetCredentialOffer(issuer:Issuer, request:Request)
{
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    const { id } = request.params;
    const session = issuer.getSessionById(id);
    if (!session) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }
    
    if ([CredentialOfferStatus.ERROR, CredentialOfferStatus.CREDENTIAL_ISSUED].includes(session.status)) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Credential offer status has expired";
        return error;
    }

    if (!session.credentialOffer || !session.credentialOffer.grants) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No credential offer found";
        return error;
    }

    error.data = { session };
    return error;
}