import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Request, Response } from 'express'
import { Issuer } from '#root/issuer/Issuer';
import passport from 'passport';
import { RevokeCredentialRequest } from '#root/types/api/index';
import { ErrorCodes } from '#root/types/api';

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