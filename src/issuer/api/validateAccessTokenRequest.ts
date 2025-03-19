import { Issuer } from "issuer/Issuer";
import { PRE_AUTHORIZED_CODE } from "types/specification";
import { ErrorCodes } from "types/api";
import { ApiState } from "types/internal";
import { GrantTypes, TokenRequest } from "types/specification/access_token";
import { SessionState } from "utils/SessionStateManager";

export function validateAccessTokenRequest(issuer:Issuer, tokenRequest:TokenRequest): ApiState {
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    let stateid = tokenRequest[PRE_AUTHORIZED_CODE] as string;

    if (tokenRequest.grant_type !== GrantTypes.PRE_AUTHORIZED_CODE) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Only pre-authorized grant type supported";
        return error;
    }

    if (!stateid) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }

    const sessionId = issuer.authorizationState.has(stateid) ? issuer.authorizationState.get(stateid) : '';
    const session = issuer.getSessionById(sessionId);
    if (!session) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }
    if (!validateTokenExpiry(session)) {
      error.error = ErrorCodes.EXPIRED;
      error.description = "Session expired, please try again";
      return error;
    }

    const grants = session.credentialOffer?.credential_offer?.grants;
    if (!grants || !grants[tokenRequest.grant_type]) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid grant type";
        return error;
    }
    const txCode = tokenRequest.tx_code || tokenRequest.user_pin;
    if (txCode && !session.pinCode) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Pin code received, but none requested";
        return error;
    }
    else if (!txCode && session.pinCode) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Pin code required, but none received";
        return error;
    }
    else if (txCode && session.pinCode) {
        if (txCode !== session.pinCode) {
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Pin code does not match";
            return error;
        }
    }

    error.data = {
      session      
    };
    return error;
}


function validateTokenExpiry(session:SessionState)
{
    return (Date.now() > session.expires);
}