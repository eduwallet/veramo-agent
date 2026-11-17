import { Request, Response } from 'express';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { sendErrorResponse } from '#root/server/sendErrorResponse';
import { sendDpopNonceResponse } from '#root/server/sendDpopNonceResponse';
import { DPoPNonceRequiredError, issueDpopNonce } from '#root/issuer/lib/validateDPoPProof';
import { CredentialOfferStatus } from '#root/types/api';
import { EmbeddedASSettings } from '#root/as/config';
import { POLL_INTERVAL } from '#root/as/constants';
import { checkDpop } from '#root/as/dpop';
import { completePresentation, findSessionForPresentation, startPresentation, validAuthorizationDetails } from '#root/as/presentation';
import { findSession, parseCompositeValue, remainingSeconds, safeEqual, sessionHasExpired } from '#root/as/util';

// see doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md, 4.1 (POST /as/authorization-challenge)

export function challengeUrl(issuer: Issuer): string {
    return issuer.options.baseUrl + '/as/authorization-challenge';
}

function oauthError(response: Response, status: number, error: string, description: string, extra?: object) {
    return sendErrorResponse(response, status, { error, error_description: description, ...(extra ?? {}) });
}

export async function authorizationChallenge(issuer: Issuer, request: Request, response: Response) {
    response.set({ 'Cache-Control': 'no-store', Pragma: 'no-cache' });
    try {
        const settings = issuer.embeddedASSettings();
        if (!settings) {
            return oauthError(response, 404, 'invalid_request', 'Not found');
        }
        if (request.body?.auth_session) {
            return await secondCall(issuer, settings, request, response);
        }
        return await firstCall(issuer, settings, request, response);
    }
    catch (e) {
        if (e instanceof DPoPNonceRequiredError) {
            return sendDpopNonceResponse(response, 400, e.nonce);
        }
        return sendErrorResponse(response, 500, { error: 'server_error', error_description: 'Internal server error' }, e);
    }
}

async function dpopHeaders(issuer: Issuer, response: Response, jkt?: string) {
    if (jkt) {
        response.set('DPoP-Nonce', await issueDpopNonce(issuer));
    }
}

async function firstCall(issuer: Issuer, settings: EmbeddedASSettings, request: Request, response: Response) {
    const body = request.body ?? {};
    const session = await findSessionForPresentation(issuer, settings, body.issuer_state);
    if (!session) {
        // do not reveal which condition failed
        return oauthError(response, 400, 'invalid_request', 'Invalid request');
    }

    if (!validAuthorizationDetails(session, body.authorization_details)) {
        return oauthError(response, 400, 'invalid_authorization_details', 'Invalid authorization_details');
    }

    if (typeof body.code_challenge != 'string' || !body.code_challenge.length || body.code_challenge_method !== 'S256') {
        return oauthError(response, 400, 'invalid_request', 'PKCE with S256 is required');
    }

    let clientId: string | undefined;
    if (body.client_id !== undefined) {
        // the wallet does not need to send a client_id, but if it does, it has to be a known one
        if (typeof body.client_id != 'string' || !settings.clients.some((c) => c.clientId === body.client_id)) {
            return oauthError(response, 400, 'invalid_client', 'Unknown client');
        }
        clientId = body.client_id;
    }

    const dpop = await checkDpop(issuer, request, challengeUrl(issuer));
    if (dpop.error) {
        return oauthError(response, 400, 'invalid_dpop_proof', dpop.error);
    }

    if (settings.mode == 'redirect') {
        return oauthError(response, 400, 'redirect_to_web', 'Use the authorization endpoint');
    }

    let started;
    try {
        started = await startPresentation(issuer, settings, session, { codeChallenge: body.code_challenge, clientId, dpopJkt: dpop.jkt });
    }
    catch {
        return oauthError(response, 500, 'server_error', 'Could not start the presentation');
    }

    await dpopHeaders(issuer, response, dpop.jkt);
    return oauthError(response, 403, 'insufficient_authorization', 'Presentation required before issuance', {
        auth_session: started.authSession,
        presentation: started.offer.requestUri,
        expires_in: remainingSeconds(started.expiresAt)
    });
}

async function secondCall(issuer: Issuer, settings: EmbeddedASSettings, request: Request, response: Response) {
    const body = request.body ?? {};
    const parsed = parseCompositeValue(body.auth_session);
    const session: Session | null = parsed ? await findSession(issuer, parsed.uuid) : null;
    const presentation = session?.data?.authorization?.presentation;

    if (!session || !parsed || !presentation || !safeEqual(presentation.authSessionHash, parsed.hash)
        || Date.now() > presentation.expiresAt || sessionHasExpired(session)
        || session.data.status != CredentialOfferStatus.PRESENTATION_REQUESTED) {
        return oauthError(response, 400, 'invalid_session', 'Invalid session');
    }

    const dpop = await checkDpop(issuer, request, challengeUrl(issuer), presentation.dpopJkt);
    if (dpop.error) {
        return oauthError(response, 400, 'invalid_dpop_proof', dpop.error);
    }

    const completion = await completePresentation(issuer, settings, session, {
        sessionValue: body.presentation_during_issuance_session,
        requireSessionValue: true
    });

    switch (completion.kind) {
        case 'pending':
            await dpopHeaders(issuer, response, presentation.dpopJkt);
            return oauthError(response, 403, 'insufficient_authorization', 'Presentation not yet received', {
                auth_session: body.auth_session,
                interval: POLL_INTERVAL,
                expires_in: remainingSeconds(presentation.expiresAt)
            });
        case 'server_error':
            return oauthError(response, 500, 'server_error', 'Could not check the presentation');
        case 'denied':
            return oauthError(response, 400, 'access_denied', 'The presentation was not accepted');
        case 'invalid':
            return oauthError(response, 400, 'invalid_session', 'Invalid session');
        default:
            await dpopHeaders(issuer, response, presentation.dpopJkt);
            return response.status(200).json({ authorization_code: completion.code });
    }
}
