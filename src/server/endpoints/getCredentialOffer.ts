import Debug from 'debug'
const debug = Debug('issuer:endpoints')
import { Request, Response } from 'express'
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Issuer } from '#root/issuer/Issuer'
import { openObserverLog } from '#root/utils/openObserverLog'
import { validateGetCredentialOffer } from '#root/issuer/api/validateGetCredentialOffer'
import { CredentialOfferStatus, ErrorCodes } from '#root/types/api'

export function getCredentialOffer(issuer: Issuer, getPath: string) {
  issuer.router!.get(getPath, async (request: Request, response: Response) => {
    try {
      const error = await validateGetCredentialOffer(issuer, request)
      if (error.error != ErrorCodes.NO_ERROR) {
        return sendErrorResponse(response, 400, { error: error.error, description: error.description })
      }

      // validation succeeded, so we MUST have a session
      debug('received getCredentialOffer request for session ', error.data.session?.uuid)
      const session = error.data.session!
      await openObserverLog(session.uuid, 'credentialoffer-request', request.params)
      await issuer.storeRequestResponseData(session.uuid, 'credential_offer-request', request.params)

      session.data.status = CredentialOfferStatus.OFFER_URI_RETRIEVED
      session.lastUpdatedAt = +new Date()
      await issuer.storeSession(session)

      await openObserverLog(session.uuid, 'credentialoffer-response', session.data.credentialOffer?.credential_offer)
      await issuer.storeRequestResponseData(session.uuid, 'credential_offer-response', session.data.credentialOffer?.credential_offer)
      debug('returning ', session.data.credentialOffer)
      return response.json(session.data.credentialOffer)
    } catch (e) {
      return sendErrorResponse(
        response,
        500,
        {
          error: ErrorCodes.INTERNAL_ERROR,
          error_description: (e as Error).message,
        },
        e,
      )
    }
  })
}
