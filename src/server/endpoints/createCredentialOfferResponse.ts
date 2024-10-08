import { Request, Response } from 'express'
import { CredentialOfferRESTRequest, determineGrantTypes, TokenErrorResponse } from '@sphereon/oid4vci-common'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from '@utils/determinePath';
import { ICreateCredentialOfferURIResponse } from '@sphereon/oid4vci-issuer-server';

import { createCredentialOffer} from 'issuer/createCredentialOffer';
import { Issuer } from 'issuer/Issuer'
import passport from 'passport';
import { debug } from '@utils/logger';
import { openObserverLog } from '@utils/openObserverLog';

export function createCredentialOfferResponse(issuer: Issuer, createOfferPath: string, offerPath: string) {
    const path = determinePath(issuer.options.baseUrl, createOfferPath, { stripBasePath: true })
    const getOfferPath = determinePath(issuer.options.baseUrl, offerPath, { stripBasePath: true });
    issuer.router!.post(path,
      passport.authenticate(issuer.name + '-admin', { session: false }),
      async (request: Request<CredentialOfferRESTRequest>, response: Response<ICreateCredentialOfferURIResponse>) => {
      try {
        // before we enter a new request, clean up the memory a bit
        issuer.clearExpired();
        debug('createCredentialOfferResponse to issue credential from', issuer.name, request.body);
        const grantTypes = determineGrantTypes(request.body);
        if (grantTypes.length === 0) {
          return sendErrorResponse(response, 400, { error: TokenErrorResponse.invalid_grant, error_description: 'No grant type supplied' })
        }

        const credentialConfigIds = request.body.credentials as string[]
        if (!credentialConfigIds || credentialConfigIds.length === 0) {
          return sendErrorResponse(response, 400, {
            error: TokenErrorResponse.invalid_request,
            error_description: 'credentials configuration ids missing in credential offer payload',
          })
        }

        debug('credentialConfigIds', credentialConfigIds);
        debug('issuer', issuer.metadata.credential_configurations_supported);

        if (!issuer.hasCredentialConfiguration(credentialConfigIds)) {
          return sendErrorResponse(response, 404, {
            error: TokenErrorResponse.invalid_request,
            error_description: 'no such credential configuration available',
          })
        }

        const offerData = await createCredentialOffer(
          request.body.grants,
          request.body.credentialDataSupplierInput,
          request.body.credentials,
          request.body.pinLength ?? 4,
          issuer
        );
        await openObserverLog(offerData.id, "createoffer-request", request.body);

        const resultResponse: ICreateCredentialOfferURIResponse = {
          uri: 'openid-credential-offer://?credential_offer_uri=' + issuer.options.baseUrl + getOfferPath + '/' + offerData.id,
          txCode: offerData.txCode
        }
        await openObserverLog(offerData.id, "createoffer-response", resultResponse);
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
  
