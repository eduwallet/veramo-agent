import { Request, Response } from 'express'
import { CredentialOfferRESTRequest, determineGrantTypes, TokenErrorResponse } from '@sphereon/oid4vci-common'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from '@utils/determinePath';
import { ICreateCredentialOfferURIResponse } from '@sphereon/oid4vci-issuer-server';

import { createCredentialOffer} from 'issuer/createCredentialOffer';
import { Issuer } from 'issuer/Issuer'
import passport from 'passport';


export function createCredentialOfferResponse(issuer: Issuer, createOfferPath: string, offerPath: string) {
    const path = determinePath(issuer.options.baseUrl, createOfferPath, { stripBasePath: true })
    const getOfferPath = determinePath(issuer.options.baseUrl, offerPath, { stripBasePath: true });
    issuer.router!.post(path,
      passport.authenticate(issuer.name + '-admin', { session: false }),
      async (request: Request<CredentialOfferRESTRequest>, response: Response<ICreateCredentialOfferURIResponse>) => {
      try {
        const grantTypes = determineGrantTypes(request.body)
        if (grantTypes.length === 0) {
          return sendErrorResponse(response, 400, { error: TokenErrorResponse.invalid_grant, error_description: 'No grant type supplied' })
        }

        const credentialConfigIds = request.body.credentials as string[]
        if (!credentialConfigIds || credentialConfigIds.length === 0) {
          return sendErrorResponse(response, 400, {
            error: TokenErrorResponse.invalid_request,
            error_description: 'credentials missing in credential offer payload',
          })
        }

        const offerData = await createCredentialOffer(
          request.body.grants,
          request.body.credentialDataSupplierInput,
          request.body.credentials,
          request.body.pinLength ?? 4,
          issuer
        );

        const resultResponse: ICreateCredentialOfferURIResponse = {
          uri: 'openid-credential-offer://?credential_offer_uri=' + issuer.options.baseUrl + getOfferPath + '/' + offerData.id,
          userPin: offerData.userPin
        }
        return response.send(resultResponse)
      } catch (e) {
        return sendErrorResponse(
          response,
          500,
          {
            error: TokenErrorResponse.invalid_request,
            error_description: (e as Error).message,
          },
          e,
        )
      }
    })
}
  