import Debug from 'debug';
const debug = Debug('issuer:endpoints');
import { Request, Response} from 'express'
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { createAccessTokenResponse } from '#root/issuer/api/createAccessTokenResponse';
import { Issuer } from '#root/issuer/Issuer'
import { AccessTokenResponse, TokenRequest } from '#root/types/specification/access_token'
import { validateAccessTokenRequest } from '#root/issuer/api/validateAccessTokenRequest'
import { ErrorCodes } from '#root/types/api'

export function accessToken(issuer: Issuer, tokenPath:string) {
    if (issuer.usesAuthorisedCodeFlow()) {
        debug(`[OID4VCI] External Authorization Server is being used. Not enabling issuer token endpoint`)
        return;
    } 

    issuer.router!.post(tokenPath,
        async (request:Request<TokenRequest>, response: Response<AccessTokenResponse>) => {
            try {
                const error = await validateAccessTokenRequest(issuer, request.body);
                if (error.error != ErrorCodes.NO_ERROR) {
                    return sendErrorResponse(response, 400, { error: error.error, description: error.description });
                }
                const accessTokenResponse = await createAccessTokenResponse(issuer, error.data.session);
                const sessionId = error.data.session.uuid;

                await issuer.storeRequestResponseData(sessionId!, "access_token-request", request.body);
                response.set({'Cache-Control': 'no-store', Pragma: 'no-cache'});
                await issuer.storeRequestResponseData(sessionId!, "access_token-response", accessTokenResponse);
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
