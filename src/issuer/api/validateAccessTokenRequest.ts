import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from "issuer/Issuer";
import { PRE_AUTHORIZED_CODE } from "types/specification/credential_offer";
import { ErrorCodes } from "types/api";
import { ApiState } from "types/internal";
import { GrantTypes, TokenRequest } from "types/specification/access_token";
import { SessionState } from "utils/SessionStateManager";

export function validateAccessTokenRequest(issuer:Issuer, tokenRequest:TokenRequest): ApiState {
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

    const sessionId = issuer.authorizationState.has(stateid) ? issuer.authorizationState.get(stateid) : '';
    const session = issuer.getSessionById(sessionId);
    if (!session) {
        debug("invalid because the code does not match to a session", stateid, sessionId);
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

    const grants = session.credentialOffer?.grants;
    if (!grants || !grants[tokenRequest.grant_type]) {
        debug("invalid because the requested grant does not exist on the credential offer grants");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid grant type";
        return error;
    }
    const txCode = tokenRequest.tx_code || tokenRequest.user_pin;
    if (txCode && !session.pinCode) {
        debug("invalid because we received a pin code but did not request one", txCode);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Pin code received, but none requested";
        return error;
    }
    else if (!txCode && session.pinCode) {
        debug("invalid because we expected a pin code but did not receive one");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Pin code required, but none received";
        return error;
    }
    else if (txCode && session.pinCode) {
        if (txCode !== session.pinCode) {
            debug("invalid because pin codes do not match", txCode, session.pinCode);
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

function sessionHasExpired(session:SessionState)
{
    return (Date.now() > session.expires);
}