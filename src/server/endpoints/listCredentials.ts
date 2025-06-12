import { sendErrorResponse } from '../sendErrorResponse'
import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer.js';
import passport from 'passport';
import { ListCredentialsRequest } from 'types/api/index.js';
import { ErrorCodes } from 'types/api.js';

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