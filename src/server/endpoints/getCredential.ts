import Debug from 'debug';
const debug = Debug("issuer:endpoint");

import { Request, Response } from 'express'
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { Issuer } from '#root/issuer/Issuer';
import { openObserverLog } from '#root/utils/openObserverLog';
import { ErrorCodes } from '#root/types/api';
import { validateCredentialRequest } from '#root/issuer/api/validateCredentialRequest';
import { issueCredential } from '#root/issuer/api/issueCredential';
import { CredentialProofData } from '#root/types/internal';

export function getCredential(issuer:Issuer, path:string)
{
    issuer.router!.post(
        path,
        async (request: Request, response: Response) => {
            try {
                const error = await validateCredentialRequest(issuer, request);
                if (error.error != ErrorCodes.NO_ERROR) {
                    return sendErrorResponse(response, 400, { error: error.error, description: error.description });
                }
                const proofData:CredentialProofData = error.data;
                await openObserverLog(proofData.session.uuid, "credential-request", request.body);
                await issuer.storeRequestResponseData(proofData.session.uuid, "get_credential-request", request.body);

                const credentialResponse = await issueCredential(issuer, proofData);

                await openObserverLog(proofData.session.uuid, "credential-response", credentialResponse);
                await issuer.storeRequestResponseData(proofData.session.uuid, "get_credential-response", credentialResponse);
                return response.json(credentialResponse);
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
