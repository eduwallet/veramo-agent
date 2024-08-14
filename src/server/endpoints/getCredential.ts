import { Request, Response, Router } from 'express'
import { CredentialRequestV1_0_13 } from '@sphereon/oid4vci-common'
import { ITokenEndpointOpts, VcIssuer } from '@sphereon/oid4vci-issuer'
import { ISingleEndpointOpts, sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from '@utils/determinePath';

import { getBaseUrl } from '@utils/getBaseUrl';

export function getCredential<DIDDoc extends object>(
    router: Router,
    issuer: VcIssuer<DIDDoc>,
    baseUrlParameter: URL,
    opts?: ITokenEndpointOpts & ISingleEndpointOpts,
  ) {
    const endpoint = issuer.issuerMetadata.credential_endpoint
    const baseUrl = getBaseUrl(baseUrlParameter)
    let path: string
    if (!endpoint) {
      path = `/credentials`
      issuer.issuerMetadata.credential_endpoint = `${baseUrl}${path}`
    } else {
      path = determinePath(baseUrl, endpoint, { stripBasePath: true, skipBaseUrlCheck: false })
    }
    path = determinePath(baseUrl, path, { stripBasePath: true })
    console.log(`[OID4VCI] getCredential endpoint enabled at ${path}`)
    router.post(path, async (request: Request, response: Response) => {
      try {
        const credentialRequest = request.body as CredentialRequestV1_0_13
        const credential = await issuer.issueCredential({
          credentialRequest: credentialRequest,
          tokenExpiresIn: opts?.tokenExpiresIn ?? 300,
          cNonceExpiresIn: opts?.cNonceExpiresIn ?? 5000,
        })
        return response.send(credential)
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