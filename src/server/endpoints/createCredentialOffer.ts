import Debug from 'debug'
import { Request, Response, Router } from 'express'
import { CredentialOfferRESTRequest, determineGrantTypes, determineSpecVersionFromOffer, Grant, OpenId4VCIVersion, TokenErrorResponse } from '@sphereon/oid4vci-common'
import { VcIssuer } from '@sphereon/oid4vci-issuer'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { ICreateCredentialOfferEndpointOpts, ICreateCredentialOfferURIResponse } from '../IssuerRestServer';
import { determinePath } from '@utils/determinePath';

import { createCredentialOfferURI } from '@utils/credentialOffer/createCredentialOfferURI';
import { IEWIssuerOptsImportArgs } from 'types';

const debug = Debug("api:createCredentialOffer");

export function createCredentialOffer<DIDDoc extends object>(
    router: Router,
    issuer: VcIssuer<DIDDoc>,
    baseUrl: string,
    opts: ICreateCredentialOfferEndpointOpts,
    issuerOptions:IEWIssuerOptsImportArgs
  ) {
    const path = determinePath(baseUrl, opts?.path ?? '/webapp/credential-offers', { stripBasePath: true })
    console.log(`[OID4VCI] createCredentialOffer endpoint enabled at ${path}`)
    router.post(path, async (request: Request<CredentialOfferRESTRequest>, response: Response<ICreateCredentialOfferURIResponse>) => {
      debug("received post", request.body);
      try {
        const specVersion = determineSpecVersionFromOffer(request.body.original_credential_offer)
        debug("specVersion is ", specVersion);

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
        const result = await createCredentialOfferURI(
          request.body.grants,
          request.body.credentialDataSupplierInput,
          request.body.credentials,
          request.body.pinLength,
          issuer.issuerMetadata,
          issuerOptions,
          issuer
        );
        const resultResponse: ICreateCredentialOfferURIResponse = result
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
  