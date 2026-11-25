import { vi, expect, test, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { Session } from '#root/database/entities/index';
import { authorize, authorizeContinue, authorizeStatus } from '../authorize';
import { asToken } from '../token';
import { authorizationChallenge } from '../challenge';

vi.mock('../verifierClient', () => ({ createVerifierOffer: vi.fn(), checkVerifierOffer: vi.fn() }));
import { createVerifierOffer, checkVerifierOffer } from '../verifierClient';

const BASE = 'https://issuer.example/tenant';
const dcql = { credentials: [{ id: 'PID', format: 'dc+sd-jwt', claims: [{ path: ['given_name'] }] }] };
const REDIRECT = 'https://w/cb';
const codeVerifier = 'v'.repeat(50);
const challenge = createHash('sha256').update(codeVerifier).digest('base64url');
const details = JSON.stringify([{ type: 'openid_credential', credential_configuration_id: 'A' }]);
const RESPONSE_CODE = 'response-code-from-the-verifier';

const verifierChecks = (extra: any = {}) => ({
    status: 'RESPONSE_RECEIVED',
    result: {
        credentials: { PID: [{ claims: { given_name: 'Anna' }, issuer: 'did:iss' }] },
        messages: [{ code: 'JWT_VERIFIED' }],
        presentationDuringIssuanceSession: 'session-value',
        responseCode: RESPONSE_CODE,
        ...extra
    }
});

function newIssuer(options: any = {}, uuid = 'sess1') {
    const session = new Session();
    session.id = 1;
    session.uuid = uuid;
    session.state = 'issuer-state-1';
    session.expirationDate = new Date(Date.now() + 3600_000);
    session.data = {
        status: 'OFFER_CREATED',
        credentialOffer: { grants: { authorization_code: { issuer_state: 'issuer-state-1' } }, credential_configuration_ids: ['A'] },
        credentialDataSets: { 'A#0': { id: 'A#0', credentialId: 'A', data: {} } },
        authorization: { presentation: { dcql } }
    } as any;
    const claimed = new Set<string>();
    return {
        name: 'issuer',
        options: { baseUrl: BASE, did: 'did:example:issuer' },
        metadata: { credential_configurations_supported: { A: { scope: 'scopeA' }, B: { scope: 'scopeB' } } },
        usesNonces: false,
        did: { did: 'did:example:issuer' },
        session,
        signToken: vi.fn(async (jwt: any) => 'signed:' + JSON.stringify(jwt.payload)),
        usesEmbeddedAS: () => true,
        embeddedASIdentifier: () => BASE + '/as',
        embeddedASSettings: () => ({
            mode: 'both', authSessionTtl: 86400, codeTtl: 60,
            clients: [{ clientId: 'wallet', redirectUris: [REDIRECT, 'https://w/cb2'] }, { clientId: 'other', redirectUris: ['https://o/cb'] }],
            verifierUrl: 'https://verifier.example/v', verifierToken: 'tok', ...options
        }),
        getSessionByState: vi.fn(async (state: string) => state == session.state ? session : null),
        sessionData: { get: vi.fn(async (u: string) => u == session.uuid ? session : { uuid: 'other' }) },
        storeSession: vi.fn(async () => {}),
        storeRequestResponseData: vi.fn(async () => {}),
        asClaims: { claim: vi.fn(async (id: string) => { if (claimed.has(id)) { return false; } claimed.add(id); return true; }) },
    } as any;
}

function response() {
    const res: any = { statusCode: 200, headers: {}, headersSent: false, cookies: [] };
    res.set = (a: any, b?: any) => { if (typeof a == 'string') { res.headers[a] = b; } else { Object.assign(res.headers, a); } return res; };
    res.append = (name: string, value: string) => { if (name == 'Set-Cookie') { res.cookies.push(value); } return res; };
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.type = () => res;
    res.send = (b: any) => { res.body = b; return res; };
    res.json = (b: any) => { res.body = b; return res; };
    res.redirect = (c: number, url: string) => { res.statusCode = c; res.location = url; return res; };
    return res;
}

const query = (extra: any = {}) => ({
    response_type: 'code', client_id: 'wallet', redirect_uri: REDIRECT, issuer_state: 'issuer-state-1', state: 'wallet-state',
    code_challenge: challenge, code_challenge_method: 'S256', authorization_details: details, ...extra
});
const getReq = (q: any, cookie?: string) => ({ query: q, header: (n: string) => n == 'Cookie' ? cookie : undefined }) as any;
const cookieOf = (res: any) => /as_session=([^;]*)/.exec(res.cookies[0])![1];

async function start(issuer: any, extra: any = {}) {
    const res = response();
    await authorize(issuer, getReq(query(extra)), res);
    return res;
}

beforeEach(() => {
    vi.clearAllMocks();
    (createVerifierOffer as any).mockResolvedValue({ state: 'vstate', requestUri: 'openid4vp://?request_uri=x&client_id=y', checkUri: 'https://v/check' });
    (checkVerifierOffer as any).mockResolvedValue(verifierChecks());
});

test('authorize shows the request and sets a cookie that is bound to the browser', async () => {
    const issuer = newIssuer();
    const res = await start(issuer);
    expect(res.statusCode).toBe(200);
    expect(res.body).toContain('<svg');
    expect(res.body).toContain('href="openid4vp://?request_uri=x&amp;client_id=y"');
    expect(res.headers['Content-Security-Policy']).toContain("script-src 'nonce-");
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(res.cookies[0]).toMatch(/^as_session=sess1\..+; HttpOnly; SameSite=Lax; Path=\/tenant\/as; Max-Age=\d+; Secure$/);
    expect(createVerifierOffer).toHaveBeenCalledWith(expect.anything(), dcql, BASE + '/as/continue');
    expect(issuer.session.data.status).toBe('PRESENTATION_REQUESTED');
    expect(issuer.session.data.authorization.redirectUri).toBe(REDIRECT);
    expect(issuer.session.data.authorization.clientId).toBe('wallet');
    expect(issuer.session.data.authorization.state).toBe('wallet-state');
    // only hashes are stored
    expect(JSON.stringify(issuer.session.data)).not.toContain(cookieOf(res).split('.')[1]);
});

test('authorize never redirects to an unknown client or an unregistered redirect_uri', async () => {
    const issuer = newIssuer();
    for (const extra of [
        { client_id: 'unknown' }, { client_id: undefined }, { redirect_uri: 'https://evil/cb' }, { redirect_uri: undefined },
        { redirect_uri: 'https://o/cb' },           // the redirect URI of another client
        { redirect_uri: REDIRECT + '/' }, { redirect_uri: 'https://w/CB' }
    ]) {
        const res = await start(issuer, extra);
        expect(res.statusCode).toBe(400);
        expect(res.location).toBeUndefined();
    }
    expect(createVerifierOffer).not.toHaveBeenCalled();
});

test('other errors are returned to the validated redirect_uri, with the state', async () => {
    const issuer = newIssuer();
    for (const [extra, error] of [
        [{ response_type: 'token' }, 'unsupported_response_type'],
        [{ issuer_state: 'unknown' }, 'invalid_request'],
        [{ code_challenge: undefined }, 'invalid_request'],
        [{ code_challenge_method: 'plain' }, 'invalid_request'],
        [{ authorization_details: 'not json' }, 'invalid_authorization_details'],
        [{ authorization_details: undefined, scope: 'scopeB' }, 'invalid_authorization_details'],
        [{ dpop_jkt: 'not-a-thumbprint' }, 'invalid_request'],
    ] as [any, string][]) {
        const res = await start(issuer, extra);
        expect(res.statusCode).toBe(302);
        const url = new URL(res.location);
        expect(url.origin + url.pathname).toBe(REDIRECT);
        expect(url.searchParams.get('error')).toBe(error);
        expect(url.searchParams.get('state')).toBe('wallet-state');
    }
    (createVerifierOffer as any).mockRejectedValueOnce(new Error('boom'));
    const down = await start(issuer);
    expect(new URL(down.location).searchParams.get('error')).toBe('server_error');
});

test('authorize is not available in the in-app mode', async () => {
    const res = await start(newIssuer({ mode: 'in-app' }));
    expect(res.statusCode).toBe(404);
});

test('same device: the wallet redirects the browser with the response_code, and the browser gets the code', async () => {
    const issuer = newIssuer();
    const cookie = 'as_session=' + cookieOf(await start(issuer));
    issuer.session.data.authorization.presentation.lastCheckedAt = 0;
    const res = response();
    await authorizeContinue(issuer, getReq({ response_code: RESPONSE_CODE }, cookie), res);
    expect(res.statusCode).toBe(302);
    const url = new URL(res.location);
    expect(url.origin + url.pathname).toBe(REDIRECT);
    expect(url.searchParams.get('state')).toBe('wallet-state');
    expect(url.searchParams.get('code')).toMatch(/^sess1\./);
    expect(issuer.session.data.status).toBe('PRESENTATION_VERIFIED');
    expect(issuer.session.data.presentationData).toEqual({ PID: { given_name: 'Anna' } });
    expect(res.cookies[0]).toContain('Max-Age=0');

    // the redirect leads to a token
    const token = response();
    await asToken(issuer, { body: { grant_type: 'authorization_code', code: url.searchParams.get('code'), code_verifier: codeVerifier, client_id: 'wallet', redirect_uri: REDIRECT }, header: () => undefined } as any, token);
    expect(token.statusCode).toBe(200);
    expect(JSON.parse(token.body.access_token.substring(7)).client_id).toBe('wallet');

    // a second use of the same session is refused
    const again = response();
    await authorizeContinue(issuer, getReq({ response_code: RESPONSE_CODE }, cookie), again);
    expect(again.statusCode).toBe(400);
});

test('the response_code alone is not enough: the browser cookie is required', async () => {
    const issuer = newIssuer();
    const cookie = 'as_session=' + cookieOf(await start(issuer));
    issuer.session.data.authorization.presentation.lastCheckedAt = 0;
    for (const header of [undefined, 'other=1', 'as_session=sess1.nonsense', 'as_session=nonsense', 'as_session=unknown.' + cookie.split('.')[1]]) {
        const res = response();
        await authorizeContinue(issuer, getReq({ response_code: RESPONSE_CODE }, header), res);
        expect(res.statusCode).toBe(400);
        expect(res.location).toBeUndefined();
    }
    expect(checkVerifierOffer).not.toHaveBeenCalled();
});

test('a wrong response_code is refused, and a cookie of another session is not accepted', async () => {
    const issuer = newIssuer();
    const cookie = 'as_session=' + cookieOf(await start(issuer));
    issuer.session.data.authorization.presentation.lastCheckedAt = 0;
    const wrong = response();
    await authorizeContinue(issuer, getReq({ response_code: 'wrong' }, cookie), wrong);
    expect(wrong.statusCode).toBe(400);
    expect(wrong.location).toBeUndefined();

    // the secret of another session cannot be used for this one
    const other = newIssuer({}, 'sess2');
    const otherCookie = 'as_session=' + cookieOf(await start(other));
    const mixed = response();
    await authorizeContinue(issuer, getReq({ response_code: RESPONSE_CODE }, otherCookie), mixed);
    expect(mixed.statusCode).toBe(400);
});

test('cross device: the browser that shows the QR code continues with the cookie only', async () => {
    const issuer = newIssuer();
    const cookie = 'as_session=' + cookieOf(await start(issuer));

    // the page polls
    const poll = response();
    await authorizeStatus(issuer, getReq({}, cookie), poll);
    expect(poll.body).toEqual({ ready: true });
    // and is throttled
    const quick = response();
    await authorizeStatus(issuer, getReq({}, cookie), quick);
    expect(quick.body).toEqual({ ready: false });
    const noCookie = response();
    await authorizeStatus(issuer, getReq({}), noCookie);
    expect(noCookie.statusCode).toBe(400);

    const res = response();
    await authorizeContinue(issuer, getReq({}, cookie), res);
    expect(res.statusCode).toBe(302);
    expect(new URL(res.location).searchParams.get('code')).toMatch(/^sess1\./);
});

test('continue waits while the wallet has not answered, and denies a rejected presentation', async () => {
    const issuer = newIssuer();
    const cookie = 'as_session=' + cookieOf(await start(issuer));
    (checkVerifierOffer as any).mockResolvedValueOnce({ status: 'AUTHORIZATION_REQUEST_RETRIEVED' });
    const waiting = response();
    await authorizeContinue(issuer, getReq({}, cookie), waiting);
    expect(waiting.statusCode).toBe(200);
    expect(waiting.body).toContain('http-equiv="refresh"');

    issuer.session.data.authorization.presentation.lastCheckedAt = 0;
    (checkVerifierOffer as any).mockResolvedValueOnce(verifierChecks({ messages: [{ code: 'INVALID_VC' }] }));
    const denied = response();
    await authorizeContinue(issuer, getReq({}, cookie), denied);
    expect(denied.statusCode).toBe(302);
    const url = new URL(denied.location);
    expect(url.searchParams.get('error')).toBe('access_denied');
    expect(url.searchParams.get('state')).toBe('wallet-state');
    expect(url.searchParams.get('code')).toBeNull();
    expect(issuer.session.data.status).toBe('AUTHORIZATION_DENIED');
});

test('token endpoint: the redirect_uri and client_id of the authorization request must be repeated', async () => {
    const issuer = newIssuer();
    const cookie = 'as_session=' + cookieOf(await start(issuer));
    issuer.session.data.authorization.presentation.lastCheckedAt = 0;
    const res = response();
    await authorizeContinue(issuer, getReq({ response_code: RESPONSE_CODE }, cookie), res);
    const code = new URL(res.location).searchParams.get('code');
    const call = async (extra: any) => {
        const out = response();
        await asToken(issuer, { body: { grant_type: 'authorization_code', code, code_verifier: codeVerifier, ...extra }, header: () => undefined } as any, out);
        return out;
    };
    expect((await call({ client_id: 'wallet' })).body.error).toBe('invalid_grant');
    expect((await call({ client_id: 'wallet', redirect_uri: 'https://w/cb2' })).body.error).toBe('invalid_grant');
    expect((await call({ redirect_uri: REDIRECT })).body.error).toBe('invalid_client');
    expect((await call({ client_id: 'other', redirect_uri: REDIRECT })).body.error).toBe('invalid_client');
    expect((await call({ client_id: 'wallet', redirect_uri: REDIRECT })).statusCode).toBe(200);
});

test('the in-app flow still works next to the redirect flow', async () => {
    const issuer = newIssuer();
    const first = response();
    await authorizationChallenge(issuer, { body: { issuer_state: 'issuer-state-1', authorization_details: details, code_challenge: challenge, code_challenge_method: 'S256' }, header: () => undefined } as any, first);
    expect(first.statusCode).toBe(403);
    expect(first.body.auth_session).toMatch(/^sess1\./);
    // the in-app flow does not use the verifier redirect
    expect(createVerifierOffer).toHaveBeenCalledWith(expect.anything(), dcql, undefined);
});
