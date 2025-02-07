import { Request, Response } from 'express'
import { CredentialOfferPayloadV1_0_13, QRCodeOpts, CredentialDataSupplierInput, determineGrantTypes, TokenErrorResponse, GrantTypes, TxCode } from '@sphereon/oid4vci-common'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from 'utils/determinePath';

import { createCredentialOffer} from 'issuer/createCredentialOffer';
import { Issuer } from 'issuer/Issuer'
import passport from 'passport';
import { debug } from 'utils/logger';
import { openObserverLog } from 'utils/openObserverLog';
import { StringKeyedObject } from 'types';

export interface CredentialOfferRequest {
  credentials: string[];
  pinLength?: number;
  credentialDataSupplierInput?: CredentialDataSupplierInput;
  credentialMetadata?: StringKeyedObject;
}

export type ICreateCredentialOfferURIResponse = {
  uri: string
  userPin?: string
  txCode?: TxCode
  id?: string
}

export function createCredentialOfferResponse(issuer: Issuer, createOfferPath: string, offerPath: string) {
    const path = determinePath(issuer.options.baseUrl, createOfferPath, { stripBasePath: true })
    const getOfferPath = determinePath(issuer.options.baseUrl, offerPath, { stripBasePath: true });
    issuer.router!.post(path,
      passport.authenticate(issuer.name + '-admin', { session: false }),
      async (request: Request<CredentialOfferRequest>, response: Response<ICreateCredentialOfferURIResponse>) => {
      try {
        // before we enter a new request, clean up the memory a bit
        issuer.clearExpired();
        debug('createCredentialOfferResponse to issue credential from', issuer.name, request.body);
        const grantTypes = determineGrantTypes(request.body);
        if (grantTypes.length === 0) {
          return sendErrorResponse(response, 400, { error: TokenErrorResponse.invalid_grant, error_description: 'No grant type supplied' })
        }

        const credentialConfigIds = request.body.credentials as string[];
        if (!credentialConfigIds || credentialConfigIds.length === 0) {
          return sendErrorResponse(response, 400, {
            error: TokenErrorResponse.invalid_request,
            error_description: 'credentials configuration ids missing in credential offer payload',
          })
        }

        debug('credentialConfigIds', credentialConfigIds);
        debug('issuer', issuer.metadata.metadata.credential_configurations_supported);

        if (!issuer.hasCredentialConfiguration(credentialConfigIds)) {
          return sendErrorResponse(response, 404, {
            error: TokenErrorResponse.invalid_request,
            error_description: 'no such credential configuration available',
          })
        }

        // if pre-authorized-code is used, the proper credential data should be present
        if (grantTypes.includes(GrantTypes.PRE_AUTHORIZED_CODE)) {
          if (!issuer.checkCredentialData(credentialConfigIds, request.body.credentialDataSupplierInput)) {
            return sendErrorResponse(response, 400, {
              error: TokenErrorResponse.invalid_request,
              error_description: 'missing required claims',
            })
          }
        }

        const offerData = await createCredentialOffer(
          request.body.grants,
          request.body.credentialDataSupplierInput,
          request.body.credentialMetadata || {},
          credentialConfigIds,
          request.body.pinLength ?? 4,
          issuer
        );
        await openObserverLog(offerData.id, "createoffer-request", request.body);
        await issuer.storeRequestResponseData(offerData.id, 'create_offer-request', request.body);

        const resultResponse: ICreateCredentialOfferURIResponse = {
          uri: 'openid-credential-offer://?credential_offer_uri=' + issuer.options.baseUrl + getOfferPath + '/' + offerData.id,
          txCode: offerData.txCode,
          id: offerData.id
        }
        await openObserverLog(offerData.id, "createoffer-response", resultResponse);
        await issuer.storeRequestResponseData(offerData.id, 'create_offer-response', resultResponse);
        return response.json(resultResponse);
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
  
