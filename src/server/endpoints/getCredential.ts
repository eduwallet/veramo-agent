import { NextFunction, Request, Response } from 'express'
import { getTypesFromRequest, CredentialRequest, CredentialRequestV1_0_13, extractBearerToken, IssueStatus } from '@sphereon/oid4vci-common'
import { ITokenEndpointOpts } from '@sphereon/oid4vci-issuer'
import { ISingleEndpointOpts, sendErrorResponse } from '@sphereon/ssi-express-support'

import { determinePath } from '@utils/determinePath';
import { Issuer } from 'issuer/Issuer';
import { getBaseUrl } from '@utils/getBaseUrl';
import { verifyJWT } from 'did-jwt';
import { resolver } from 'plugins';
import { openObserverLog } from '@utils/openObserverLog';

function validateCredentialRequest(issuer:Issuer) {
  return async function (request:Request, response:Response, next:NextFunction) {
    try {
      const jwt = extractBearerToken(request.header('Authorization'))
      const data  = await verifyJWT(jwt || '', { resolver, proofPurpose: 'authentication'});

      if (data.issuer != issuer.did?.did) {
        await openObserverLog("none", "credential-error", "incorrect bearer token");
        return sendErrorResponse(
          response,
          403,
          {
            error: 'not authorized',
          }
        )
      }

      const sessionState = await issuer.vcIssuer.credentialOfferSessions.get(data.payload.preAuthorizedCode);
      if (!sessionState || sessionState.status != IssueStatus.ACCESS_TOKEN_CREATED) {
        await openObserverLog("none", "credential-error", "access token already used");
        return sendErrorResponse(
          response,
          410,
          {
            error: 'not available',
          }
        )
      }

      const types = getTypesFromRequest(request.body as CredentialRequest, { filterVerifiableCredential: true });
      if (!issuer.hasCredentialConfiguration(types)) {
        await openObserverLog("none", "credential-error", "request credential type not available");
        return sendErrorResponse(
          response,
          404,
          {
            error: 'not found',
          }
        )
      }
      return next();
    }
    catch (e) {
      console.error('error response on body ', request.headers, request.body);
      await openObserverLog("none", "credential-error", "internal error");
      return sendErrorResponse(
        response,
        500,
        {
          error: 'invalid request',
        }
      )
    };
  };
}

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
    issuer.router!.post(
      path,
      validateCredentialRequest(issuer),
      async (request: Request, response: Response) => {
        await openObserverLog("none", "credential-request", request.body);
        try {
          const credentialRequest = request.body as CredentialRequestV1_0_13
          const credentialResponse = await issuer.issueCredential(credentialRequest);
          await openObserverLog("none", "credential-response", credentialResponse.response);
          await issuer.storeCredential(credentialResponse.state);
          return response.send(credentialResponse.response)
        } catch (e) {
          console.error((e as Error).stack);
          await openObserverLog("none", "credential-error", "internal error");
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
