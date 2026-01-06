import { Request, Response } from 'express'
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Issuer } from '#root/issuer/Issuer'
import passport from 'passport';
import { CreateCredentialOfferResponse, CreateCredentialOfferRequest } from '#root/types/api/credentialOffer';
import { validateCreateCredentialOffer } from '#root/issuer/api/validateCreateCredentialOffer';
import { createCredentialOffer } from '#root/issuer/api/createCredentialOffer';
import { ErrorCodes } from '#root/types/api';

export function createCredentialOfferResponse(issuer: Issuer, createOfferPath: string, offerPath: string) {
    issuer.router!.post(createOfferPath,
        passport.authenticate(issuer.name + '-admin', { session: false }),
        async (request: Request<CreateCredentialOfferRequest>, response: Response<CreateCredentialOfferResponse>) => {
        try {
            const error = validateCreateCredentialOffer(issuer, request.body);

            if (error.error != ErrorCodes.NO_ERROR) {
                return sendErrorResponse(response, 400, { error: error.error, description: error.description });
            }
            const credentialOfferData = await createCredentialOffer(issuer, request.body);
            await issuer.storeRequestResponseData(credentialOfferData.id, 'create_offer-request', request.body);

            const resultResponse: CreateCredentialOfferResponse = {
                // the uri is an external URI, so preprend it with the baseUrl of the issuer
                uri: 'openid-credential-offer://?credential_offer_uri=' + issuer.options.baseUrl + offerPath + '/' + credentialOfferData.id,
                txCode: credentialOfferData.pinCode,
                id: credentialOfferData.id
            }
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
  
