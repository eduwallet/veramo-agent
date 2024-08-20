import { IssueStatusResponse } from '@sphereon/oid4vci-common'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer';
import passport from 'passport';
import { determinePath } from '@utils/determinePath'

  export function getIssueStatus(issuer:Issuer, checkPath:string) {
    const path = determinePath(issuer.options.baseUrl, checkPath, { stripBasePath: true })
    issuer.router!.post(
      path,
      passport.authenticate(issuer.name + '-admin', { session: false }),
      async (request: Request, response: Response) => {
        try {
          const { id } = request.body
          const session = await issuer.vcIssuer.credentialOfferSessions.get(id)
          if (!session || !session.credentialOffer) {
            return sendErrorResponse(response, 404, {
              error: 'invalid_request',
              error_description: `Credential offer ${id} not found`,
            })
          }
    
          const authStatusBody: IssueStatusResponse = {
            createdAt: session.createdAt,
            lastUpdatedAt: session.lastUpdatedAt,
            status: session.status,
            ...(session.error && { error: session.error }),
            ...(session.clientId && { clientId: session.clientId }),
          }
          return response.send(JSON.stringify(authStatusBody))
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
      }
    )
  }