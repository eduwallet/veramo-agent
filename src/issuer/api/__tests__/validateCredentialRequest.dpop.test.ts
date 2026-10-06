import { vi, expect, test } from 'vitest';
import { Factory, CryptoKey } from '@muisit/cryptokey';
import { JWT } from '#root/jwt/JWT';
import { ErrorCodes, CredentialOfferStatus } from '#root/types/api';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { DPoPNonceRequiredError } from '#root/issuer/lib/validateDPoPProof';

vi.mock('#root/issuer/lib/verifyAccessTokenJWT', () => ({
    verifyAccessTokenJWT: vi.fn(),
}));

import { verifyAccessTokenJWT } from '#root/issuer/lib/verifyAccessTokenJWT';
import { validateCredentialRequest } from '../validateCredentialRequest';

const TEST_KEY_HEX = 'fbe04e71bce89f37e0970de16a97a80c4457250c6fe0b1e9297e6df778ae72a8';

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
        credentialDataSets: {},
        credentialId: 'cred-1',
    } as any;
    return session;
}

function newRequest(authHeader?: string, dpopHeader?: string) {
    return {
        body: {},
        header: (name: string) => {
            if (name === 'Authorization') return authHeader;
            if (name === 'DPoP') return dpopHeader;
            return undefined;
        },
    } as any;
}

test('rejects a DPoP-bound access token when no DPoP proof is supplied', async () => {
    const issuer = newIssuer();
    const session = newSession();
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);
    vi.mocked(verifyAccessTokenJWT).mockResolvedValue({
        payload: { iss: issuer.did!.did, issuer_state: session.state, cnf: { jkt: 'the-thumbprint' } },
    } as any);

    const request = newRequest('DPoP some-access-token');
    const result = await validateCredentialRequest(issuer, request);
    expect(result.error).toBe(ErrorCodes.INVALID_DPOP_PROOF);
});

test('requires a fresh nonce when the DPoP proof lacks one', async () => {
    const issuer = newIssuer();
    const session = newSession();
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);
    vi.spyOn(issuer.dpopNonceStates, 'get').mockResolvedValue({ uuid: 'fresh-nonce' } as any);
    vi.mocked(verifyAccessTokenJWT).mockResolvedValue({
        payload: { iss: issuer.did!.did, issuer_state: session.state, cnf: { jkt: 'the-thumbprint' } },
    } as any);

    const key = await Factory.createFromType('Secp256r1');
    await key.initialisePrivateKey(CryptoKey.hexToBytes(TEST_KEY_HEX));
    const jwk = await key.toJWK();
    const proof = new JWT();
    proof.header = { typ: 'dpop+jwt', jwk };
    proof.payload = {
        jti: 'jti-1',
        htm: 'POST',
        htu: issuer.options.baseUrl + '/credentials',
        iat: Math.floor(Date.now() / 1000),
        ath: CryptoKey.bytesToBase64Url(
            await crypto.subtle.digest('SHA-256', new TextEncoder().encode('some-access-token')).then((b) => new Uint8Array(b))
        ),
    };
    await proof.sign(key, 'ES256');

    const request = newRequest('DPoP some-access-token', proof.token);
    const err = await validateCredentialRequest(issuer, request).catch((e) => e);
    expect(err).toBeInstanceOf(DPoPNonceRequiredError);
    expect((err as DPoPNonceRequiredError).nonce).toBe('fresh-nonce');
});

test('rejects a DPoP proof bound to a different key than the access token', async () => {
    const issuer = newIssuer();
    const session = newSession();
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);
    vi.spyOn(issuer.dpopNonceStates, 'consume').mockResolvedValue(true);
    vi.spyOn(issuer.dpopJtiStates, 'claim').mockResolvedValue(true);
    vi.mocked(verifyAccessTokenJWT).mockResolvedValue({
        payload: { iss: issuer.did!.did, issuer_state: session.state, cnf: { jkt: 'unrelated-thumbprint' } },
    } as any);

    const key = await Factory.createFromType('Secp256r1');
    await key.initialisePrivateKey(CryptoKey.hexToBytes(TEST_KEY_HEX));
    const jwk = await key.toJWK();
    const proof = new JWT();
    proof.header = { typ: 'dpop+jwt', jwk };
    proof.payload = {
        jti: 'jti-1',
        htm: 'POST',
        htu: issuer.options.baseUrl + '/credentials',
        iat: Math.floor(Date.now() / 1000),
        nonce: 'a-nonce',
        ath: CryptoKey.bytesToBase64Url(
            await crypto.subtle.digest('SHA-256', new TextEncoder().encode('some-access-token')).then((b) => new Uint8Array(b))
        ),
    };
    await proof.sign(key, 'ES256');

    const request = newRequest('DPoP some-access-token', proof.token);
    const result = await validateCredentialRequest(issuer, request);
    expect(result.error).toBe(ErrorCodes.INVALID_DPOP_PROOF);
});
