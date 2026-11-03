import Debug from 'debug';
const debug = Debug('issuer:api');
import { Request, Response } from 'express'
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Issuer } from '#root/issuer/Issuer';
import { CredentialOfferStatus, ErrorCodes } from '#root/types/api';
import { validateDeferredRequest } from '#root/issuer/api/validateDeferredRequest';
import { issueCredential } from '#root/issuer/api/issueCredential';
import { DeferredSessionData } from '#root/types/internal';
import { DPoPNonceRequiredError, issueDpopNonce } from '#root/issuer/lib/validateDPoPProof';
import { sendDpopNonceResponse } from '#root/server/sendDpopNonceResponse';
import { deferredEndpointRateLimiter } from '#root/server/rateLimiters';
import { sanitizeErrorDescription } from '#root/utils/sanitizeErrorDescription';

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-deferred-credential-endpoint
export function getDeferredCredential(issuer:Issuer, path:string)
{
    issuer.router!.use(path, deferredEndpointRateLimiter);
    issuer.router!.post(
        path,
        async (request: Request, response: Response) => {
            try {
                const error = await validateDeferredRequest(issuer, request);
                if (error.error != ErrorCodes.NO_ERROR) {
                    return sendErrorResponse(response, 400, { error: error.error, description: error.description });
                }
                const { session } = error.data;
                const deferred:DeferredSessionData = error.data.deferred;
                await issuer.storeRequestResponseData(session.uuid, "deferred-request", request.body);

                if ((session.data as any)?.accessData?.cnf?.jkt) {
                    // RFC 9449 §9: rotate the nonce on every response
                    response.set('DPoP-Nonce', await issueDpopNonce(issuer));
                }

                switch (deferred.status) {
                    case CredentialOfferStatus.CREDENTIAL_PENDING:
                        // not ready yet: tell the wallet to come back later
                        response.set('Cache-Control', 'no-store');
                        return response.status(202).json({
                            transaction_id: deferred.transactionId,
                            interval: deferred.interval,
                        });

                    case CredentialOfferStatus.CREDENTIAL_DENIED:
                        // the wallet should stop requesting this transaction
                        return sendErrorResponse(response, 400, {
                            error: ErrorCodes.CREDENTIAL_REQUEST_DENIED,
                            ...(deferred.reason && {error_description: sanitizeErrorDescription(deferred.reason)}),
                        });

                    case CredentialOfferStatus.CREDENTIAL_READY:
                        break;

                    default:
                        debug("deferred transaction has an unexpected status", deferred.status);
                        return sendErrorResponse(response, 400, { error: ErrorCodes.INVALID_TRANSACTION_ID });
                }

                let credentialResponse;
                try {
                    credentialResponse = await issueCredential(issuer, {
                        session,
                        credentialDataSet: deferred.credentialDataSet,
                        proofResults: deferred.holders.map((holder) => ({ nonce: '', holder })),
                    }, deferred);
                }
                catch (e) {
                    return sendErrorResponse(response, 400, {
                            error: ErrorCodes.CREDENTIAL_REQUEST_DENIED,
                            error_description: sanitizeErrorDescription((e as Error).message),
                        },
                        e
                    );
                }
                await issuer.storeRequestResponseData(session.uuid, "deferred-response", credentialResponse);
                return response.json(credentialResponse);
            }
            catch (e) {
                if (e instanceof DPoPNonceRequiredError) {
                    return sendDpopNonceResponse(response, 401, e.nonce);
                }
                // never reflect the raw exception message back to the caller
                return sendErrorResponse(response, 500, {
                        error: ErrorCodes.INTERNAL_ERROR,
                        error_description: "Internal server error",
                    },
                    e
                );
            }
        }
    );
}
