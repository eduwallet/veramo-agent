import { Request, Response} from 'express'
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { createAccessTokenResponse } from '#root/issuer/api/createAccessTokenResponse';
import { Issuer } from '#root/issuer/Issuer'
import { AccessTokenResponse, TokenRequest } from '#root/types/specification/access_token'
import { validateAccessTokenRequest } from '#root/issuer/api/validateAccessTokenRequest'
import { ErrorCodes } from '#root/types/api'
import { DPoPNonceRequiredError, issueDpopNonce } from '#root/issuer/lib/validateDPoPProof'
import { sendDpopNonceResponse } from '#root/server/sendDpopNonceResponse'

export function accessToken(issuer: Issuer, tokenPath:string) {
    // Always enabled: even when an external Authorization Server is configured for the
    // authorization_code flow, the issuer may still act as its own AS for
    // pre-authorized_code flow sessions.
    issuer.router!.post(tokenPath,
        async (request:Request<TokenRequest>, response: Response<AccessTokenResponse>) => {
            try {
                const error = await validateAccessTokenRequest(issuer, request.body, request.header('DPoP'));
                if (error.error != ErrorCodes.NO_ERROR) {
                    return sendErrorResponse(response, 400, { error: error.error, description: error.description });
                }
                const accessTokenResponse = await createAccessTokenResponse(issuer, error.data.session, error.data.jkt);
                const sessionId = error.data.session.uuid;

                await issuer.storeRequestResponseData(sessionId!, "access_token-request", request.body);
                response.set({'Cache-Control': 'no-store', Pragma: 'no-cache'});
                if (error.data.jkt) {
                    // RFC 9449 §9: provide a fresh nonce on every response so the wallet does not
                    // need an extra round trip when calling the credential endpoint next
                    response.set('DPoP-Nonce', await issueDpopNonce(issuer));
                }
                await issuer.storeRequestResponseData(sessionId!, "access_token-response", accessTokenResponse);
                return response.status(200).json(accessTokenResponse)
            }
            catch (e) {
                if (e instanceof DPoPNonceRequiredError) {
                    return sendDpopNonceResponse(response, 400, e.nonce);
                }
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
