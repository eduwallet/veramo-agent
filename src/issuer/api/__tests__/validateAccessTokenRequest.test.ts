import { vi, expect, test} from 'vitest';
import { ErrorCodes } from '../../../types/api.js';
import { GrantTypes, TokenRequest } from '../../../types/specification/access_token.js';
import { Issuer } from '../../Issuer.js';
import { validateAccessTokenRequest } from '../validateAccessTokenRequest.js';
import { Session } from '#root/database/entities/index';
import { Factory, CryptoKey } from '@muisit/cryptokey';
import { JWT } from '#root/jwt/JWT';
import { DPoPNonceRequiredError } from '#root/issuer/lib/validateDPoPProof';

test('basic offer', async () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa"
    };
    const issuer = new Issuer({name:'', baseUrl:"", did:''}, {credential_configurations_supported:{}, credential_issuer:'', credential_endpoint: ''});
    const sessionid = "bbb";
    const session = new Session();
    session.uuid = sessionid;
    session.data = {};
    session.data.credentialOffer = {
        grants: {}
    };
    session.data.credentialOffer.grants[GrantTypes.PRE_AUTHORIZED_CODE] = {
        "pre-authorized_code": "aaa"
    };
    session.state = 'aaa';
    vi.spyOn(issuer, 'getSessionById').mockResolvedValue(session);
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);

    const result = await validateAccessTokenRequest(issuer, tokenRequest);
    expect(!!(result || false)).toBe(true);
    expect(result.error).toBe(ErrorCodes.NO_ERROR);
    expect(!!(result.data)).toBe(true);
    expect(!!(result.data.session)).toBe(true);
    expect(result.data.session.id).toBe(session.id);
});

test('numeric pin code', async () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa",
        tx_code: "1234"
    };
    const issuer = new Issuer({name:'', baseUrl:"", did:''}, {credential_configurations_supported:{}, credential_issuer:'', credential_endpoint: ''});

    const sessionid = "bbb";
    const session = new Session();
    session.uuid = sessionid;
    session.data = {};
    session.data.pinCode = '1234';
    session.data.credentialOffer = {
        grants: {}
    };
    session.data.credentialOffer.grants[GrantTypes.PRE_AUTHORIZED_CODE] = {
        "pre-authorized_code": "aaa"
    };
    session.state = 'aaa';
    vi.spyOn(issuer, 'getSessionById').mockResolvedValue(session);
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);

    const result = await validateAccessTokenRequest(issuer, tokenRequest);
    expect(!!(result || false)).toBe(true);
    expect(result.error).toBe(ErrorCodes.NO_ERROR);
});

test('token request without DPoP proof yields a bearer token', async () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa"
    };
    const issuer = new Issuer({name:'', baseUrl:"https://example.com/issuer", did:''}, {credential_configurations_supported:{}, credential_issuer:'', credential_endpoint: ''});
    const session = new Session();
    session.uuid = "bbb";
    session.data = { credentialOffer: { grants: { [GrantTypes.PRE_AUTHORIZED_CODE]: { "pre-authorized_code": "aaa" } } } };
    session.state = 'aaa';
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);

    const result = await validateAccessTokenRequest(issuer, tokenRequest);
    expect(result.error).toBe(ErrorCodes.NO_ERROR);
    expect(result.data.jkt).toBeUndefined();
});

test('token request with a valid DPoP proof yields a bound jkt', async () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa"
    };
    const baseUrl = "https://example.com/issuer";
    const issuer = new Issuer({name:'', baseUrl, did:''}, {credential_configurations_supported:{}, credential_issuer:'', credential_endpoint: ''});
    const session = new Session();
    session.uuid = "bbb";
    session.data = { credentialOffer: { grants: { [GrantTypes.PRE_AUTHORIZED_CODE]: { "pre-authorized_code": "aaa" } } } };
    session.state = 'aaa';
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);
    vi.spyOn(issuer.dpopNonceStates, 'consume').mockResolvedValue(true);
    vi.spyOn(issuer.dpopJtiStates, 'claim').mockResolvedValue(true);

    const key = await Factory.createFromType('Secp256r1');
    await key.initialisePrivateKey(CryptoKey.hexToBytes("fbe04e71bce89f37e0970de16a97a80c4457250c6fe0b1e9297e6df778ae72a8"));
    const jwk = await key.toJWK();
    const proof = new JWT();
    proof.header = { typ: 'dpop+jwt', jwk };
    proof.payload = { jti: 'jti-1', htm: 'POST', htu: baseUrl + '/token', iat: Math.floor(Date.now() / 1000), nonce: 'a-nonce' };
    await proof.sign(key, 'ES256');

    const result = await validateAccessTokenRequest(issuer, tokenRequest, proof.token);
    expect(result.error).toBe(ErrorCodes.NO_ERROR);
    expect(result.data.jkt).toBeDefined();
});

test('token request with a DPoP proof missing a nonce requires a retry', async () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa"
    };
    const baseUrl = "https://example.com/issuer";
    const issuer = new Issuer({name:'', baseUrl, did:''}, {credential_configurations_supported:{}, credential_issuer:'', credential_endpoint: ''});
    const session = new Session();
    session.uuid = "bbb";
    session.data = { credentialOffer: { grants: { [GrantTypes.PRE_AUTHORIZED_CODE]: { "pre-authorized_code": "aaa" } } } };
    session.state = 'aaa';
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);
    vi.spyOn(issuer.dpopNonceStates, 'get').mockResolvedValue({ uuid: 'fresh-nonce' } as any);

    const key = await Factory.createFromType('Secp256r1');
    await key.initialisePrivateKey(CryptoKey.hexToBytes("fbe04e71bce89f37e0970de16a97a80c4457250c6fe0b1e9297e6df778ae72a8"));
    const jwk = await key.toJWK();
    const proof = new JWT();
    proof.header = { typ: 'dpop+jwt', jwk };
    proof.payload = { jti: 'jti-1', htm: 'POST', htu: baseUrl + '/token', iat: Math.floor(Date.now() / 1000) };
    await proof.sign(key, 'ES256');

    const err = await validateAccessTokenRequest(issuer, tokenRequest, proof.token).catch((e) => e);
    expect(err).toBeInstanceOf(DPoPNonceRequiredError);
    expect((err as DPoPNonceRequiredError).nonce).toBe('fresh-nonce');
});
