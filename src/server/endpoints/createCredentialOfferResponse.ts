import { Request, Response } from 'express'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from 'utils/determinePath';
import { Issuer } from 'issuer/Issuer'
import passport from 'passport';
import { openObserverLog } from 'utils/openObserverLog';
import { CreateCredentialOfferResponse, CreateCredentialOfferRequest, ErrorCodes } from 'types/api';
import { validateCreateCredentialOffer } from 'issuer/api/validateCreateCredentialOffer';
import { createCredentialOffer } from 'issuer/api/createCredentialOffer';

export function createCredentialOfferResponse(issuer: Issuer, createOfferPath: string, offerPath: string) {
    const path = determinePath(issuer.options.baseUrl, createOfferPath, { stripBasePath: true })
    const getOfferPath = determinePath(issuer.options.baseUrl, offerPath, { stripBasePath: true });
    issuer.router!.post(path,
        passport.authenticate(issuer.name + '-admin', { session: false }),
        async (request: Request<CreateCredentialOfferRequest>, response: Response<CreateCredentialOfferResponse>) => {
        try {
            const error = validateCreateCredentialOffer(issuer, request.body);

            if (error.error != ErrorCodes.NO_ERROR) {
                return sendErrorResponse(response, 400, { error: error.error, description: error.description });
            }
            const credentialOfferData = createCredentialOffer(issuer, request.body);
            await openObserverLog(credentialOfferData.id, "createoffer-request", request.body);
            await issuer.storeRequestResponseData(credentialOfferData.id, 'create_offer-request', request.body);

            const resultResponse: CreateCredentialOfferResponse = {
                uri: 'openid-credential-offer://?credential_offer_uri=' + issuer.options.baseUrl + getOfferPath + '/' + credentialOfferData.id,
                txCode: credentialOfferData.pinCode,
                id: credentialOfferData.id
            }
            await openObserverLog(credentialOfferData.id, "createoffer-response", resultResponse);
            await issuer.storeRequestResponseData(credentialOfferData.id, 'create_offer-response', resultResponse);
            return response.json(resultResponse);
        } 
        catch (e) {
            return sendErrorResponse(response, 500, {
                error: ErrorCodes.INTERNAL_ERROR,
                error_description: (e as Error).message,
              },
              e,
            );
        }
    });
}
  
