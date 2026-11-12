import { Request, Response } from 'express'
import passport from 'passport';
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Issuer } from '#root/issuer/Issuer';
import { ErrorCodes } from '#root/types/api';
import { CreateCredentialOfferRequestV2, CreateCredentialOfferResponse } from '#root/types/api/credentialOffer';
import { validateCreateCredentialOfferV2 } from '#root/issuer/api/v2/validateCreateCredentialOffer';
import { createCredentialOfferV2 } from '#root/issuer/api/v2/createCredentialOffer';

/**
 * Back-office API (v2) to create a credential offer for one or more credentials:
 *   POST <createOfferPath>
 */
export function createCredentialOfferV2Response(issuer:Issuer, createOfferPath:string, offerPath:string)
{
    issuer.router!.post(createOfferPath,
        passport.authenticate(issuer.name + '-admin', { session: false }),
        async (request: Request<object, object, CreateCredentialOfferRequestV2>, response: Response<CreateCredentialOfferResponse>) => {
        try {
            const error = validateCreateCredentialOfferV2(issuer, request.body);
            if (error.error != ErrorCodes.NO_ERROR) {
                return sendErrorResponse(response, 400, { error: error.error, description: error.description });
            }

            const credentialOfferData = await createCredentialOfferV2(issuer, request.body);
            await issuer.storeRequestResponseData(credentialOfferData.id, 'create_offer-request', request.body);

            const resultResponse: CreateCredentialOfferResponse = {
                // the uri is an external URI, so prepend it with the baseUrl of the issuer
                uri: 'openid-credential-offer://?credential_offer_uri=' + issuer.options.baseUrl + offerPath + '/' + credentialOfferData.id,
                txCode: credentialOfferData.pinCode,
                id: credentialOfferData.id
            };
            await issuer.storeRequestResponseData(credentialOfferData.id, 'create_offer-response', resultResponse);
            return response.json(resultResponse);
        }
        catch (e) {
            return sendErrorResponse(response, 500, {
                    error: ErrorCodes.INTERNAL_ERROR,
                    error_description: "Internal server error",
                },
                e
            );
        }
    });
}
