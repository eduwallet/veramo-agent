import { vi, expect, test, beforeEach } from 'vitest';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { CredentialOfferStatus, ErrorCodes } from '#root/types/api';
import { deferCredential } from '../deferCredential';
import { validateCreateCredentialOffer } from '../validateCreateCredentialOffer';

function newIssuer() {
    const issuer = new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
        {
            credential_configurations_supported: {
                plain: { format: 'dc+sd-jwt', scope: 'Plain', credential_definition: { type: ['Plain'], claims: [{ path: ['name'], mandatory: true }] } },
                slow: {
                    format: 'dc+sd-jwt', scope: 'Slow',
                    deferred: { ttl: 3600 },
                    credential_definition: { type: ['Slow'], claims: [{ path: ['name'], mandatory: true, origin: [['#deferred', 'name']] }] }
                },
            },
            credential_issuer: '', credential_endpoint: ''
        } as any
    );
    vi.spyOn(issuer, 'storeSession').mockResolvedValue(undefined as any);
    return issuer;
}

function newProofData() {
    const session = new Session();
    session.uuid = 'sess-1';
    session.state = 'state-1';
    session.expirationDate = new Date(Date.now() + 60_000);
    session.data = { status: CredentialOfferStatus.CREDENTIAL_REQUEST_RECEIVED } as any;
    return {
        session,
        credentialDataSet: { id: 'slow#0', credentialId: 'slow', credentialConfiguration: {} as any, data: { name: 'offer' } },
        proofResults: [{ nonce: 'n', holder: { type: 'jwk', did: 'did:x', data: { kty: 'EC' }, ckey: { secret: 'object' } as any } }],
    };
}

beforeEach(() => { vi.restoreAllMocks(); });

test('registers a pending transaction and returns transaction_id and interval', async () => {
    const issuer = newIssuer();
    const proofData = newProofData();
    const before = Date.now();
    const response = await deferCredential(issuer, proofData, issuer.getDeferredSettings('slow')!);

    expect(response.transaction_id).toBeTruthy();
    expect(response.interval).toBe(72);
    // no credentials and no notification_id in a deferred response
    expect(response).not.toHaveProperty('credentials');
    expect(response).not.toHaveProperty('notification_id');

    const deferred:any = Object.values(proofData.session.data.deferredTransactions)[0];
    expect(deferred.transactionId).toBe(response.transaction_id);
    expect(deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_PENDING);
    expect(proofData.session.data.status).toBe(CredentialOfferStatus.CREDENTIAL_PENDING);
    expect(deferred.expiresAt).toBeGreaterThanOrEqual(before + 3600 * 1000);
    expect(deferred.holders).toStrictEqual([{ type: 'jwk', did: 'did:x', data: { kty: 'EC' } }]);
    expect(deferred.claims).toStrictEqual({});
    expect(deferred.credentialDataSet.data).toStrictEqual({ name: 'offer' });
});

test('extends the session lifetime to the transaction lifetime', async () => {
    const issuer = newIssuer();
    const proofData = newProofData();
    await deferCredential(issuer, proofData, issuer.getDeferredSettings('slow')!);
    expect(proofData.session.expirationDate!.getTime()).toBe((Object.values(proofData.session.data.deferredTransactions)[0] as any).expiresAt);

    // an already longer lived session is not shortened
    const longer = newProofData();
    const longExpiry = new Date(Date.now() + 10 * 3600 * 1000);
    longer.session.expirationDate = longExpiry;
    await deferCredential(issuer, longer, issuer.getDeferredSettings('slow')!);
    expect(longer.session.expirationDate).toBe(longExpiry);
});

test('a repeated credential request keeps the same transaction', async () => {
    const issuer = newIssuer();
    const proofData = newProofData();
    const first = await deferCredential(issuer, proofData, issuer.getDeferredSettings('slow')!);
    const second = await deferCredential(issuer, proofData, issuer.getDeferredSettings('slow')!);
    expect(second.transaction_id).toBe(first.transaction_id);
});

test('a completed transaction cannot be requested again', async () => {
    const issuer = newIssuer();
    const proofData = newProofData();
    await deferCredential(issuer, proofData, issuer.getDeferredSettings('slow')!);
    (Object.values(proofData.session.data.deferredTransactions)[0] as any).status = CredentialOfferStatus.CREDENTIAL_DENIED;
    await expect(deferCredential(issuer, proofData, issuer.getDeferredSettings('slow')!)).rejects.toThrow();
});

test('create-offer accepts a deferred credential without claims', () => {
    const issuer = newIssuer();
    const grants = { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': {} } as any;
    const deferred = validateCreateCredentialOffer(issuer, { grants, credentials: ['slow'] } as any);
    expect(deferred.error).toBe(ErrorCodes.NO_ERROR);
});

test('every deferred data set gets its own transaction, and a repeated request returns the same one', async () => {
    const issuer = newIssuer();
    const first = newProofData();
    const second = { ...first, credentialDataSet: { ...first.credentialDataSet, id: 'slow#1' } };
    const settings = issuer.getDeferredSettings('slow')!;

    const r1 = await deferCredential(issuer, first, settings);
    const r2 = await deferCredential(issuer, second, settings);
    expect(r2.transaction_id).not.toBe(r1.transaction_id);
    expect(Object.keys(first.session.data.deferredTransactions)).toHaveLength(2);

    expect((await deferCredential(issuer, first, settings)).transaction_id).toBe(r1.transaction_id);
});
