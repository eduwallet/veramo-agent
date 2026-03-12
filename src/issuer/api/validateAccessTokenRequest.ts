import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from "issuer/Issuer.js";
import { PRE_AUTHORIZED_CODE } from "types/specification/credential_offer.js";
import { ErrorCodes } from "types/api.js";
import { ApiState } from "types/internal.js";
import { GrantTypes, TokenRequest } from "types/specification/access_token.js";
import { Session } from '#root/database/entities/index';

export async function validateAccessTokenRequest(issuer:Issuer, tokenRequest:TokenRequest): Promise<ApiState> {
    debug("validating access token request", tokenRequest);
    const error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    // this method only handles access token requests for pre-authorized code flows. In authorization code flows,
    // the Authorization Server will handle the access token request and this endpoint is skipped.
    const stateid = tokenRequest[PRE_AUTHORIZED_CODE] as string;

    // spec ID-1: 6.1: pre-authorized_code: The code representing the authorization to obtain Credentials of a certain type.
    // This parameter MUST be present if the grant_type is urn:ietf:params:oauth:grant-type:pre-authorized_code.

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

    // spec ID-1: 6.1: tx_code: OPTIONAL. String value containing a Transaction Code value itself. This value MUST be present
    // if a tx_code object was present in the Credential Offer
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
        // if we happen to pass a number for a pin that starts with a '0', this may fail
        // ergo -> do not pass numbers, pass strings
        if (txCode.toString() != session.data.pinCode.toString()) {
            debug("invalid because pin codes do not match", txCode, session.data.pinCode);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Pin code does not match";
            return error;
        }
    }

    // spec ID-1: 6.1.1 Credential Issuers MAY support requesting authorization to issue a Credential using the authorization_details
    // parameter. This is particularly useful if the Credential Issuer offered multiple Credential Configurations in the Credential
    // Offer of a Pre-Authorized Code Flow.
    const authDetails = tokenRequest.authorization_details || [];
    if (authDetails && Array.isArray(authDetails) && authDetails.length > 0) {
        debug("authorization details present in token request", authDetails);
        for (const details of authDetails) {
            if (details.type == 'openid_credential') {
                if (details.credential_configuration_id) {
                    // TODO: update this when we want to support multiple credential issuance
                    // What we need to do is gather all the credential_configuration_ids, check that
                    // they are in the list of ids as indicated in the original offer and mark only
                    // these ids as being valid for the session
                    if (details.credential_configuration_id !== session.data.credentialId) {
                        error.error = ErrorCodes.INVALID_REQUEST;
                        error.description = "Wallet requests unavailable credential id";
                        return error;
                    }
                }
            }
        }
    }
    // else disregard the authorization_details

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