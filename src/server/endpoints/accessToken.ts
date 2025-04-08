import Debug from 'debug';
const debug = Debug('issuer:endpoints');
import { Request, Response} from 'express'
import { sendErrorResponse } from '@sphereon/ssi-express-support'
import { createAccessTokenResponse } from 'issuer/api/createAccessTokenResponse';
import { Issuer } from 'issuer/Issuer'
import { openObserverLog } from 'utils/openObserverLog';
import { TokenRequest, TokenResponse } from 'types/specification/access_token'
import { validateAccessTokenRequest } from 'issuer/api/validateAccessTokenRequest'
import { ErrorCodes } from 'types/api'

export function accessToken(issuer: Issuer, tokenPath:string) {
    const externalAS = issuer.metadata.authorization_servers
    if (externalAS) {
        debug(`[OID4VCI] External Authorization Server is being used. Not enabling issuer token endpoint`)
        return;
    } 
    // this.issuer.issuerMetadata.token_endpoint = url.toString()
    issuer.router!.post(tokenPath,
        async (request:Request<TokenRequest>, response: Response<TokenResponse>) => {
            try {
                const error = validateAccessTokenRequest(issuer, request.body);
                if (error.error != ErrorCodes.NO_ERROR) {
                    return sendErrorResponse(response, 400, { error: error.error, description: error.description });
                }
                const accessTokenResponse = await createAccessTokenResponse(issuer, error.data.session);
                const sessionId = error.data.session.id;

                await openObserverLog(sessionId || '', "accesstoken-request", request.body);
                issuer.storeRequestResponseData(sessionId!, "access_token-request", request.body);
                response.set({'Cache-Control': 'no-store', Pragma: 'no-cache'});
                await openObserverLog(sessionId || '', "accesstoken-response", accessTokenResponse);
                issuer.storeRequestResponseData(sessionId!, "access_token-response", accessTokenResponse);
                return response.status(200).json(accessTokenResponse)
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
