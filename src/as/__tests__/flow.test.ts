import { vi, expect, test, beforeEach } from 'vitest';
import { createHash } from 'node:crypto';
import { SignJWT, exportJWK, generateKeyPair, calculateJwkThumbprint } from 'jose';
import { Session } from '#root/database/entities/index';
import { authorizationChallenge } from '../challenge';
import { asToken } from '../token';
import { embeddedASMetadata } from '../metadata';

vi.mock('../verifierClient', () => ({ createVerifierOffer: vi.fn(), checkVerifierOffer: vi.fn() }));
import { createVerifierOffer, checkVerifierOffer } from '../verifierClient';

const BASE = 'https://issuer.example/tenant';
const dcql = { credentials: [{ id: 'PID', format: 'dc+sd-jwt', claims: [{ path: ['given_name'] }] }] };
const verifier = '1234567890-verifier-session-value';
const verifierChecks = (extra: any = {}) => ({
    status: 'RESPONSE_RECEIVED',
    result: {
        credentials: { PID: [{ claims: { given_name: 'Anna' }, issuer: 'did:iss', holder: 'did:h' }] },
        messages: [{ code: 'JWT_VERIFIED' }],
        presentationDuringIssuanceSession: verifier,
        ...extra
    }
});

function pkce() {
    const verifier = 'v'.repeat(50);
    return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
}

function newIssuer(options: any = {}) {
    const session = new Session();
    session.id = 1;
    session.uuid = 'sess1';
    session.state = 'issuer-state-1';
    session.expirationDate = new Date(Date.now() + 3600_000);
    session.data = {
        status: 'OFFER_CREATED',
        credentialOffer: { grants: { authorization_code: { issuer_state: 'issuer-state-1' } }, credential_configuration_ids: ['A'] },
        credentialDataSets: { 'A#0': { id: 'A#0', credentialId: 'A', data: {} } },
        authorization: { presentation: { dcql } }
    } as any;
    const claimed = new Set<string>();
    const nonces = new Set<string>();
    const jtis = new Set<string>();
    const issuer: any = {
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
            clients: [{ clientId: 'wallet', redirectUris: ['https://w/cb'] }],
            verifierUrl: 'https://verifier.example/v', verifierToken: 'tok', ...options
        }),
        getSessionByState: vi.fn(async (state: string) => state == session.state ? session : null),
        sessionData: { get: vi.fn(async (uuid: string) => uuid == session.uuid ? session : { uuid: 'other' }) },
        storeSession: vi.fn(async () => {}),
        storeRequestResponseData: vi.fn(async () => {}),
        asClaims: { claim: vi.fn(async (id: string) => { if (claimed.has(id)) { return false; } claimed.add(id); return true; }) },
        dpopNonceStates: {
            get: vi.fn(async () => { const uuid = 'nonce' + nonces.size; nonces.add(uuid); return { uuid }; }),
            consume: vi.fn(async (n: string) => nonces.delete(n))
        },
        dpopJtiStates: { claim: vi.fn(async (j: string) => { if (jtis.has(j)) { return false; } jtis.add(j); return true; }) },
    };
    return issuer;
}

function response() {
    const res: any = { statusCode: 200, headers: {}, headersSent: false };
    res.set = (a: any, b?: any) => { if (typeof a == 'string') { res.headers[a] = b; } else { Object.assign(res.headers, a); } return res; };
    res.header = res.set;
    res.status = (c: number) => { res.statusCode = c; return res; };
    res.json = (b: any) => { res.body = b; return res; };
    res.end = (b: any) => { res.body = b; return res; };
    return res;
}

const req = (body: any, headers: any = {}) => ({ body, header: (n: string) => headers[n] }) as any;
const details = JSON.stringify([{ type: 'openid_credential', credential_configuration_id: 'A' }]);

async function start(issuer: any, extra: any = {}, headers: any = {}) {
    const { challenge } = pkce();
    const res = response();
    await authorizationChallenge(issuer, req({
        issuer_state: 'issuer-state-1', authorization_details: details,
        code_challenge: challenge, code_challenge_method: 'S256', ...extra
    }, headers), res);
    return res;
}

async function complete(issuer: any, authSession: string, extra: any = {}, headers: any = {}) {
    issuer.session.data.authorization.presentation.lastCheckedAt = 0;
    const res = response();
    await authorizationChallenge(issuer, req({ auth_session: authSession, presentation_during_issuance_session: verifier, ...extra }, headers), res);
    return res;
}

beforeEach(() => {
    vi.clearAllMocks();
    (createVerifierOffer as any).mockResolvedValue({ state: 'vstate', requestUri: 'openid4vp://?request_uri=x', checkUri: 'https://v/check' });
    (checkVerifierOffer as any).mockResolvedValue(verifierChecks());
});

test('metadata of the embedded authorization server', () => {
    const md: any = embeddedASMetadata(newIssuer());
    expect(md.issuer).toBe(BASE + '/as');
    expect(md.authorization_challenge_endpoint).toBe(BASE + '/as/authorization-challenge');
    expect(md.token_endpoint).toBe(BASE + '/as/token');
    expect(md.authorization_endpoint).toBe(BASE + '/as/authorize');
    expect(md.code_challenge_methods_supported).toEqual(['S256']);
    expect(md.dpop_signing_alg_values_supported).toEqual(['ES256']);
});

test('the complete in-app flow, from challenge to access token', async () => {
    const issuer = newIssuer();
    const { verifier: codeVerifier, challenge } = pkce();

    const first = await start(issuer);
    expect(first.statusCode).toBe(403);
    expect(first.body.error).toBe('insufficient_authorization');
    expect(first.body.presentation).toBe('openid4vp://?request_uri=x');
    expect(first.body.auth_session).toMatch(/^sess1\./);
    expect(createVerifierOffer).toHaveBeenCalledWith(expect.anything(), dcql, undefined);
    expect(issuer.session.data.status).toBe('PRESENTATION_REQUESTED');
    // only the hash of the auth_session is stored
    expect(JSON.stringify(issuer.session.data)).not.toContain(first.body.auth_session.split('.')[1]);

    // the wallet is early
    (checkVerifierOffer as any).mockResolvedValueOnce({ status: 'AUTHORIZATION_REQUEST_RETRIEVED' });
    const early = await complete(issuer, first.body.auth_session);
    expect(early.statusCode).toBe(403);
    expect(early.body.error).toBe('insufficient_authorization');
    expect(early.body.interval).toBeGreaterThan(0);
    expect(early.body.auth_session).toBe(first.body.auth_session);

    // polling too quickly does not reach the verifier
    (checkVerifierOffer as any).mockClear();
    const quick = await authorizationChallenge(issuer, req({ auth_session: first.body.auth_session, presentation_during_issuance_session: verifier }), response());
    expect(checkVerifierOffer).not.toHaveBeenCalled();
    expect(quick).toBeDefined();

    const done = await complete(issuer, first.body.auth_session);
    expect(done.statusCode).toBe(200);
    expect(done.body.authorization_code).toMatch(/^sess1\./);
    expect(issuer.session.data.status).toBe('PRESENTATION_VERIFIED');
    expect(issuer.session.data.presentationData).toEqual({ PID: { given_name: 'Anna' } });
    expect(issuer.session.data.presentationMeta.PID.issuer).toBe('did:iss');

    // the auth_session is single-use
    const again = await complete(issuer, first.body.auth_session);
    expect(again.statusCode).toBe(400);
    expect(again.body.error).toBe('invalid_session');

    // token
    const tokenRes = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code: done.body.authorization_code, code_verifier: codeVerifier }), tokenRes);
    expect(tokenRes.statusCode).toBe(200);
    expect(tokenRes.body.token_type).toBe('bearer');
    expect(tokenRes.body.authorization_details[0].credential_identifiers).toEqual(['A#0']);
    const payload = JSON.parse(tokenRes.body.access_token.substring('signed:'.length));
    expect(payload.iss).toBe(BASE + '/as');
    expect(payload.aud).toBe(BASE);
    expect(payload.issuer_state).toBe('issuer-state-1');
    expect(payload.jti).toBeTruthy();
    expect(payload.exp - payload.iat).toBe(1800);
    // no personal data in the token
    expect(tokenRes.body.access_token).not.toContain('Anna');
    expect(challenge).toBeTruthy();

    // the code is single-use
    const second = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code: done.body.authorization_code, code_verifier: codeVerifier }), second);
    expect(second.statusCode).toBe(400);
});

test('a first call is refused for unknown or unsuitable sessions, without telling why', async () => {
    const bad = [
        { issuer_state: 'unknown' },
        { issuer_state: undefined },
    ];
    for (const extra of bad) {
        const res = await start(newIssuer(), extra);
        expect(res.statusCode).toBe(400);
        expect(res.body.error).toBe('invalid_request');
    }
    const noQuery = newIssuer(); delete noQuery.session.data.authorization;
    expect((await start(noQuery)).statusCode).toBe(400);
    const preAuth = newIssuer(); preAuth.session.data.credentialOffer.grants = { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': {} };
    expect((await start(preAuth)).statusCode).toBe(400);
    const expired = newIssuer(); expired.session.expirationDate = new Date(Date.now() - 1000);
    expect((await start(expired)).statusCode).toBe(400);
    const issued = newIssuer(); issued.session.data.status = 'PRESENTATION_VERIFIED';
    expect((await start(issued)).statusCode).toBe(400);
    // no verifierToken: the AS cannot start a verification
    expect((await start(newIssuer({ verifierToken: undefined }))).statusCode).toBe(400);
    expect(createVerifierOffer).not.toHaveBeenCalled();
});

test('scope instead of authorization_details (as the @openid4vc libraries send it)', async () => {
    for (const extra of [
        { authorization_details: undefined, scope: 'scopeA' },
        { authorization_details: undefined, scope: 'openid scopeA' },
        { authorization_details: undefined, scope: 'unknown' },
        { authorization_details: undefined },
        { authorization_details: '', scope: '' },
    ]) {
        const res = await start(newIssuer(), extra);
        expect(res.statusCode).toBe(403);
        expect(res.body.error).toBe('insufficient_authorization');
    }
});

test('PKCE, authorization_details and client_id are checked on the first call', async () => {
    const issuer = newIssuer();
    expect((await start(issuer, { code_challenge: undefined })).statusCode).toBe(400);
    expect((await start(issuer, { code_challenge_method: 'plain' })).statusCode).toBe(400);
    const other = await start(issuer, { authorization_details: JSON.stringify([{ type: 'openid_credential', credential_configuration_id: 'Z' }]) });
    expect(other.body.error).toBe('invalid_authorization_details');
    expect((await start(issuer, { authorization_details: 'not json' })).body.error).toBe('invalid_authorization_details');
    // a scope of a configuration outside the offer is refused
    expect((await start(issuer, { authorization_details: undefined, scope: 'scopeB' })).body.error).toBe('invalid_authorization_details');
    expect((await start(issuer, { authorization_details: undefined, scope: 'scopeA scopeB' })).body.error).toBe('invalid_authorization_details');
    const client = await start(issuer, { client_id: 'unknown' });
    expect(client.body.error).toBe('invalid_client');
    // a known client_id is accepted, and not sending one is accepted too
    expect((await start(issuer, { client_id: 'wallet' })).statusCode).toBe(403);
    expect((await start(issuer)).statusCode).toBe(403);
});

test('redirect only mode answers redirect_to_web', async () => {
    const res = await start(newIssuer({ mode: 'redirect' }));
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('redirect_to_web');
    expect(createVerifierOffer).not.toHaveBeenCalled();
});

test('a verifier that cannot create the request fails the call and denies the session', async () => {
    (createVerifierOffer as any).mockRejectedValueOnce(new Error('boom'));
    const issuer = newIssuer();
    const res = await start(issuer);
    expect(res.statusCode).toBe(500);
    expect(issuer.session.data.status).toBe('AUTHORIZATION_DENIED');
});

test('second call: wrong session value, unknown, tampered or expired auth_session', async () => {
    const issuer = newIssuer();
    const first = await start(issuer);
    const wrong = await complete(issuer, first.body.auth_session, { presentation_during_issuance_session: 'nope' });
    expect(wrong.statusCode).toBe(400);
    expect(wrong.body.error).toBe('invalid_session');
    const missing = await complete(issuer, first.body.auth_session, { presentation_during_issuance_session: undefined });
    expect(missing.body.error).toBe('invalid_session');
    expect((await complete(issuer, 'sess1.nonsense')).body.error).toBe('invalid_session');
    expect((await complete(issuer, 'garbage')).body.error).toBe('invalid_session');
    expect((await complete(issuer, 'unknown.value')).body.error).toBe('invalid_session');
    issuer.session.data.authorization.presentation.expiresAt = Date.now() - 1;
    expect((await complete(issuer, first.body.auth_session)).body.error).toBe('invalid_session');
});

test('second call: an expired or removed verifier session is an invalid session', async () => {
    const issuer = newIssuer();
    const first = await start(issuer);
    (checkVerifierOffer as any).mockResolvedValueOnce({});
    expect((await complete(issuer, first.body.auth_session)).body.error).toBe('invalid_session');
});

test('second call: a rejected presentation denies access, once', async () => {
    const issuer = newIssuer();
    const first = await start(issuer);
    (checkVerifierOffer as any).mockResolvedValueOnce(verifierChecks({ messages: [{ code: 'JWT_VERIFIED' }, { code: 'INVALID_VC' }] }));
    const res = await complete(issuer, first.body.auth_session);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe('access_denied');
    expect(issuer.session.data.status).toBe('AUTHORIZATION_DENIED');
    expect(issuer.session.data.presentationData).toBeUndefined();
    expect((await complete(issuer, first.body.auth_session)).body.error).toBe('invalid_session');
    // the wallet can start again
    expect((await start(issuer)).statusCode).toBe(403);
});

test('a second first-call replaces the earlier auth_session', async () => {
    const issuer = newIssuer();
    const one = await start(issuer);
    const two = await start(issuer);
    expect(two.body.auth_session).not.toBe(one.body.auth_session);
    expect((await complete(issuer, one.body.auth_session)).body.error).toBe('invalid_session');
    expect((await complete(issuer, two.body.auth_session)).statusCode).toBe(200);
});

async function issueCode(issuer: any, extra: any = {}, headers: any = {}, challengeOverride?: string) {
    const { verifier: codeVerifier, challenge } = pkce();
    const first = await start(issuer, { code_challenge: challengeOverride ?? challenge, ...extra }, headers);
    const done = await complete(issuer, first.body.auth_session, {}, headers);
    return { code: done.body.authorization_code, codeVerifier, first, done };
}

test('token endpoint: PKCE, grant type, expiry and client_id', async () => {
    const issuer = newIssuer();
    const { code, codeVerifier } = await issueCode(issuer);

    const wrongGrant = response();
    await asToken(issuer, req({ grant_type: 'refresh_token', code }), wrongGrant);
    expect(wrongGrant.body.error).toBe('unsupported_grant_type');

    const wrongPkce = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code, code_verifier: 'x'.repeat(50) }), wrongPkce);
    expect(wrongPkce.body.error).toBe('invalid_grant');
    const noPkce = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code }), noPkce);
    expect(noPkce.body.error).toBe('invalid_grant');

    // a client_id that was not stored is refused
    const client = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, client_id: 'wallet' }), client);
    expect(client.body.error).toBe('invalid_client');

    const tampered = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code: code + 'x', code_verifier: codeVerifier }), tampered);
    expect(tampered.body.error).toBe('invalid_grant');

    // none of the failures used up the code
    const ok = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code, code_verifier: codeVerifier }), ok);
    expect(ok.statusCode).toBe(200);
});

test('token endpoint: the client_id of the challenge must be repeated', async () => {
    const issuer = newIssuer();
    const { code, codeVerifier } = await issueCode(issuer, { client_id: 'wallet' });
    const missing = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code, code_verifier: codeVerifier }), missing);
    expect(missing.body.error).toBe('invalid_client');
    const ok = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code, code_verifier: codeVerifier, client_id: 'wallet' }), ok);
    expect(ok.statusCode).toBe(200);
    expect(JSON.parse(ok.body.access_token.substring(7)).client_id).toBe('wallet');
});

test('token endpoint: an expired code and a parallel use of the code', async () => {
    const issuer = newIssuer();
    const { code, codeVerifier } = await issueCode(issuer);
    issuer.session.data.authorization.code.expiresAt = Date.now() - 1;
    const expired = response();
    await asToken(issuer, req({ grant_type: 'authorization_code', code, code_verifier: codeVerifier }), expired);
    expect(expired.body.error).toBe('invalid_grant');

    const issuer2 = newIssuer();
    const issued = await issueCode(issuer2);
    const results = await Promise.all([1, 2, 3].map(async () => {
        const res = response();
        await asToken(issuer2, req({ grant_type: 'authorization_code', code: issued.code, code_verifier: issued.codeVerifier }), res);
        return res.statusCode;
    }));
    expect(results.filter((s) => s == 200)).toHaveLength(1);
});

async function dpopProof(key: any, jwk: any, htu: string, nonce?: string, jti = Math.random().toString(36)) {
    return await new SignJWT({ htm: 'POST', htu, jti, ...(nonce && { nonce }) })
        .setProtectedHeader({ typ: 'dpop+jwt', alg: 'ES256', jwk })
        .setIssuedAt()
        .sign(key);
}

test('DPoP: the key of the first call binds the auth_session, the code and the access token', async () => {
    const issuer = newIssuer();
    const { privateKey, publicKey } = await generateKeyPair('ES256');
    const jwk = await exportJWK(publicKey);
    const jkt = await calculateJwkThumbprint(jwk);
    const other = await generateKeyPair('ES256');
    const otherJwk = await exportJWK(other.publicKey);
    const url = BASE + '/as/authorization-challenge';

    // the first proof has no nonce: the AS asks for one
    const noNonce = await start(issuer, {}, { DPoP: await dpopProof(privateKey, jwk, url) });
    expect(noNonce.statusCode).toBe(400);
    expect(noNonce.body.error).toBe('use_dpop_nonce');
    const nonce1 = noNonce.headers['DPoP-Nonce'];

    const first = await start(issuer, {}, { DPoP: await dpopProof(privateKey, jwk, url, nonce1) });
    expect(first.statusCode).toBe(403);
    expect(issuer.session.data.authorization.presentation.dpopJkt).toBe(jkt);
    const nonce2 = first.headers['DPoP-Nonce'];
    expect(nonce2).toBeTruthy();

    // the second call needs the same key
    issuer.session.data.authorization.presentation.lastCheckedAt = 0;
    const noProof = response();
    await authorizationChallenge(issuer, req({ auth_session: first.body.auth_session, presentation_during_issuance_session: verifier }), noProof);
    expect(noProof.body.error).toBe('invalid_dpop_proof');
    const wrongKey = response();
    await authorizationChallenge(issuer, req({ auth_session: first.body.auth_session, presentation_during_issuance_session: verifier },
        { DPoP: await dpopProof(other.privateKey, otherJwk, url, nonce2) }), wrongKey);
    expect(wrongKey.body.error).toBe('invalid_dpop_proof');

    // the nonce of the failed attempt is spent; the AS gives a new one with every response
    const fresh = async () => (await issuer.dpopNonceStates.get()).uuid;
    issuer.session.data.authorization.presentation.lastCheckedAt = 0;
    const done = response();
    await authorizationChallenge(issuer, req({ auth_session: first.body.auth_session, presentation_during_issuance_session: verifier },
        { DPoP: await dpopProof(privateKey, jwk, url, await fresh()) }), done);
    expect(done.statusCode).toBe(200);

    // token: the same key, with a nonce
    const tokenUrl = BASE + '/as/token';
    const { verifier: codeVerifier } = pkce();
    const body = { grant_type: 'authorization_code', code: done.body.authorization_code, code_verifier: codeVerifier };
    const wrongKeyToken = response();
    await asToken(issuer, req(body, { DPoP: await dpopProof(other.privateKey, otherJwk, tokenUrl, await fresh()) }), wrongKeyToken);
    expect(wrongKeyToken.body.error).toMatch(/invalid_dpop_proof|use_dpop_nonce/);
    const nonceRes = response();
    await asToken(issuer, req(body, { DPoP: await dpopProof(privateKey, jwk, tokenUrl) }), nonceRes);
    expect(nonceRes.body.error).toBe('use_dpop_nonce');
    const tokenRes = response();
    await asToken(issuer, req(body, { DPoP: await dpopProof(privateKey, jwk, tokenUrl, nonceRes.headers['DPoP-Nonce']) }), tokenRes);
    expect(tokenRes.statusCode).toBe(200);
    expect(tokenRes.body.token_type).toBe('DPoP');
    expect(JSON.parse(tokenRes.body.access_token.substring(7)).cnf.jkt).toBe(jkt);
});
