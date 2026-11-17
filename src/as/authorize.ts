import { randomBytes } from 'node:crypto';
import { Request, Response } from 'express';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { CredentialOfferStatus } from '#root/types/api';
import { EmbeddedASSettings } from '#root/as/config';
import { POLL_INTERVAL } from '#root/as/constants';
import { contentSecurityPolicy, renderAuthorizePage, renderMessagePage } from '#root/as/authorizePage';
import { completePresentation, findSessionForPresentation, startPresentation, validAuthorizationDetails } from '#root/as/presentation';
import { checkVerifierOffer } from '#root/as/verifierClient';
import { findSession, parseCompositeValue, safeEqual, sessionHasExpired } from '#root/as/util';

// The redirect flow, see doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md, 3.2 and 4.1:
//   GET /as/authorize, GET /as/authorize/status and GET /as/continue

const COOKIE_NAME = 'as_session';
const JKT_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export function continueUrl(issuer: Issuer): string {
    return issuer.options.baseUrl + '/as/continue';
}

function cookiePath(issuer: Issuer): string {
    try {
        return new URL(issuer.options.baseUrl).pathname.replace(/\/+$/, '') + '/as';
    }
    catch {
        return '/';
    }
}

function setCookie(issuer: Issuer, response: Response, value: string, maxAgeSeconds: number) {
    const secure = issuer.options.baseUrl.startsWith('https:') ? '; Secure' : '';
    response.append('Set-Cookie', `${COOKIE_NAME}=${value}; HttpOnly; SameSite=Lax; Path=${cookiePath(issuer)}; Max-Age=${maxAgeSeconds}${secure}`);
}

function readCookie(request: Request): string | undefined {
    for (const part of (request.header('Cookie') ?? '').split(';')) {
        const idx = part.indexOf('=');
        if (idx > 0 && part.substring(0, idx).trim() == COOKIE_NAME) {
            return part.substring(idx + 1).trim();
        }
    }
    return undefined;
}

function noStore(response: Response) {
    response.set({
        'Cache-Control': 'no-store',
        Pragma: 'no-cache',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff'
    });
}

function page(response: Response, status: number, title: string, message: string, refreshUrl?: string) {
    noStore(response);
    response.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'");
    return response.status(status).type('html').send(renderMessagePage(title, message, refreshUrl));
}

/**
 * Errors are returned to the validated redirect_uri of the wallet
 */
function redirectWithError(response: Response, redirectUri: string, state: string | undefined, error: string, description: string) {
    const url = new URL(redirectUri);
    url.searchParams.set('error', error);
    url.searchParams.set('error_description', description);
    if (state !== undefined) {
        url.searchParams.set('state', state);
    }
    noStore(response);
    return response.redirect(302, url.toString());
}

function str(value: unknown): string | undefined {
    return typeof value == 'string' ? value : undefined;
}

export async function authorize(issuer: Issuer, request: Request, response: Response) {
    try {
        const settings = issuer.embeddedASSettings();
        if (!settings || settings.mode == 'in-app') {
            return page(response, 404, 'Not found', 'This endpoint is not available.');
        }
        const query = request.query ?? {};

        // client_id and redirect_uri first: if they are invalid, we never redirect
        const clientId = str(query.client_id);
        const redirectUri = str(query.redirect_uri);
        const client = settings.clients.find((c) => c.clientId === clientId);
        if (!client || !redirectUri || !client.redirectUris.includes(redirectUri)) {
            return page(response, 400, 'Invalid request', 'The client or the redirect URI is not known.');
        }
        const state = str(query.state);
        if (state !== undefined && state.length > 512) {
            return page(response, 400, 'Invalid request', 'The state is too long.');
        }
        const fail = (error: string, description: string) => redirectWithError(response, redirectUri, state, error, description);

        if (query.response_type !== 'code') {
            return fail('unsupported_response_type', 'Only response_type code is supported');
        }
        const session = await findSessionForPresentation(issuer, settings, query.issuer_state);
        if (!session) {
            return fail('invalid_request', 'Invalid request');
        }
        if (!validAuthorizationDetails(session, query.authorization_details)) {
            return fail('invalid_authorization_details', 'Invalid authorization_details');
        }
        const codeChallenge = str(query.code_challenge);
        if (!codeChallenge || query.code_challenge_method !== 'S256') {
            return fail('invalid_request', 'PKCE with S256 is required');
        }
        const dpopJkt = str(query.dpop_jkt);
        if (dpopJkt !== undefined && !JKT_PATTERN.test(dpopJkt)) {
            return fail('invalid_request', 'Invalid dpop_jkt');
        }

        let started;
        try {
            started = await startPresentation(issuer, settings, session, {
                codeChallenge, clientId, redirectUri, state, dpopJkt,
                verifierRedirectUri: continueUrl(issuer)
            });
        }
        catch {
            return fail('server_error', 'Could not start the presentation');
        }

        const nonce = randomBytes(16).toString('base64url');
        const html = await renderAuthorizePage(
            started.offer.requestUri,
            issuer.options.baseUrl + '/as/authorize/status',
            continueUrl(issuer),
            nonce
        );
        noStore(response);
        setCookie(issuer, response, started.browserSecret, Math.max(1, Math.floor((started.expiresAt - Date.now()) / 1000)));
        response.set('Content-Security-Policy', contentSecurityPolicy(nonce));
        return response.status(200).type('html').send(html);
    }
    catch (e) {
        console.error('Caught exception in authorize', e);
        return page(response, 500, 'Error', 'Something went wrong.');
    }
}

/**
 * The session that the browser cookie belongs to, if it is still waiting for the presentation
 */
async function sessionOfBrowser(issuer: Issuer, request: Request): Promise<Session | null> {
    const parsed = parseCompositeValue(readCookie(request));
    const session = parsed ? await findSession(issuer, parsed.uuid) : null;
    const presentation = session?.data?.authorization?.presentation;
    if (!session || !parsed || !presentation || !presentation.browserHash || !safeEqual(presentation.browserHash, parsed.hash)
        || Date.now() > presentation.expiresAt || sessionHasExpired(session)
        || session.data.status != CredentialOfferStatus.PRESENTATION_REQUESTED) {
        return null;
    }
    return session;
}

/**
 * Polled by the page of the cross-device flow, to find out when the wallet has answered
 */
export async function authorizeStatus(issuer: Issuer, request: Request, response: Response) {
    noStore(response);
    try {
        const settings = issuer.embeddedASSettings();
        const session = settings ? await sessionOfBrowser(issuer, request) : null;
        if (!settings || !session) {
            return response.status(400).json({ error: 'invalid_session' });
        }
        const presentation = session.data.authorization.presentation;
        if (Date.now() - (presentation.lastPolledAt ?? 0) < POLL_INTERVAL * 1000) {
            return response.status(200).json({ ready: false });
        }
        presentation.lastPolledAt = Date.now();
        await issuer.storeSession(session);
        const check = await checkVerifierOffer(settings, presentation.verifierState);
        return response.status(200).json({ ready: check.status == 'RESPONSE_RECEIVED' });
    }
    catch (e) {
        console.error('Caught exception in authorize status', (e as Error).message);
        return response.status(500).json({ error: 'server_error' });
    }
}

/**
 * The target of the redirect_uri of the verifier (same device) and of the page (cross-device). The browser
 * cookie is required in both cases; if the wallet redirected the browser, the response_code must match as well.
 */
export async function authorizeContinue(issuer: Issuer, request: Request, response: Response) {
    try {
        const settings: EmbeddedASSettings | null = issuer.embeddedASSettings();
        const session = settings ? await sessionOfBrowser(issuer, request) : null;
        if (!settings || !session) {
            return page(response, 400, 'Invalid request', 'This session is not valid or has expired. Please start again in your wallet.');
        }
        const authorization = session.data.authorization;
        const responseCode = request.query?.response_code;
        if (responseCode !== undefined && typeof responseCode != 'string') {
            return page(response, 400, 'Invalid request', 'Invalid response code.');
        }

        const completion = await completePresentation(issuer, settings, session, { requireSessionValue: false, responseCode });
        switch (completion.kind) {
            case 'pending':
                return page(response, 200, 'Waiting', 'We have not received your answer yet. This page retries automatically.', continueUrl(issuer) + (responseCode ? '?response_code=' + encodeURIComponent(responseCode) : ''));
            case 'server_error':
                return page(response, 500, 'Error', 'The presentation could not be checked. Please try again.');
            case 'invalid':
                return page(response, 400, 'Invalid request', 'This session is not valid or has expired. Please start again in your wallet.');
            case 'denied':
                setCookie(issuer, response, '', 0);
                return redirectWithError(response, authorization.redirectUri, authorization.state, 'access_denied', 'The presentation was not accepted');
            default: {
                const url = new URL(authorization.redirectUri);
                url.searchParams.set('code', completion.code);
                if (authorization.state !== undefined) {
                    url.searchParams.set('state', authorization.state);
                }
                setCookie(issuer, response, '', 0);
                noStore(response);
                return response.redirect(302, url.toString());
            }
        }
    }
    catch (e) {
        console.error('Caught exception in authorize continue', e);
        return page(response, 500, 'Error', 'Something went wrong.');
    }
}
