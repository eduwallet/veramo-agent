import { NextFunction, Request, Response, Router } from 'express'
import { getNumberOrUndefined, JWT_SIGNER_CALLBACK_REQUIRED_ERROR, ACCESS_TOKEN_ISSUER_REQUIRED_ERROR,
    GrantTypes, PRE_AUTHORIZED_CODE_REQUIRED_ERROR, TokenError, TokenErrorResponse
 } from '@sphereon/oid4vci-common'
import { ITokenEndpointOpts, VcIssuer, assertValidAccessTokenRequest, createAccessTokenResponse  } from '@sphereon/oid4vci-issuer'
import { ISingleEndpointOpts, sendErrorResponse } from '@sphereon/ssi-express-support'
import { v4 } from 'uuid'

import { determinePath } from '@utils/determinePath';
import { getBaseUrl } from '@utils/getBaseUrl';

export function accessToken<DIDDoc extends object>(
    router: Router,
    issuer: VcIssuer<DIDDoc>,
    baseUrlParameter: string|URL,
    opts?: ITokenEndpointOpts & ISingleEndpointOpts,
  ) {
    const tokenEndpoint = issuer.issuerMetadata.token_endpoint
    const externalAS = issuer.issuerMetadata.authorization_servers
    if (externalAS) {
      console.log(`[OID4VCI] External Authorization Server ${tokenEndpoint} is being used. Not enabling issuer token endpoint`)
      return
    } else if (opts?.enabled === false) {
      console.log(`[OID4VCI] Token endpoint is not enabled`)
      return
    }
    const accessTokenIssuer = opts?.accessTokenIssuer ?? issuer.issuerMetadata.credential_issuer
  
    const preAuthorizedCodeExpirationDuration = opts?.preAuthorizedCodeExpirationDuration ?? 300
    const interval = opts?.interval ?? 300
    const tokenExpiresIn = opts?.tokenExpiresIn ?? 300
  
    // todo: this means we cannot sign JWTs or issue access tokens when configured from env vars!
    if (opts?.accessTokenSignerCallback === undefined) {
      throw new Error(JWT_SIGNER_CALLBACK_REQUIRED_ERROR)
    } else if (!accessTokenIssuer) {
      throw new Error(ACCESS_TOKEN_ISSUER_REQUIRED_ERROR)
    }
  
    const baseUrl = getBaseUrl(baseUrlParameter)
  
    // issuer is also AS
    const path = determinePath(baseUrl, opts?.tokenPath ?? '/token', {
      skipBaseUrlCheck: false,
      stripBasePath: true,
    })
    // let's fix any baseUrl ending with a slash as path will always start with a slash, and we already removed it at the end of the base url
  
    const url = new URL(`${baseUrl}${path}`)
  
    console.log(`[OID4VCI] Token endpoint enabled at ${url.toString()}`)
  
    // this.issuer.issuerMetadata.token_endpoint = url.toString()
    router.post(
      determinePath(baseUrl, url.pathname, { stripBasePath: true }),
      verifyTokenRequest({
        issuer,
        preAuthorizedCodeExpirationDuration,
      }),
      handleTokenRequest({
        issuer,
        accessTokenSignerCallback: opts.accessTokenSignerCallback,
        cNonceExpiresIn: issuer.cNonceExpiresIn,
        interval,
        tokenExpiresIn,
        accessTokenIssuer,
      }),
    )
}


/**
 *
 * @param tokenExpiresIn
 * @param accessTokenSignerCallback
 * @param accessTokenIssuer
 * @param cNonceExpiresIn
 * @param issuer
 * @param interval
 */
const handleTokenRequest = <T extends object>({
  tokenExpiresIn, // expiration in seconds
  accessTokenSignerCallback,
  accessTokenIssuer,
  cNonceExpiresIn, // expiration in seconds
  issuer,
  interval,
}: Required<Pick<ITokenEndpointOpts, 'accessTokenIssuer' | 'cNonceExpiresIn' | 'interval' | 'accessTokenSignerCallback' | 'tokenExpiresIn'>> & {
  issuer: VcIssuer<T>
}) => {
  return async (request: Request, response: Response) => {
    response.set({
      'Cache-Control': 'no-store',
      Pragma: 'no-cache',
    })

    if (request.body.grant_type !== GrantTypes.PRE_AUTHORIZED_CODE) {
      // Yes this is redundant, only here to remind us that we need to implement the auth flow as well
      return sendErrorResponse(response, 400, {
        error: TokenErrorResponse.invalid_request,
        error_description: PRE_AUTHORIZED_CODE_REQUIRED_ERROR,
      })
    }

    try {
      const responseBody = await createAccessTokenResponse(request.body, {
        credentialOfferSessions: issuer.credentialOfferSessions,
        accessTokenIssuer,
        cNonces: issuer.cNonces,
        cNonce: v4(),
        accessTokenSignerCallback,
        cNonceExpiresIn,
        interval,
        tokenExpiresIn,
      })
      return response.status(200).json(responseBody)
    } catch (error) {
      return sendErrorResponse(
        response,
        400,
        {
          error: TokenErrorResponse.invalid_request,
        },
        error,
      )
    }
  }
}

const verifyTokenRequest = <T extends object>({
  preAuthorizedCodeExpirationDuration,
  issuer,
}: Required<Pick<ITokenEndpointOpts, 'preAuthorizedCodeExpirationDuration'> & { issuer: VcIssuer<T> }>) => {
  return async (request: Request, response: Response, next: NextFunction) => {
    try {
      await assertValidAccessTokenRequest(request.body, {
        expirationDuration: preAuthorizedCodeExpirationDuration,
        credentialOfferSessions: issuer.credentialOfferSessions,
      })
    } catch (error) {
      if (error instanceof TokenError) {
        return sendErrorResponse(response, error.statusCode, {
          error: error.responseError,
          error_description: error.getDescription(),
        })
      } else {
        return sendErrorResponse(response, 400, { error: TokenErrorResponse.invalid_request, error_description: (error as Error).message }, error)
      }
    }

    return next()
  }
}
