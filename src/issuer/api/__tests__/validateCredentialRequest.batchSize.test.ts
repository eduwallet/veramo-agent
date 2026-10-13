import { vi, expect, test } from 'vitest';
import { ErrorCodes, CredentialOfferStatus } from '#root/types/api';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { MAX_BATCH_SIZE } from '#root/environment';

vi.mock('#root/issuer/lib/verifyAccessTokenJWT', () => ({
    verifyAccessTokenJWT: vi.fn(),
}));

import { verifyAccessTokenJWT } from '#root/issuer/lib/verifyAccessTokenJWT';
import { validateCredentialRequest } from '../validateCredentialRequest';

function newIssuer() {
    const issuer = new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
        { credential_configurations_supported: {}, credential_issuer: '', credential_endpoint: '' }
    );
    issuer.did = { did: 'did:example:123' } as any;
    return issuer;
}

function newSession() {
    const session = new Session();
    session.uuid = 'sess-1';
    session.state = 'state-1';
    session.expirationDate = new Date(Date.now() + 60000);
    session.data = {
        status: CredentialOfferStatus.ACCESS_TOKEN_CREATED,
        credentialId: 'cred-1',
        credentialDataSets: {
            'cred-1': { credentialId: 'cred-1', credentialConfiguration: { format: 'jwt_vc_json' }, data: {} },
        },
    } as any;
    return session;
}

function newRequest(proofs: string[]) {
    return {
        body: { proofs: { jwt: proofs } },
        header: (name: string) => (name === 'Authorization' ? 'Bearer some-access-token' : undefined),
    } as any;
}

test('rejects a proofs[] array larger than the configured batch size, before validating any proof', async () => {
    const issuer = newIssuer();
    const session = newSession();
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);
    vi.spyOn(issuer, 'storeSession').mockResolvedValue(undefined as any);
    vi.mocked(verifyAccessTokenJWT).mockResolvedValue({
        payload: { iss: issuer.did!.did, issuer_state: session.state },
    } as any);

    // garbage proof strings: if the cap were not enforced first, these would fail
    // later with a different error (unparseable JWT), not "too many proofs"
    const proofs = new Array(MAX_BATCH_SIZE + 1).fill('not-a-jwt');
    const request = newRequest(proofs);
    const result = await validateCredentialRequest(issuer, request);

    expect(result.error).toBe(ErrorCodes.INVALID_CREDENTIAL_REQUEST);
    expect(result.description).toMatch(/Too many proofs/);
});

test('accepts a proofs[] array at exactly the configured batch size limit', async () => {
    const issuer = newIssuer();
    const session = newSession();
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);
    vi.spyOn(issuer, 'storeSession').mockResolvedValue(undefined as any);
    vi.mocked(verifyAccessTokenJWT).mockResolvedValue({
        payload: { iss: issuer.did!.did, issuer_state: session.state },
    } as any);

    // at the limit, the cap itself must not reject; a garbage proof string fails later,
    // as an uncaught "Invalid JWT" parse error rather than an ApiState result (this is
    // pre-existing behaviour of validateCredentialRequestProof, unrelated to the cap)
    const proofs = new Array(MAX_BATCH_SIZE).fill('not-a-jwt');
    const request = newRequest(proofs);
    const error = await validateCredentialRequest(issuer, request).catch((e) => e);

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toMatch(/Too many proofs/);
});
