import { vi, expect, test, beforeEach } from 'vitest';
import { calculateJwkThumbprint } from 'jose';
import { Factory, CryptoKey } from '@muisit/cryptokey';
import { JWT } from '#root/jwt/JWT';
import { Issuer } from '#root/issuer/Issuer';
import { DPoPNonceRequiredError, validateDPoPProof } from '../validateDPoPProof';

const TEST_KEY_HEX = 'fbe04e71bce89f37e0970de16a97a80c4457250c6fe0b1e9297e6df778ae72a8';
const HTU = 'https://example.com/issuer/credentials';
const HTM = 'POST';

function newIssuer() {
    return new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
        { credential_configurations_supported: {}, credential_issuer: '', credential_endpoint: '' }
    );
}

async function newKey() {
    const key = await Factory.createFromType('Secp256r1');
    await key.initialisePrivateKey(CryptoKey.hexToBytes(TEST_KEY_HEX));
    return key;
}

async function createProof(key: CryptoKey, overrides: any = {}) {
    const jwk = await key.toJWK();
    const jwt = new JWT();
    jwt.header = { typ: 'dpop+jwt', jwk, ...overrides.header };
    jwt.payload = {
        jti: 'jti-1',
        htm: HTM,
        htu: HTU,
        iat: Math.floor(Date.now() / 1000),
        ...overrides.payload,
    };
    await jwt.sign(key, 'ES256');
    return jwt.token;
}

let issuer: Issuer;

beforeEach(() => {
    issuer = newIssuer();
});

test('returns null when no DPoP header is supplied', async () => {
    const result = await validateDPoPProof(issuer, undefined, HTM, HTU);
    expect(result).toBeNull();
});

test('accepts a valid proof and returns the jwk thumbprint', async () => {
    const key = await newKey();
    const jwk = await key.toJWK();
    vi.spyOn(issuer.dpopNonceStates, 'consume').mockResolvedValue(true);
    vi.spyOn(issuer.dpopJtiStates, 'claim').mockResolvedValue(true);

    const proof = await createProof(key, { payload: { nonce: 'a-valid-nonce' } });
    const result = await validateDPoPProof(issuer, proof, HTM, HTU);

    expect(result).not.toBeNull();
    expect(result!.jkt).toBe(await calculateJwkThumbprint(jwk as any, 'sha256'));
});

test('validates ath against the access token for resource requests', async () => {
    const key = await newKey();
    vi.spyOn(issuer.dpopNonceStates, 'consume').mockResolvedValue(true);
    vi.spyOn(issuer.dpopJtiStates, 'claim').mockResolvedValue(true);

    const accessToken = 'the-access-token';
    const ath = CryptoKey.bytesToBase64Url(
        await crypto.subtle.digest('SHA-256', new TextEncoder().encode(accessToken)).then((b) => new Uint8Array(b))
    );
    const proof = await createProof(key, { payload: { nonce: 'a-valid-nonce', ath } });

    const result = await validateDPoPProof(issuer, proof, HTM, HTU, accessToken);
    expect(result).not.toBeNull();
});

test('rejects a proof with a mismatching ath', async () => {
    const key = await newKey();
    vi.spyOn(issuer.dpopNonceStates, 'consume').mockResolvedValue(true);
    vi.spyOn(issuer.dpopJtiStates, 'claim').mockResolvedValue(true);

    const proof = await createProof(key, { payload: { nonce: 'a-valid-nonce', ath: 'wrong' } });
    await expect(validateDPoPProof(issuer, proof, HTM, HTU, 'the-access-token')).rejects.toThrow('ath mismatch');
});

test('rejects a proof with a mismatching htu', async () => {
    const key = await newKey();
    const proof = await createProof(key, { payload: { nonce: 'a-valid-nonce', htu: 'https://evil.example.com/credentials' } });
    await expect(validateDPoPProof(issuer, proof, HTM, HTU)).rejects.toThrow('htu mismatch');
});

test('rejects a proof embedding a private key', async () => {
    const key = await newKey();
    const jwk = await key.toJWK();
    (jwk as any).d = 'should-not-be-here';
    const proof = await createProof(key, { header: { jwk } });
    await expect(validateDPoPProof(issuer, proof, HTM, HTU)).rejects.toThrow('Invalid or missing DPoP proof key');
});

test('throws DPoPNonceRequiredError when the nonce is missing', async () => {
    const key = await newKey();
    vi.spyOn(issuer.dpopNonceStates, 'get').mockResolvedValue({ uuid: 'fresh-nonce' } as any);

    const proof = await createProof(key);
    const err = await validateDPoPProof(issuer, proof, HTM, HTU).catch((e) => e);
    expect(err).toBeInstanceOf(DPoPNonceRequiredError);
    expect((err as DPoPNonceRequiredError).nonce).toBe('fresh-nonce');
});

test('throws DPoPNonceRequiredError when the nonce is unknown or already used', async () => {
    const key = await newKey();
    vi.spyOn(issuer.dpopNonceStates, 'consume').mockResolvedValue(false);
    vi.spyOn(issuer.dpopNonceStates, 'get').mockResolvedValue({ uuid: 'fresh-nonce-2' } as any);

    const proof = await createProof(key, { payload: { nonce: 'stale-nonce' } });
    const err = await validateDPoPProof(issuer, proof, HTM, HTU).catch((e) => e);
    expect(err).toBeInstanceOf(DPoPNonceRequiredError);
    expect((err as DPoPNonceRequiredError).nonce).toBe('fresh-nonce-2');
});

test('rejects a replayed jti', async () => {
    const key = await newKey();
    vi.spyOn(issuer.dpopNonceStates, 'consume').mockResolvedValue(true);
    vi.spyOn(issuer.dpopJtiStates, 'claim').mockResolvedValue(false);

    const proof = await createProof(key, { payload: { nonce: 'a-valid-nonce' } });
    await expect(validateDPoPProof(issuer, proof, HTM, HTU)).rejects.toThrow('jti has already been used');
});
