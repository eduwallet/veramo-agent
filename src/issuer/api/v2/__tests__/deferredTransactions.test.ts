import { vi, expect, test, beforeEach } from 'vitest';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { CredentialOfferStatus, ErrorCodes } from '#root/types/api';
import { getDeferredTransaction, listDeferredTransactions, updateDeferredTransaction } from '../deferredTransactions';
import { findUnusedClaims, getClaimDefinitions } from '#root/issuer/lib/claimDefinitions';

const configuration = {
    format: 'dc+sd-jwt', scope: 'Slow', deferred: { ttl: 3600 },
    credential_definition: {
        type: ['Slow'],
        claims: [
            { path: ['name'], mandatory: true, value_type: 'string', origin: [['#deferred', 'name']] },
            { path: ['course'], mandatory: true, origin: [['#offer', 'course']] },
            { path: ['street'], origin: [['#deferred', 'address', 'street']] },
            { path: ['email'], origin: [['#any', 'email']] },
            { path: ['age'], value_type: 'number', origin: [['#deferred', 'age']] },
        ]
    }
};

function newIssuer(sessions:Session[] = []) {
    const issuer = new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
        { credential_configurations_supported: { slow: configuration }, credential_issuer: '', credential_endpoint: '' } as any
    );
    vi.spyOn(issuer, 'getSessionById').mockImplementation(async (id:string = '') => sessions.find((s) => s.uuid == id) ?? new Session());
    vi.spyOn(issuer, 'storeSession').mockResolvedValue(undefined as any);
    vi.spyOn(issuer.sessionData, 'getActive').mockResolvedValue(sessions);
    return issuer;
}

let counter = 0;
function newSession(overrides:any = {}, offerData:any = { course: 'math' }) {
    const session = new Session();
    session.id = ++counter;
    session.uuid = 'sess-' + counter;
    session.state = 'state-' + counter;
    session.data = {
        status: CredentialOfferStatus.CREDENTIAL_PENDING,
        accessData: {},
        deferred: {
            transactionId: 'tx-' + counter,
            status: CredentialOfferStatus.CREDENTIAL_PENDING,
            credentialId: 'slow',
            credentialDataSet: { credentialId: 'slow', credentialConfiguration: {}, data: offerData },
            holders: [{ type: 'jwk', data: {} }, { type: 'jwk', data: {} }],
            claims: {},
            ttl: 3600, interval: 72,
            createdAt: 1000, expiresAt: Date.now() + 3600_000,
            ...overrides,
        },
    } as any;
    return session;
}

beforeEach(() => { vi.restoreAllMocks(); });

test('lists the open transactions only', async () => {
    const open = newSession();
    const ready = newSession({ status: CredentialOfferStatus.CREDENTIAL_READY });
    const expired = newSession({ expiresAt: Date.now() - 1 });
    const plain = new Session(); plain.id = 99; plain.uuid = 'plain'; plain.data = {} as any;
    const issuer = newIssuer([open, ready, expired, plain]);

    const result = await listDeferredTransactions(issuer);
    expect(result.status).toBe(200);
    expect(result.body).toStrictEqual([{
        id: open.uuid, credential_configuration_id: 'slow', status: 'CREDENTIAL_PENDING',
        createdAt: 1000, expiresAt: open.data.deferred.expiresAt,
    }]);

    const readyList = await listDeferredTransactions(issuer, CredentialOfferStatus.CREDENTIAL_READY);
    expect(readyList.body.map((i:any) => i.id)).toStrictEqual([ready.uuid]);
});

test('returns the details of a transaction', async () => {
    const session = newSession({}, { course: 'math', other: 1 });
    const issuer = newIssuer([session]);
    const result = await getDeferredTransaction(issuer, session.uuid);
    expect(result.status).toBe(200);
    expect(result.body).toMatchObject({
        id: session.uuid, status: 'CREDENTIAL_PENDING', credential_configuration_id: 'slow',
        format: 'dc+sd-jwt', proofs: 2, ttl: 3600, interval: 72,
        data: { course: 'math', other: 1 }, claims_supplied: {},
    });
    const claims = result.body.claims;
    expect(claims).toContainEqual({ path: ['name'], type: 'string', mandatory: true, origin: [['#deferred', 'name']], supply: [['name']] });
    expect(claims).toContainEqual({ path: ['course'], type: null, mandatory: true, origin: [['#offer', 'course']], supply: [] });
    expect(claims).toContainEqual({ path: ['street'], type: null, mandatory: false, origin: [['#deferred', 'address', 'street']], supply: [['address', 'street']] });
});

test('an unknown id or a session without transaction is not found', async () => {
    const issuer = newIssuer([]);
    expect((await getDeferredTransaction(issuer, 'nope')).status).toBe(404);
    expect((await updateDeferredTransaction(issuer, 'nope', {})).status).toBe(404);
});

test('releases the transaction with valid claims', async () => {
    const session = newSession();
    const issuer = newIssuer([session]);
    const result = await updateDeferredTransaction(issuer, session.uuid, { claims: { name: 'Test', address: { street: 'Main' } } });
    expect(result).toStrictEqual({ status: 200, body: { id: session.uuid, status: 'CREDENTIAL_READY' } });
    expect(session.data.deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_READY);
    expect(session.data.status).toBe(CredentialOfferStatus.CREDENTIAL_READY);
    expect(session.data.deferred.claims).toStrictEqual({ name: 'Test', address: { street: 'Main' } });
    expect(issuer.storeSession).toHaveBeenCalled();
});

test('an explicit CREDENTIAL_READY status releases as well', async () => {
    const session = newSession();
    const result = await updateDeferredTransaction(newIssuer([session]), session.uuid, { status: 'CREDENTIAL_READY', claims: { name: 'Test' } });
    expect(result.status).toBe(200);
});

test('validates the existing data when no claims are supplied', async () => {
    // name is mandatory and not available: not released
    const incomplete = newSession();
    const failed = await updateDeferredTransaction(newIssuer([incomplete]), incomplete.uuid, {});
    expect(failed.status).toBe(400);
    expect(failed.body.errors).toStrictEqual(["Missing mandatory claim 'name'"]);
    expect(incomplete.data.deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_PENDING);

    // all mandatory claims are known from earlier supplied claims
    const complete = newSession({ claims: { name: 'Earlier' } });
    expect((await updateDeferredTransaction(newIssuer([complete]), complete.uuid, {})).status).toBe(200);
});

test('does not release or store claims that fail the validation', async () => {
    const session = newSession();
    const issuer = newIssuer([session]);
    const missing = await updateDeferredTransaction(issuer, session.uuid, { claims: { email: 'a@b.c' } });
    expect(missing.status).toBe(400);
    expect(missing.body.error).toBe(ErrorCodes.INVALID_REQUEST);
    expect(missing.body.errors).toStrictEqual(["Missing mandatory claim 'name'"]);

    const wrongType = await updateDeferredTransaction(issuer, session.uuid, { claims: { name: 'Test', age: 'old' } });
    expect(wrongType.status).toBe(400);
    expect(wrongType.body.errors).toStrictEqual(["Claim 'age' must be of type number"]);

    expect(session.data.deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_PENDING);
    expect(session.data.deferred.claims).toStrictEqual({});
    expect(issuer.storeSession).not.toHaveBeenCalled();
});

test('uses the access data of the session for mandatory claims', async () => {
    const session = newSession();
    session.data.accessData = { email: 'as@example.com' };
    // name now only comes from the access data
    const issuer = newIssuer([session]);
    vi.spyOn(issuer, 'getCredentialConfiguration').mockReturnValue({
        ...configuration,
        credential_definition: { type: ['Slow'], claims: [{ path: ['email'], mandatory: true, origin: [['#any', 'email']] }] }
    } as any);
    expect((await updateDeferredTransaction(issuer, session.uuid, {})).status).toBe(200);
});

test('rejects claims that no claim definition uses', async () => {
    const session = newSession();
    const issuer = newIssuer([session]);
    const result = await updateDeferredTransaction(issuer, session.uuid, { claims: { name: 'Test', surprise: 1, address: { street: 'x', zip: '1' }, course: 'other' } });
    expect(result.status).toBe(400);
    // course is read from the offer only, so it cannot be supplied
    expect(result.body.claims).toStrictEqual(['surprise', 'address.zip', 'course']);
    expect(session.data.deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_PENDING);
});

test('rejects forbidden claim names', async () => {
    const session = newSession();
    const issuer = newIssuer([session]);
    const body = JSON.parse('{"claims": {"name": "Test", "__proto__": {"polluted": true}, "address": {"constructor": "x"}}}');
    const result = await updateDeferredTransaction(issuer, session.uuid, body);
    expect(result.status).toBe(400);
    expect(result.body.claims).toStrictEqual(['__proto__', 'address.constructor']);
    expect(({} as any).polluted).toBeUndefined();
});

test('denies a transaction and logs the reason', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const session = newSession();
    const issuer = newIssuer([session]);
    const result = await updateDeferredTransaction(issuer, session.uuid, { status: 'CREDENTIAL_DENIED', reason: 'Not eligible\nsecond line' });
    expect(result).toStrictEqual({ status: 200, body: { id: session.uuid, status: 'CREDENTIAL_DENIED' } });
    expect(session.data.deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_DENIED);
    expect(session.data.deferred.reason).toBe('Not eligible\nsecond line');
    expect(session.data.status).toBe(CredentialOfferStatus.CREDENTIAL_DENIED);
    expect(session.data.requestResponseData['deferred-denied'].reason).toBe('Not eligible\nsecond line');
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0][0]).toContain('denied, reason: Not eligible second line');
});

test('denying without a reason is allowed and logged as such', async () => {
    const info = vi.spyOn(console, 'info').mockImplementation(() => {});
    const session = newSession();
    const result = await updateDeferredTransaction(newIssuer([session]), session.uuid, { status: 'CREDENTIAL_DENIED' });
    expect(result.status).toBe(200);
    expect(session.data.deferred.reason).toBeUndefined();
    expect(info.mock.calls[0][0]).toContain('(no reason given)');
});

test.each([
    ['claims combined with a denial', { status: 'CREDENTIAL_DENIED', claims: { name: 'x' } }],
    ['an unsupported status', { status: 'CREDENTIAL_ISSUED' }],
    ['claims that are not an object', { claims: 'x' }],
    ['claims that are an array', { claims: [] }],
    ['a reason that is not a string', { status: 'CREDENTIAL_DENIED', reason: 5 }],
    ['an over long reason', { status: 'CREDENTIAL_DENIED', reason: 'x'.repeat(2001) }],
    ['a body that is not an object', 'text'],
])('rejects %s', async (_name, body) => {
    const session = newSession();
    const result = await updateDeferredTransaction(newIssuer([session]), session.uuid, body);
    expect(result.status).toBe(400);
    expect(session.data.deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_PENDING);
});

test.each([
    [CredentialOfferStatus.CREDENTIAL_READY],
    [CredentialOfferStatus.CREDENTIAL_DENIED],
    [CredentialOfferStatus.CREDENTIAL_ISSUED],
])('answers 409 for a transaction that is %s', async (status) => {
    const session = newSession({ status });
    const result = await updateDeferredTransaction(newIssuer([session]), session.uuid, { claims: { name: 'x' } });
    expect(result.status).toBe(409);
});

test('answers 409 for an expired transaction', async () => {
    const session = newSession({ expiresAt: Date.now() - 1 });
    const result = await updateDeferredTransaction(newIssuer([session]), session.uuid, { claims: { name: 'x' } });
    expect(result.status).toBe(409);
});

test('claim definitions cover the old school credentialSubject notation', () => {
    const definitions = getClaimDefinitions({
        format: 'jwt_vc_json',
        credential_definition: { type: ['T'], credentialSubject: { a: { mandatory: true, value_type: 'string' }, b: { origin: [['#any', 'x', 'y']] } } }
    } as any);
    expect(definitions).toStrictEqual([
        { path: ['a'], type: 'string', mandatory: true, origin: [['#offer', 'a']], supply: [] },
        { path: ['b'], type: null, mandatory: false, origin: [['#any', 'x', 'y']], supply: [['x', 'y']] },
    ]);
});

test('a claim that reads an object accepts everything inside it', () => {
    const definitions = getClaimDefinitions({
        format: 'dc+sd-jwt', credential_definition: { type: ['T'], claims: [{ path: ['address'], origin: [['#deferred', 'address']] }] }
    } as any);
    expect(findUnusedClaims(definitions, { address: { street: 'a', geo: { lat: 1 } } })).toStrictEqual({ unknown: [], forbidden: [] });
    expect(findUnusedClaims(definitions, { other: [1, 2] })).toStrictEqual({ unknown: ['other'], forbidden: [] });
});
