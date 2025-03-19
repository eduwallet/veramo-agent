import { NextFunction, Request, Response } from 'express'
import { CredentialRequest, CredentialRequestV1_0_13, extractBearerToken, getTypesFromRequest, IssueStatus } from '@sphereon/oid4vci-common'
import { ITokenEndpointOpts } from '@sphereon/oid4vci-issuer'
import { ISingleEndpointOpts, sendErrorResponse } from '@sphereon/ssi-express-support'

import { determinePath } from 'utils/determinePath';
import { Issuer } from 'issuer/Issuer';
import { getBaseUrl } from 'utils/getBaseUrl';
import { verifyJWT } from 'did-jwt';
import { resolver } from 'resolver';
import { openObserverLog } from 'utils/openObserverLog';
import { ErrorCodes } from 'types/api';
import { validateCredentialRequest } from 'issuer/api/validateCredentialRequest';
import { issueCredential } from 'issuer/api/issueCredential';

export function getCredential(issuer:Issuer)
{
    const endpoint = issuer.metadata.credential_endpoint
    const baseUrl = getBaseUrl(issuer.options.baseUrl)
    let path = determinePath(baseUrl, endpoint, { stripBasePath: true, skipBaseUrlCheck: false })
    issuer.router!.post(
        path,
        async (request: Request, response: Response) => {
            try {
                const error = await validateCredentialRequest(issuer, request);
                if (error.error != ErrorCodes.NO_ERROR) {
                    return sendErrorResponse(response, 400, { error: error.error, description: error.description });
                }
                await issuer.storeRequestResponseData(error.data.session.id, "get_credential-request", request.body);
                await issuer.storeRequestResponseData(error.data.session.id, "get_credential-request_proof", request.body.proof.jwt, true);
                await openObserverLog(error.data.session.id, "credential-request", request.body);

                const credentialResponse = await issueCredential(issuer, request.body, error.data.session, error.data.type);

                await openObserverLog(error.data.session.id, "credential-response", credentialResponse);
                await openObserverLog(credentialResponse.state, "credential-request", request.body);
                await issuer.storeRequestResponseData(credentialResponse.state, "get_credential-request", request.body);
                await issuer.storeRequestResponseData(credentialResponse.state, "get_credential-request_proof", request.body.proof.jwt, true);
                await issuer.storeRequestResponseData(credentialResponse.state, "get_credential-response", credentialResponse.response);
                await issuer.storeRequestResponseData(credentialResponse.state, "get_credential-response_jwt", credentialResponse.response.credential, true);
                return response.json(credentialResponse.response)
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
