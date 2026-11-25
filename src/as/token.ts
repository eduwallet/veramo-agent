import Debug from 'debug';
const debug = Debug('issuer:as:token');
import { Request, Response } from 'express';
import { Issuer } from '#root/issuer/Issuer';
import { sendErrorResponse } from '#root/server/sendErrorResponse';
import { sendDpopNonceResponse } from '#root/server/sendDpopNonceResponse';
import { DPoPNonceRequiredError, issueDpopNonce } from '#root/issuer/lib/validateDPoPProof';
import { createAccessTokenResponse } from '#root/issuer/api/createAccessTokenResponse';
import { CredentialOfferStatus } from '#root/types/api';
import { ACCESS_TOKEN_TTL } from '#root/as/constants';
import { checkDpop } from '#root/as/dpop';
import { createUniqueId } from '#root/utils/createUniqueId';
import { findSession, parseCompositeValue, safeEqual, sessionHasExpired, sha256Base64Url } from '#root/as/util';

// see doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md, 4.1 (POST /as/token)

export function tokenUrl(issuer: Issuer): string {
    return issuer.options.baseUrl + '/as/token';
}

function oauthError(response: Response, status: number, error: string, description: string) {
    return sendErrorResponse(response, status, { error, error_description: description });
}

export async function asToken(issuer: Issuer, request: Request, response: Response) {
    response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
    try {
        const settings = issuer.embeddedASSettings();
        if (!settings) {
            return oauthError(response, 404, 'invalid_request', 'Not found');
        }
        const body = request.body ?? {};
        if (body.grant_type !== 'authorization_code') {
            return oauthError(response, 400, 'unsupported_grant_type', 'Only authorization_code is supported');
        }

        const parsed = parseCompositeValue(body.code);
        const session = parsed ? await findSession(issuer, parsed.uuid) : null;
        const authorization = session?.data?.authorization;
        const code = authorization?.code;
        if (!session || !parsed || !code || !safeEqual(code.hash, parsed.hash)
            || Date.now() > code.expiresAt || sessionHasExpired(session)
            || session.data.status != CredentialOfferStatus.PRESENTATION_VERIFIED) {
            return oauthError(response, 400, 'invalid_grant', 'Invalid grant');
        }

        // PKCE: the verifier must match the challenge of the first call
        if (typeof body.code_verifier != 'string' || !authorization.pkce
            || !safeEqual(sha256Base64Url(body.code_verifier), authorization.pkce.challenge)) {
            return oauthError(response, 400, 'invalid_grant', 'Invalid code_verifier');
        }

        // the client id is only bound if the wallet sent one; then it must be the same and still be a known one
        if (authorization.clientId !== undefined || body.client_id !== undefined) {
            if (authorization.clientId !== body.client_id || !settings.clients.some((c) => c.clientId === authorization.clientId)) {
                return oauthError(response, 400, 'invalid_client', 'Invalid client');
            }
        }

        // redirect flow: the redirect_uri of the authorization request must be repeated
        if (authorization.redirectUri !== undefined && authorization.redirectUri !== body.redirect_uri) {
            return oauthError(response, 400, 'invalid_grant', 'Invalid redirect_uri');
        }

        const dpop = await checkDpop(issuer, request, tokenUrl(issuer), authorization.presentation?.dpopJkt);
        if (dpop.error) {
            return oauthError(response, 400, 'invalid_dpop_proof', dpop.error);
        }

        // single use of the code, atomic. The code was valid up to here, so this only fails for a parallel request
        if (!await issuer.asClaims.claim('code:' + code.hash, new Date(code.expiresAt))) {
            return oauthError(response, 400, 'invalid_grant', 'Invalid grant');
        }

        const iat = Math.floor(Date.now() / 1000);
        const tokenResponse = await createAccessTokenResponse(issuer, session, dpop.jkt ?? authorization.presentation?.dpopJkt, {
            iss: issuer.embeddedASIdentifier(),
            aud: issuer.options.baseUrl,
            iat,
            exp: iat + ACCESS_TOKEN_TTL,
            jti: createUniqueId(),
            ...(authorization.clientId && { client_id: authorization.clientId })
        });
        await issuer.storeRequestResponseData(session.uuid, 'access_token-request', { grant_type: body.grant_type });
        if (dpop.jkt) {
            response.set('DPoP-Nonce', await issueDpopNonce(issuer));
        }
        await issuer.storeRequestResponseData(session.uuid, 'access_token-response', { ...tokenResponse, access_token: undefined });
        debug('access token created for the authorization code');
        return response.status(200).json(tokenResponse);
    }
    catch (e) {
        if (e instanceof DPoPNonceRequiredError) {
            return sendDpopNonceResponse(response, 400, e.nonce);
        }
        return sendErrorResponse(response, 500, { error: 'server_error', error_description: 'Internal server error' }, e);
    }
}
