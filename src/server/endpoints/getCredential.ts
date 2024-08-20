import { Request, Response } from 'express'
import { CredentialRequestV1_0_13 } from '@sphereon/oid4vci-common'
import { ITokenEndpointOpts } from '@sphereon/oid4vci-issuer'
import { ISingleEndpointOpts, sendErrorResponse } from '@sphereon/ssi-express-support'
import { determinePath } from '@utils/determinePath';
import { Issuer } from 'issuer/Issuer';

import { getBaseUrl } from '@utils/getBaseUrl';

export function getCredential(
    issuer:Issuer,
    opts?: ITokenEndpointOpts & ISingleEndpointOpts,
  ) {
    const endpoint = issuer.metadata.credential_endpoint
    const baseUrl = getBaseUrl(issuer.options.baseUrl)
    let path: string
    if (!endpoint) {
      path = `/credentials`
      issuer.metadata.credential_endpoint = `${baseUrl}${path}`
    } else {
      path = determinePath(baseUrl, endpoint, { stripBasePath: true, skipBaseUrlCheck: false })
    }
    path = determinePath(baseUrl, path, { stripBasePath: true })
    issuer.router!.post(path, async (request: Request, response: Response) => {
      try {
        const credentialRequest = request.body as CredentialRequestV1_0_13
        const credential = await issuer.vcIssuer.issueCredential({
          credentialRequest,
          tokenExpiresIn: 300,
          cNonceExpiresIn: 5000
        });
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