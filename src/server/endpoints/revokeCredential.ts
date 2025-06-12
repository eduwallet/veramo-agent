import { sendErrorResponse } from '../sendErrorResponse'
import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer.js';
import passport from 'passport';
import { RevokeCredentialRequest } from 'types/api/index.js';
import { ErrorCodes } from 'types/api.js';

export function revokeCredential(issuer:Issuer, configPath:string) {
    issuer.router!.post(
        configPath,
        passport.authenticate(issuer.name + '-admin', { session: false }),
        async (request: Request<RevokeCredentialRequest>, response: Response) => {
            try {
                const status = await issuer.revokeCredential(request.body.uuid, request.body.state == 'revoke', request.body.listName);
                return response.json({status});
            }
            catch (e) {
                return sendErrorResponse(response, 500, {
                        error: ErrorCodes.INTERNAL_ERROR,
                        error_description: (e as Error).message,
                    },
                    e
                );
            }
        }
    );
}