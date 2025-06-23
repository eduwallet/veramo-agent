import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Request, Response } from 'express'
import { Issuer } from '#root/issuer/Issuer';
import passport from 'passport';
import { ErrorCodes } from '#root/types/api';
import { IssueStatusResponse } from '#root/types/api/index';

export function getIssueStatus(issuer:Issuer, checkPath:string) {
    issuer.router!.post(
        checkPath,
        passport.authenticate(issuer.name + '-admin', { session: false }),
        async (request: Request, response: Response) => {
            try {
                const { id } = request.body
                const session = issuer.getSessionById(id);
                if (!session || !session.credentialOffer) {
                    return sendErrorResponse(response, 404, {
                        error: ErrorCodes.INVALID_REQUEST,
                        error_description: `Credential offer ${id} not found`,
                    });
                }
    
                const authStatusBody: IssueStatusResponse = {
                    createdAt: session.createdAt,
                    lastUpdatedAt: session.lastUpdatedAt,
                    status: session.status,
                    ...(session.requestResponseData && { requests: session.requestResponseData }),
                    ...(session.uuid && { uuid: session.uuid })
                }
                return response.json(authStatusBody);
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