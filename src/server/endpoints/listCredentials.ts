import { IssueStatusResponse } from '@sphereon/oid4vci-common'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer';
import { determinePath } from 'utils/determinePath'
import passport from 'passport';

interface ListCredentialsRequest {
    issuanceDate?:string;
    state?:string;
    holder?:string;
    credential?:string;
    primaryId?:string;
}

export function listCredentials(issuer:Issuer, configPath:string) {
    const path = determinePath(issuer.options.baseUrl, configPath, { stripBasePath: true })
    issuer.router!.post(
      path,
      passport.authenticate(issuer.name + '-admin', { session: false }),
      async (request: Request<ListCredentialsRequest>, response: Response) => {
        try {
          return response.json(await issuer.listCredentials(request.body.primaryId, request.body.credential, request.body.issuanceDate, request.body.state, request.body.holder));
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