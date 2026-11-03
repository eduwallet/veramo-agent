import { vi, expect, test } from 'vitest';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { CredentialOfferStatus } from '#root/types/api';
import { CredentialFactory } from '#root/credentials/CredentialFactory';
import { issueCredential } from '../issueCredential';

function setup() {
    const issuer = new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
        {
            credential_configurations_supported: {
                slow: {
                    format: 'dc+sd-jwt', scope: 'Slow', deferred: { ttl: 3600 },
                    credential_definition: {
                        type: ['Slow'],
                        claims: [
                            { path: ['name'], origin: [['#deferred', 'name']] },
                            { path: ['course'], origin: [['#offer', 'course']] },
                            { path: ['email'], origin: [['#any', 'email']] },
                        ]
                    }
                },
            },
            credential_issuer: '', credential_endpoint: ''
        } as any
    );
    vi.spyOn(issuer, 'storeSession').mockResolvedValue(undefined as any);
    vi.spyOn(issuer, 'storeCredential').mockResolvedValue(undefined as any);
    vi.spyOn(CredentialFactory, 'sign').mockImplementation(async (c) => { c.output = c.data; return true; });
    const session = new Session();
    session.uuid = 'sess-1';
    session.state = 'state-1';
    session.data = { metaData: {}, accessData: { email: 'as@example.com' } } as any;
    return { issuer, session };
}

test('builds the credential from the offer data and the deferred claims', async () => {
    const { issuer, session } = setup();
    const offerData = { course: 'math', name: 'offer name' };
    const deferred:any = {
        transactionId: 'tx-1', status: CredentialOfferStatus.CREDENTIAL_READY, credentialId: 'slow',
        holders: [], claims: { name: 'Deferred name', email: 'back@office.nl' }, ttl: 3600, interval: 72, createdAt: 0, expiresAt: 0,
    };
    const dataSet:any = { credentialId: 'slow', credentialConfiguration: { format: 'dc+sd-jwt' }, data: offerData };

    const response = await issueCredential(issuer, {
        session, credentialDataSet: dataSet,
        proofResults: [{ nonce: '', holder: { type: 'jwk', did: 'did:x', data: { kty: 'EC' } } }]
    }, deferred);

    // the #deferred claim wins from the offer, #offer is used for the course and #any prefers the back-office
    expect(response.credentials).toHaveLength(1);
    expect(response.credentials[0].credential).toMatchObject({ name: 'Deferred name', course: 'math', email: 'back@office.nl' });
    expect(response.notification_id).toBe('sess-1');
    // the transaction is completed
    expect(session.data.deferred.status).toBe(CredentialOfferStatus.CREDENTIAL_ISSUED);
    expect(session.data.status).toBe(CredentialOfferStatus.CREDENTIAL_ISSUED);
    // the stored offer data is not modified by building the credential
    expect(offerData).toStrictEqual({ course: 'math', name: 'offer name' });
});

test('#any falls back on the access data and the offer', async () => {
    const { issuer, session } = setup();
    const deferred:any = {
        transactionId: 'tx-1', status: CredentialOfferStatus.CREDENTIAL_READY, credentialId: 'slow',
        holders: [], claims: { name: 'Deferred name' }, ttl: 3600, interval: 72, createdAt: 0, expiresAt: 0,
    };
    const dataSet:any = { credentialId: 'slow', credentialConfiguration: { format: 'dc+sd-jwt' }, data: { course: 'math', email: 'offer@example.com' } };
    const response = await issueCredential(issuer, {
        session, credentialDataSet: dataSet,
        proofResults: [{ nonce: '', holder: { type: 'jwk', did: 'did:x', data: {} } }]
    }, deferred);
    expect(response.credentials[0].credential.email).toBe('as@example.com');
});
