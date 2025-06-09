import { Request, Response } from 'express'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { Issuer } from 'issuer/Issuer.js'
import passport from 'passport';
import { openObserverLog } from 'utils/openObserverLog.js';
import { CreateCredentialOfferResponse, CreateCredentialOfferRequest } from 'types/api/credentialOffer.js';
import { validateCreateCredentialOffer } from 'issuer/api/validateCreateCredentialOffer.js';
import { createCredentialOffer } from 'issuer/api/createCredentialOffer.js';
import { ErrorCodes } from 'types/api.js';

export function createCredentialOfferResponse(issuer: Issuer, createOfferPath: string, offerPath: string) {
    issuer.router!.post(createOfferPath,
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
                uri: 'openid-credential-offer://?credential_offer_uri=' + issuer.options.baseUrl + offerPath + '/' + credentialOfferData.id,
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
  
