import { Request, Response } from 'express'
import { sendErrorResponse } from '../sendErrorResponse'
import { Issuer } from 'issuer/Issuer.js';
import { getBaseUrl } from 'utils/getBaseUrl.js';
import { openObserverLog } from 'utils/openObserverLog.js';
import { ErrorCodes } from 'types/api.js';
import { validateCredentialRequest } from 'issuer/api/validateCredentialRequest.js';
import { issueCredential } from 'issuer/api/issueCredential.js';
import { CredentialProofData } from 'types/internal.js';

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
                await openObserverLog(proofData.session.id, "credential-request", request.body);
                await openObserverLog(proofData.session.id, "credential-request_proof", request.body.proof.jwt);
                await issuer.storeRequestResponseData(proofData.session.id, "get_credential-request", request.body);
                await issuer.storeRequestResponseData(proofData.session.id, "get_credential-request_proof", request.body.proof.jwt, true);

                const credentialResponse = await issueCredential(issuer, proofData);

                await openObserverLog(proofData.session.id, "credential-response", credentialResponse);
                await issuer.storeRequestResponseData(proofData.session.id, "get_credential-response", credentialResponse);
                await issuer.storeRequestResponseData(proofData.session.id, "get_credential-response_jwt", credentialResponse.credential, true);
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
