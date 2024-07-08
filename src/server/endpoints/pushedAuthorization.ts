
import { NextFunction, Request, Response, Router } from 'express'
import { v4 as uuidv4 } from 'uuid'
import { VcIssuer } from '@sphereon/oid4vci-issuer'
import { AuthorizationRequest } from '@sphereon/oid4vci-common'
import { ISingleEndpointOpts, sendErrorResponse } from '@sphereon/ssi-express-support'
import { validateRequestBody } from '@utils/validateRequestBody'

export function pushedAuthorization<DIDDoc extends object>(
    router: Router,
    issuer: VcIssuer<DIDDoc>,
    authRequestsData: Map<string, AuthorizationRequest>,
    opts?: ISingleEndpointOpts,
  ) {
    const handleHttpStatus400 = async (req: Request, res: Response, next: NextFunction) => {
      if (!req.body) {
        return res.status(400).send({ error: 'invalid_request', error_description: 'Request body must be present' })
      }
      const required = ['client_id', 'code_challenge_method', 'code_challenge', 'redirect_uri']
      const conditional = ['authorization_details', 'scope']
      try {
        validateRequestBody({ required, conditional, body: req.body })
      } catch (e: unknown) {
        return sendErrorResponse(res, 400, {
          error: 'invalid_request',
          error_description: (e as Error).message,
        })
      }
      return next()
    }
  
    router.post('/par', handleHttpStatus400, (req: Request, res: Response) => {
      // FIXME Fake client for testing, it needs to come from a registered client
      const client = {
        scope: ['openid', 'test'],
        redirectUris: ['http://localhost:8080/*', 'https://www.test.com/*', 'https://test.nl', 'http://*/chart', 'http:*'],
      }
  
      // For security reasons the redirect_uri from the request needs to be matched against the ones present in the registered client
      const matched = client.redirectUris.filter((s: string) => new RegExp(s.replace('*', '.*')).test(req.body.redirect_uri))
      if (!matched.length) {
        return sendErrorResponse(res, 400, {
          error: 'invalid_request',
          error_description: 'redirect_uri is not valid for the given client',
        })
      }
  
      // The scopes from the request need to be matched against the ones present in the registered client
      if (!req.body.scope.split(',').every((scope: string) => client.scope.includes(scope))) {
        return sendErrorResponse(res, 400, {
          error: 'invalid_scope',
          error_description: 'scope is not valid for the given client',
        })
      }
  
      //TODO Implement authorization_details verification
  
      // TODO: Both UUID and requestURI need to be configurable for the server
      const uuid = uuidv4()
      const requestUri = `urn:ietf:params:oauth:request_uri:${uuid}`
      // The redirect_uri is created and set in a map, to keep track of the actual request
      authRequestsData.set(requestUri, req.body)
      // Invalidates the request_uri removing it from the mapping after it is expired, needs to be refactored because
      // some of the properties will be needed in subsequent steps if the authorization succeeds
      // TODO in the /token endpoint the code_challenge must be matched against the hashed code_verifier
      setTimeout(() => {
        authRequestsData.delete(requestUri)
      }, 90 * 1000)
  
      return res.status(201).json({ request_uri: requestUri, expires_in: 90 })
    })
  }