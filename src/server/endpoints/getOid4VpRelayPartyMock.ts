import { sendErrorResponse } from '@sphereon/ssi-express-support';
import { NextFunction, Request, Response } from 'express';
import { Issuer } from 'issuer/Issuer';
import { openObserverLog } from 'utils/openObserverLog';

// A closure, because consistent with the rest of the codebase, but not strictly necessary,
// as we don't need to access the issuer object
function validateOid4VpAuthorizationRequest() {
  return async function(req: Request, res: Response, next: NextFunction) {
    // client_id is required
    if (!req.body.client_id) {
      await openObserverLog("none", "credential-error", "client_id is required");
      return sendErrorResponse(
        res,
        400,
        {
          error: 'invalid_request',
          error_description: 'client_id is required',
        }
      )
    }

    return next();
  }
}

export function getOid4VpRelayPartyMock(issuer: Issuer, path: string) {
  // TODO: only allow x-www-form-urlencoded formats
  // TODO: determine if we need to authenticate the request- this is required if the authorization-server also requires authentication
  // See https://github.com/Sphereon-Opensource/web-wallet/blob/develop/docs/OID4VP-during-OID4VCI.md
  // for a starter on the OID4VP spec as defined by sphereon.
  issuer.router!.post(
    path,
    validateRequest(),
    async (req: Request, res: Response) => {
      try {
        const client_id = req.body.client_id;
        const auth_session_id = "123456789"; // TODO: negotiate or generate a secure session id

        // TODO: handle request with session
        // TODO: handle request according to WHAT spec? oid4vp? what version?

        let presentationUrl = new URL("/authorize");
        presentationUrl.searchParams.append("client_id", client_id);
        // TODO: move to config
        presentationUrl.searchParams.append("request_uri", `https://rp.example.com/oidc/request/${auth_session_id}`);

        // return with 400 OK.
        res.status(400);
        return res.json({
          error: 'insufficient_authorization',
          auth_session: auth_session_id,
          presentation: presentationUrl.toString(),
        });


        } catch (e) {
          console.error((e as Error).stack);
          await openObserverLog("none", "credential-error", "internal error");
          return sendErrorResponse(
            res,
            500,
            {
              error: 'unhandled_error',
              error_description: (e as Error).message,
            },
            e,
          )
        }
    }
  );
}
