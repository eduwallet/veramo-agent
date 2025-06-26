import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from "issuer/Issuer.js";
import { PRE_AUTHORIZED_CODE } from "types/specification/credential_offer.js";
import { ErrorCodes } from "types/api.js";
import { ApiState } from "types/internal.js";
import { GrantTypes, TokenRequest } from "types/specification/access_token.js";
import { Session } from '#root/packages/datastore/entities/Session';

export async function validateAccessTokenRequest(issuer:Issuer, tokenRequest:TokenRequest): Promise<ApiState> {
    debug("validating access token request", tokenRequest);
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    let stateid = tokenRequest[PRE_AUTHORIZED_CODE] as string;

    if (tokenRequest.grant_type !== GrantTypes.PRE_AUTHORIZED_CODE) {
        debug("invalid because request grant is not pre-authorized_code");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Only pre-authorized grant type supported";
        return error;
    }

    if (!stateid) {
        debug("invalid because the pre-authorized code does not exist", stateid);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }

    const session = await issuer.getSessionByState(stateid);
    if (!session) {
        debug("invalid because the code does not match to a session", stateid);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }
    if (sessionHasExpired(session)) {
        debug("invalid because the session expired");
        issuer.removeSession(session);
        error.error = ErrorCodes.INVALID_REQUEST; // EXPIRED is not allowed according to the specs
        error.description = "Session expired, please try again";
        return error;
    }

    const grants = session.data.credentialOffer?.grants;
    if (!grants || !grants[tokenRequest.grant_type]) {
        debug("invalid because the requested grant does not exist on the credential offer grants");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid grant type";
        return error;
    }
    const txCode = tokenRequest.tx_code || tokenRequest.user_pin;
    if (txCode && !session.data.pinCode) {
        debug("invalid because we received a pin code but did not request one", txCode);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Pin code received, but none requested";
        return error;
    }
    else if (!txCode && session.data.pinCode) {
        debug("invalid because we expected a pin code but did not receive one");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Pin code required, but none received";
        return error;
    }
    else if (txCode && session.data.pinCode) {
        if (txCode !== session.data.pinCode) {
            debug("invalid because pin codes do not match", txCode, session.data.pinCode);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Pin code does not match";
            return error;
        }
    }

    error.data = {
      session      
    };
    debug("access token request is valid");
    return error;
}

function sessionHasExpired(session:Session)
{
    return ((new Date()) > session.expirationDate!);
}