import { Request, Response } from 'express'
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Issuer } from '#root/issuer/Issuer';
import { ErrorCodes } from '#root/types/api';
import { validateNotificationRequest } from '#root/issuer/api/notification';

// https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0.html#name-notification-endpoint
export function notification(issuer:Issuer, path:string)
{
    issuer.router!.post(
        path,
        async (request: Request, response: Response) => {
            try {
                const error = await validateNotificationRequest(issuer, request);
                if (error.error != ErrorCodes.NO_ERROR) {
                    return sendErrorResponse(response, 400, { error: error.error, description: error.description });
                }
                const { session } = error.data;
                await issuer.storeRequestResponseData(session.uuid, "notification-request", request.body);
                return response.status(204).send();
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
