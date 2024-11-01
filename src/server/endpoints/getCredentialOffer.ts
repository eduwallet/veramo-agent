import { Request, Response } from 'express'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from 'utils/determinePath';
import { Issuer } from 'issuer/Issuer';
import { IssueStatus } from '@sphereon/oid4vci-common'
import { openObserverLog } from 'utils/openObserverLog';

export function getCredentialOffer(issuer:Issuer, getPath:string) {
    const path = determinePath(issuer.options.baseUrl, getPath, { stripBasePath: true })
    issuer.router!.get(path, async (request: Request, response: Response) => {
      try {
        const { id } = request.params
        await openObserverLog(id, "credentialoffer-request", request.params);
        const session = await issuer.vcIssuer.credentialOfferSessions.get(id)
        if (!session || !session.credentialOffer) {
          return sendErrorResponse(response, 404, {
            error: 'invalid_request',
            error_description: `Credential offer ${id} not found`,
          })
        }
        session.status = IssueStatus.OFFER_URI_RETRIEVED;
        session.lastUpdatedAt = +new Date()
        await issuer.vcIssuer.credentialOfferSessions.set(id, session);
        await openObserverLog(id, "credentialoffer-response", session.credentialOffer.credential_offer);
        return response.send(JSON.stringify(session.credentialOffer.credential_offer))
      } catch (e) {
        await openObserverLog("none", "credentialoffer-error", "internal error");
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