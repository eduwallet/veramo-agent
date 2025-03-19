import { Request, Response } from 'express'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from 'utils/determinePath';
import { Issuer } from 'issuer/Issuer';
import { IssueStatus } from '@sphereon/oid4vci-common'
import { openObserverLog } from 'utils/openObserverLog';
import { validateGetCredentialOffer } from 'issuer/api/validateGetCredentialOffer';
import { ErrorCodes } from 'types/api';

export function getCredentialOffer(issuer:Issuer, getPath:string) {
    const path = determinePath(issuer.options.baseUrl, getPath, { stripBasePath: true })
    issuer.router!.get(path, async (request: Request, response: Response) => {
        try {
            const error = validateGetCredentialOffer(issuer, request);
            if (error.error != ErrorCodes.NO_ERROR) {
                return sendErrorResponse(response, 400, { error: error.error, description: error.description });
            }

            // validation succeeded, so we MUST have a session
            const session = error.data.session!;
            await openObserverLog(session.id, "credentialoffer-request", request.params);
            issuer.storeRequestResponseData(session.id, "credential_offer-request", request.params);

            session.status = IssueStatus.OFFER_URI_RETRIEVED;
            session.lastUpdatedAt = +new Date()
            issuer.storeSession(session);

            await openObserverLog(session.id, "credentialoffer-response", session.credentialOffer.credential_offer);
            issuer.storeRequestResponseData(session.id, "credential_offer-response", session.credentialOffer.credential_offer);
            return response.json(session.credentialOffer.credential_offer);
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