import { Request, Response } from 'express'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from '@utils/determinePath';
import { Issuer } from 'issuer/Issuer';

export function getCredentialOffer(issuer:Issuer, getPath:string) {
    const path = determinePath(issuer.options.baseUrl, getPath, { stripBasePath: true })
    console.log(`[OID4VCI] getCredentialOffer endpoint enabled at ${path}`)
    issuer.router!.get(path, async (request: Request, response: Response) => {
      try {
        const { id } = request.params
        const session = await issuer.vcIssuer.credentialOfferSessions.get(id)
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