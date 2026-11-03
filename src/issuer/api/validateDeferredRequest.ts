import Debug from 'debug';
const debug = Debug('issuer:api');
import { Request } from 'express'
import { Issuer } from '#root/issuer/Issuer';
import { ErrorCodes } from '#root/types/api';
import { ApiState, DeferredSessionData } from '#root/types/internal';
import { Session } from '#root/database/entities/index';
import { extractBearerToken } from '#root/issuer/api/validateCredentialRequest';
import { verifyAccessTokenJWT } from '#root/issuer/lib/verifyAccessTokenJWT';
import { DPoPNonceRequiredError, validateDPoPProof } from '#root/issuer/lib/validateDPoPProof';
import { sessionUsesAuthorisationCodeFlow } from '#root/utils/sessionUsesAuthorisationCodeFlow';
import { CredentialOfferStatus } from '#root/types/api';

/**
 * Validate a request to the deferred endpoint.
 *
 * The access token is validated like on the credential endpoint. The access data of the session is
 * not updated: it was stored when the credential was requested.
 *
 * On success, the data of the returned state contains the session and its deferred transaction.
 */
export async function validateDeferredRequest(issuer:Issuer, request:Request): Promise<ApiState>
{
    debug("validating deferred request", request.body);
    const error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};

    const jwt = extractBearerToken(request.header('Authorization'));
    if (!jwt) {
        debug("invalid because the bearer/DPoP token is not present");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Unauthorized";
        return error;
    }

    let session:Session|null = null;
    let tokenPayload:any = null;
    try {
        const data = await verifyAccessTokenJWT(jwt, issuer);
        tokenPayload = data?.payload;
        session = await issuer.getSessionByState(tokenPayload?.issuer_state);

        const usesAuthorisationCodeFlow = session ? sessionUsesAuthorisationCodeFlow(session) : issuer.usesAuthorisedCodeFlow();
        if (usesAuthorisationCodeFlow) {
            if (issuer.options?.authorizationEndpoint !== tokenPayload?.iss) {
                debug("invalid because the access token issuer is not in our AS list", tokenPayload?.iss);
                error.error = ErrorCodes.INVALID_REQUEST;
                error.description = "Unauthorised";
                return error;
            }
        }
        else if (tokenPayload?.iss != issuer.did?.did) {
            debug("invalid because the token issuer is not our did", tokenPayload?.iss);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Unauthorised";
            return error;
        }
    }
    catch (e) {
        debug("caught error on access token validation", e);
        console.error("Caught exception on validating access token", e);
    }

    if (!session) {
        debug("invalid because session could not be found");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }

    // https://www.rfc-editor.org/rfc/rfc9449: see validateCredentialRequest
    const jkt = tokenPayload?.cnf?.jkt;
    if (!sessionUsesAuthorisationCodeFlow(session) && jkt) {
        try {
            const result = await validateDPoPProof(issuer, request.header('DPoP'), 'POST', issuer.options.baseUrl + '/deferred', jwt);
            if (!result || result.jkt !== jkt) {
                throw new Error("DPoP proof key does not match access token");
            }
        }
        catch (e) {
            if (e instanceof DPoPNonceRequiredError) {
                throw e;
            }
            debug("invalid because the DPoP proof could not be validated", e);
            error.error = ErrorCodes.INVALID_DPOP_PROOF;
            error.description = (e as Error).message;
            return error;
        }
    }

    const transactionId = request.body?.transaction_id;
    if (!transactionId || typeof(transactionId) != 'string') {
        debug("invalid because the transaction_id is missing");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Missing transaction_id";
        return error;
    }

    const deferred = session.data?.deferred as DeferredSessionData|undefined;
    if (!deferred
        || deferred.transactionId !== transactionId
        // the transaction_id is invalid once the credential has been collected
        || deferred.status == CredentialOfferStatus.CREDENTIAL_ISSUED
        || +new Date() > deferred.expiresAt
    ) {
        debug("invalid because the transaction is unknown, completed or expired");
        error.error = ErrorCodes.INVALID_TRANSACTION_ID;
        error.description = "Invalid transaction_id";
        return error;
    }

    error.data = { session, deferred };
    debug("deferred request is valid");
    return error;
}
