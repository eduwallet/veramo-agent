import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Request, Response } from 'express'
import { Issuer } from '#root/issuer/Issuer';
import passport from 'passport';
import { ListCredentialsRequest } from '#root/types/api/index';
import { ErrorCodes } from '#root/types/api';

export function listCredentials(issuer:Issuer, configPath:string) {
    issuer.router!.post(
        configPath,
        passport.authenticate(issuer.name + '-admin', { session: false }),
        async (request: Request<ListCredentialsRequest>, response: Response) => {
            try {
                return response.json(await issuer.listCredentials(request.body.primaryId, request.body.credential, request.body.issuanceDate, request.body.state, request.body.holder));
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