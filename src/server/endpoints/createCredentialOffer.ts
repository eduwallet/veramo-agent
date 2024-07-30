import Debug from 'debug'
import { Request, Response, Router } from 'express'
import { CredentialOfferRESTRequest, determineGrantTypes, determineSpecVersionFromOffer, Grant, OpenId4VCIVersion, TokenErrorResponse } from '@sphereon/oid4vci-common'
import { VcIssuer } from '@sphereon/oid4vci-issuer'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { ICreateCredentialOfferEndpointOpts, ICreateCredentialOfferURIResponse } from '../IssuerRestServer';
import { determinePath } from '@utils/determinePath';

const debug = Debug("api:createCredentialOffer");

export function createCredentialOffer<DIDDoc extends object>(
    router: Router,
    issuer: VcIssuer<DIDDoc>,
    baseUrl?: string,
    opts?: ICreateCredentialOfferEndpointOpts,
  ) {
    const path = determinePath(baseUrl, opts?.path ?? '/webapp/credential-offers', { stripBasePath: true })
    console.log(`[OID4VCI] createCredentialOffer endpoint enabled at ${path}`)
    router.post(path, async (request: Request<CredentialOfferRESTRequest>, response: Response<ICreateCredentialOfferURIResponse>) => {
      debug("received post", request.body);
      try {
        const specVersion = determineSpecVersionFromOffer(request.body.original_credential_offer)
        debug("specVersion is ", specVersion);

        debug("determining grant types on body", request.body.grants);
        const grantTypes = determineGrantTypes(request.body)
        if (grantTypes.length === 0) {
          return sendErrorResponse(response, 400, { error: TokenErrorResponse.invalid_grant, error_description: 'No grant type supplied' })
        }
        const grants = request.body.grants as Grant
        const credentialConfigIds = request.body.credentials as string[]
        if (!credentialConfigIds || credentialConfigIds.length === 0) {
          return sendErrorResponse(response, 400, {
            error: TokenErrorResponse.invalid_request,
            error_description: 'credentials missing in credential offer payload',
          })
        }
        const qrCodeOpts = request.body.qrCodeOpts ?? opts?.qrCodeOpts
        const result = await issuer.createCredentialOfferURI({ ...request.body, qrCodeOpts, grants })
        const resultResponse: ICreateCredentialOfferURIResponse = result
        if ('session' in resultResponse) {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-ignore
          delete resultResponse.session
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
  