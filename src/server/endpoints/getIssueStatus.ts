import { IssueStatusResponse } from '@sphereon/oid4vci-common'
import { VcIssuer } from '@sphereon/oid4vci-issuer'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { Request, Response, Router } from 'express'
import { IGetIssueStatusEndpointOpts} from '@sphereon/oid4vci-issuer-server'
  
import { determinePath } from '@utils/determinePath'

  export function getIssueStatus<DIDDoc extends object>(router: Router, issuer: VcIssuer<DIDDoc>, opts: IGetIssueStatusEndpointOpts) {
    const path = determinePath(opts.baseUrl, opts?.path ?? '/webapp/credential-offer-status', { stripBasePath: true })
    //console.log(`[OID4VCI] getIssueStatus endpoint enabled at ${path}`)
    router.post(path, async (request: Request, response: Response) => {
      try {
        const { id } = request.body
        const session = await issuer.credentialOfferSessions.get(id)
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
    })
  }