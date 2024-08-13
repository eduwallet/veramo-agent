import { Request, Response, Router } from 'express'
import { VcIssuer } from '@sphereon/oid4vci-issuer'
import { sendErrorResponse, ISingleEndpointOpts } from '@sphereon/ssi-express-support'
import { determinePath } from '@utils/determinePath';

export function getCredentialOffer<DIDDoc extends object>(router: Router, issuer: VcIssuer<DIDDoc>, baseUrl?: string, opts?: ISingleEndpointOpts) {
    const path = determinePath(baseUrl, opts?.path ?? '/webapp/credential-offers/:id', { stripBasePath: true })
    console.log(`[OID4VCI] getCredentialOffer endpoint enabled at ${path}`)
    router.get(path, async (request: Request, response: Response) => {
      try {
        const { id } = request.params
        const session = await issuer.credentialOfferSessions.get(id)
        if (!session || !session.credentialOffer) {
          return sendErrorResponse(response, 404, {
            error: 'invalid_request',
            error_description: `Credential offer ${id} not found`,
          })
        }
        return response.send(JSON.stringify(session.credentialOffer.credential_offer))
      } catch (e) {
        return sendErrorResponse(
          response,
          500,
          {
            error: 'invalid_request',
            error_description: (e as Error).message,
          },
          e,
        )
      }
    })
}