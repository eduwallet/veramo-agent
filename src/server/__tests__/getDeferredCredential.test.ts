import { vi, expect, test, beforeEach } from 'vitest';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { CredentialOfferStatus, ErrorCodes } from '#root/types/api';

vi.mock('#root/issuer/lib/verifyAccessTokenJWT', () => ({ verifyAccessTokenJWT: vi.fn() }));
vi.mock('#root/server/rateLimiters', () => ({ deferredEndpointRateLimiter: vi.fn() }));
vi.mock('#root/issuer/api/issueCredential', () => ({ issueCredential: vi.fn() }));

import { verifyAccessTokenJWT } from '#root/issuer/lib/verifyAccessTokenJWT';
import { issueCredential } from '#root/issuer/api/issueCredential';
import { getDeferredCredential } from '../endpoints/getDeferredCredential';

function newIssuer() {
    const issuer = new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
        { credential_configurations_supported: {}, credential_issuer: '', credential_endpoint: '' } as any
    );
    issuer.did = { did: 'did:example:123' } as any;
    let handler:any;
    issuer.router = { use: vi.fn(), post: (_path:string, h:any) => { handler = h; } } as any;
    getDeferredCredential(issuer, '/deferred');
    return { issuer, handler };
}

function newSession(status:string, overrides:any = {}) {
    const session = new Session();
    session.uuid = 'sess-1';
    session.state = 'state-1';
    session.data = {
        status,
        credentialId: 'slow',
        deferred: {
            transactionId: 'tx-1',
            status,
            credentialId: 'slow',
            credentialDataSet: { credentialId: 'slow', credentialConfiguration: {}, data: { a: 1 } },
            holders: [{ type: 'jwk', did: 'did:x', data: {} }],
            claims: { name: 'Test' },
            ttl: 3600,
            interval: 72,
            createdAt: Date.now(),
            expiresAt: Date.now() + 3600_000,
            ...overrides,
        },
    } as any;
    return session;
}

function request(body:any, token:string|undefined = 'token') {
    return { body, header: (n:string) => (n === 'Authorization' && token ? 'Bearer ' + token : undefined) } as any;
}

function response() {
    const r:any = { headersSent: false, headers: {}, statusCode: 200, body: undefined };
    r.set = (k:string, v:string) => { r.headers[k] = v; return r; };
    r.header = r.set;
    r.status = (c:number) => { r.statusCode = c; return r; };
    r.json = (b:any) => { r.body = b; return r; };
    r.end = (b:any) => { r.body = JSON.parse(b); return r; };
    return r;
}

function setup(session:Session|null) {
    const { issuer, handler } = newIssuer();
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);
    vi.spyOn(issuer, 'storeSession').mockResolvedValue(undefined as any);
    vi.spyOn(issuer, 'getSessionById').mockResolvedValue(session as any);
    vi.mocked(verifyAccessTokenJWT).mockResolvedValue({ payload: { iss: 'did:example:123', issuer_state: 'state-1' } } as any);
    return { issuer, handler };
}

beforeEach(() => {
    // do not reset all mocks: the global setup mocks the Issuer class
    vi.mocked(verifyAccessTokenJWT).mockReset();
    vi.mocked(issueCredential).mockReset();
});

test('answers 202 with the same transaction_id and interval while pending', async () => {
    const { handler } = setup(newSession(CredentialOfferStatus.CREDENTIAL_PENDING));
    const res = response();
    await handler(request({ transaction_id: 'tx-1' }), res);
    expect(res.statusCode).toBe(202);
    expect(res.body).toStrictEqual({ transaction_id: 'tx-1', interval: 72 });
    expect(res.headers['Cache-Control']).toBe('no-store');
    expect(issueCredential).not.toHaveBeenCalled();
});

test('issues the credential when ready and invalidates the transaction', async () => {
    const session = newSession(CredentialOfferStatus.CREDENTIAL_READY);
    const { handler } = setup(session);
    vi.mocked(issueCredential).mockImplementation(async (_issuer, _proof, deferred) => {
        deferred!.status = CredentialOfferStatus.CREDENTIAL_ISSUED;
        session.data.deferred = deferred;
        return { credentials: [{ credential: 'jwt' }], notification_id: 'sess-1' };
    });

    const res = response();
    await handler(request({ transaction_id: 'tx-1' }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toStrictEqual({ credentials: [{ credential: 'jwt' }], notification_id: 'sess-1' });
    const [, proofData, deferred] = vi.mocked(issueCredential).mock.calls[0];
    expect(proofData.proofResults).toStrictEqual([{ nonce: '', holder: { type: 'jwk', did: 'did:x', data: {} } }]);
    expect(deferred!.claims).toStrictEqual({ name: 'Test' });

    // the transaction cannot be used a second time
    const second = response();
    await handler(request({ transaction_id: 'tx-1' }), second);
    expect(second.statusCode).toBe(400);
    expect(second.body.error).toBe(ErrorCodes.INVALID_TRANSACTION_ID);
    expect(issueCredential).toHaveBeenCalledTimes(1);
});

test('answers credential_request_denied with a sanitised reason when denied', async () => {
    const { handler } = setup(newSession(CredentialOfferStatus.CREDENTIAL_DENIED, { reason: 'Niet "akkoord" \\ café' }));
    const res = response();
    await handler(request({ transaction_id: 'tx-1' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(ErrorCodes.CREDENTIAL_REQUEST_DENIED);
    expect(res.body.error_description).toBe('Niet ?akkoord? ? caf?');
});

test('denial without a reason has no error_description', async () => {
    const { handler } = setup(newSession(CredentialOfferStatus.CREDENTIAL_DENIED));
    const res = response();
    await handler(request({ transaction_id: 'tx-1' }), res);
    expect(res.body).toStrictEqual({ error: ErrorCodes.CREDENTIAL_REQUEST_DENIED });
});

test('a failing issuance is a credential_request_denied and keeps the transaction', async () => {
    const session = newSession(CredentialOfferStatus.CREDENTIAL_READY);
    const { handler } = setup(session);
    vi.mocked(issueCredential).mockRejectedValue(new Error('No entitlement found'));
    const res = response();
    await handler(request({ transaction_id: 'tx-1' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(ErrorCodes.CREDENTIAL_REQUEST_DENIED);
    expect(session.data.deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_READY);
});

test.each([
    ['an unknown transaction_id', { transaction_id: 'other' }, {}],
    ['an expired transaction', { transaction_id: 'tx-1' }, { expiresAt: Date.now() - 1 }],
])('rejects %s', async (_name, body, overrides) => {
    const { handler } = setup(newSession(CredentialOfferStatus.CREDENTIAL_PENDING, overrides));
    const res = response();
    await handler(request(body), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(ErrorCodes.INVALID_TRANSACTION_ID);
});

test('rejects a session without a deferred transaction', async () => {
    const session = newSession(CredentialOfferStatus.CREDENTIAL_PENDING);
    delete session.data.deferred;
    const { handler } = setup(session);
    const res = response();
    await handler(request({ transaction_id: 'tx-1' }), res);
    expect(res.body.error).toBe(ErrorCodes.INVALID_TRANSACTION_ID);
});

test('rejects a missing transaction_id, a missing token and an unknown session', async () => {
    const { handler } = setup(newSession(CredentialOfferStatus.CREDENTIAL_PENDING));
    let res = response();
    await handler(request({}), res);
    expect(res.body.error).toBe(ErrorCodes.INVALID_REQUEST);

    res = response();
    await handler(request({ transaction_id: 'tx-1' }, ''), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(ErrorCodes.INVALID_REQUEST);

    const unknown = setup(null);
    res = response();
    await unknown.handler(request({ transaction_id: 'tx-1' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(ErrorCodes.INVALID_REQUEST);
});

test('rejects an access token that was not issued by this issuer', async () => {
    const { handler } = setup(newSession(CredentialOfferStatus.CREDENTIAL_PENDING));
    vi.mocked(verifyAccessTokenJWT).mockResolvedValue({ payload: { iss: 'did:example:other', issuer_state: 'state-1' } } as any);
    const res = response();
    await handler(request({ transaction_id: 'tx-1' }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(ErrorCodes.INVALID_REQUEST);
});
