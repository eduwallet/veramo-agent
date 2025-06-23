import Debug from 'debug';
const debug = Debug('issuer:endpoints');
import { Request, Response } from 'express'
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Issuer } from '#root/issuer/Issuer';
import { openObserverLog } from '#root/utils/openObserverLog';
import { validateGetCredentialOffer } from '#root/issuer/api/validateGetCredentialOffer';
import { CredentialOfferStatus, ErrorCodes } from '#root/types/api';

export function getCredentialOffer(issuer:Issuer, getPath:string) {
    issuer.router!.get(getPath, async (request: Request, response: Response) => {
        try {
            const error = validateGetCredentialOffer(issuer, request);
            if (error.error != ErrorCodes.NO_ERROR) {
                return sendErrorResponse(response, 400, { error: error.error, description: error.description });
            }

            // validation succeeded, so we MUST have a session
            const session = error.data.session!;
            await openObserverLog(session.id, "credentialoffer-request", request.params);
            issuer.storeRequestResponseData(session.id, "credential_offer-request", request.params);

            session.status = CredentialOfferStatus.OFFER_URI_RETRIEVED;
            session.lastUpdatedAt = +new Date()
            issuer.storeSession(session);

            await openObserverLog(session.id, "credentialoffer-response", session.credentialOffer.credential_offer);
            issuer.storeRequestResponseData(session.id, "credential_offer-response", session.credentialOffer.credential_offer);
            debug("returning ", session.credentialOffer);
            return response.json(session.credentialOffer);
        }
        catch (e) {
            return sendErrorResponse(response, 500, {
                    error: ErrorCodes.INTERNAL_ERROR,
                    error_description: (e as Error).message,
                },
                e
            );
        }
    });
}