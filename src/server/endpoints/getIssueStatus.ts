import { getDeferredTransactions, createTransactionKey } from '#root/issuer/lib/sessionDeferred';
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
                const session = await issuer.getSessionById(id);
                if (!session || !session.data.credentialOffer) {
                    return sendErrorResponse(response, 404, {
                        error: ErrorCodes.INVALID_REQUEST,
                        error_description: `Credential offer ${id} not found`,
                    });
                }
    
                const deferred = getDeferredTransactions(session);
                const reason = deferred.find((d) => d.reason)?.reason;
                const authStatusBody: IssueStatusResponse = {
                    createdAt: session.data.createdAt,
                    lastUpdatedAt: session.data.lastUpdatedAt,
                    status: session.data.status,
                    ...(session.data.requestResponseData && { requests: session.data.requestResponseData }),
                    ...(session.data.issuedCredentials?.length && { credentials: session.data.issuedCredentials }),
                    ...(deferred.length && { expiresAt: Math.max(...deferred.map((d) => d.expiresAt)) }),
                    ...(reason && { reason }),
                    ...(deferred.length && { deferred: deferred.map((d) => ({
                        id: createTransactionKey(session, d),
                        credential_configuration_id: d.credentialId,
                        status: d.status,
                        expiresAt: d.expiresAt,
                        ...(d.reason && { reason: d.reason })
                    })) })
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