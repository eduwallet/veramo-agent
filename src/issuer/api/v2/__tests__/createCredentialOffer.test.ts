import { vi, expect, test, beforeEach } from 'vitest';
import { Session } from '#root/database/entities/index';
import { ErrorCodes } from '#root/types/api';
import { claimsToData } from '#root/issuer/lib/claimsToData';
import { createCredentialOfferV2 } from '../createCredentialOffer';
import { validateCreateCredentialOfferV2 } from '../validateCreateCredentialOffer';
import { createAccessTokenResponse } from '#root/issuer/api/createAccessTokenResponse';

function newIssuer(deferred:string[] = []) {
    const session = new Session();
    session.uuid = 'sess-1';
    session.data = {} as any;
    return {
        name: 'issuer',
        options: { baseUrl: 'https://example.com' },
        usesNonces: false,
        did: { did: 'did:example:1' },
        signToken: vi.fn(async () => 'token'),
        session,
        hasCredentialConfiguration: (id:string) => ['A', 'B'].concat(deferred).includes(id),
        getDeferredSettings: (id:string) => deferred.includes(id) ? { ttl: 1, interval: 1 } : null,
        getCredentialConfiguration: (id:string) => ({ format: 'dc+sd-jwt', id }),
        checkCredentialData: vi.fn(() => true),
        clearExpired: vi.fn(),
        getSessionById: vi.fn(async () => session),
        storeSession: vi.fn(),
    } as any;
}

beforeEach(() => vi.clearAllMocks());

test('claimsToData builds nested objects and arrays and ignores unsafe paths', () => {
    expect(claimsToData([
        { path: ['credentialSubject', 'name'], value: 'x' },
        { path: ['credentialSubject', 'tags', 0], value: 'a' },
        { path: ['age'], value: 3 },
    ])).toEqual({ credentialSubject: { name: 'x', tags: ['a'] }, age: 3 });
});

test('creates one data set per credential, with a unique identifier', async () => {
    const issuer = newIssuer();
    const result = await createCredentialOfferV2(issuer, {
        grant: 'pre-authorized_code',
        tx_code: { description: 'pin' },
        credentials: [
            { credential_configuration_id: 'A', claims: [{ path: ['n'], value: 1 }] },
            { credential_configuration_id: 'A', claims: [{ path: ['n'], value: 2 }] },
            { credential_configuration_id: 'B' },
        ],
    });
    const data = issuer.session.data;
    expect(Object.keys(data.credentialDataSets)).toEqual(['A#0', 'A#1', 'B#2']);
    expect(data.credentialDataSets['A#1'].data).toEqual({ n: 2 });
    expect(data.credentialDataSets['A#1'].credentialId).toBe('A');
    expect(data.credentialOffer.credential_configuration_ids).toEqual(['A', 'B']);
    const grant = data.credentialOffer.grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'];
    expect(grant.tx_code).toEqual({ input_mode: 'numeric', length: 4, description: 'pin' });
    expect(result.pinCode).toHaveLength(4);
});

test('the token response lists all data sets per credential configuration', async () => {
    const issuer = newIssuer();
    await createCredentialOfferV2(issuer, {
        grant: 'authorization_code',
        credentials: [{ credential_configuration_id: 'A' }, { credential_configuration_id: 'B' }, { credential_configuration_id: 'A' }],
    });
    const response = await createAccessTokenResponse(issuer, issuer.session);
    expect(response.authorization_details).toEqual([
        { type: 'openid_credential', credential_configuration_id: 'A', credential_identifiers: ['A#0', 'A#2'] },
        { type: 'openid_credential', credential_configuration_id: 'B', credential_identifiers: ['B#1'] },
    ]);
});

test.each([
    ['missing grant', { credentials: [{ credential_configuration_id: 'A' }] }],
    ['unknown grant', { grant: 'x', credentials: [{ credential_configuration_id: 'A' }] }],
    ['no credentials', { grant: 'authorization_code', credentials: [] }],
    ['unknown credential', { grant: 'authorization_code', credentials: [{ credential_configuration_id: 'Z' }] }],
    ['tx_code without description', { grant: 'pre-authorized_code', tx_code: {}, credentials: [{ credential_configuration_id: 'A' }] }],
    ['tx_code for authorization_code', { grant: 'authorization_code', tx_code: { description: 'd' }, credentials: [{ credential_configuration_id: 'A' }] }],
    ['malformed claim', { grant: 'authorization_code', credentials: [{ credential_configuration_id: 'A', claims: [{ path: [], value: 1 }] }] }],
    ['prototype pollution path', { grant: 'authorization_code', credentials: [{ credential_configuration_id: 'A', claims: [{ path: ['__proto__', 'x'], value: 1 }] }] }],
])('rejects %s', (_name, request) => {
    expect(validateCreateCredentialOfferV2(newIssuer(), request as any).error).toBe(ErrorCodes.INVALID_REQUEST);
});

test('rejects incomplete claims for pre-authorized_code, but not for authorization_code', () => {
    const issuer = newIssuer();
    issuer.checkCredentialData.mockReturnValue(false);
    const credentials = [{ credential_configuration_id: 'A' }];
    expect(validateCreateCredentialOfferV2(issuer, { grant: 'pre-authorized_code', credentials }).error).toBe(ErrorCodes.INVALID_REQUEST);
    expect(validateCreateCredentialOfferV2(issuer, { grant: 'authorization_code', credentials }).error).toBe(ErrorCodes.NO_ERROR);
});

test('deferred and non-deferred credentials can be offered together, without complete claims for the deferred one', () => {
    const issuer = newIssuer(['D']);
    issuer.checkCredentialData.mockImplementation((id:string) => id !== 'D');
    const credentials = [{ credential_configuration_id: 'A' }, { credential_configuration_id: 'D' }];
    expect(validateCreateCredentialOfferV2(issuer, { grant: 'pre-authorized_code', credentials }).error).toBe(ErrorCodes.NO_ERROR);
    expect(issuer.checkCredentialData).toHaveBeenCalledTimes(1);
});
