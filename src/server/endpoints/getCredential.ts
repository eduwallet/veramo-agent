import { Request, Response } from 'express'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { Issuer } from 'issuer/Issuer';
import { getBaseUrl } from 'utils/getBaseUrl';
import { openObserverLog } from 'utils/openObserverLog';
import { ErrorCodes } from 'types/api';
import { validateCredentialRequest } from 'issuer/api/validateCredentialRequest';
import { issueCredential } from 'issuer/api/issueCredential';
import { CredentialProofData } from 'types/internal';

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
