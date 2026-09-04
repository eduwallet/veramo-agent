import { vi, expect, test, beforeEach } from 'vitest';
import type { Express, Router } from 'express';
import { Issuer } from '../../issuer/Issuer.js';
import { createRoutesForIssuer } from '../createRoutesForIssuer.js';
import { IssuerConfiguration } from '#root/types/internal';
import { MetadataConfiguration } from '#root/types/api/metadata';
import {
    accessToken,
    createCredentialOfferResponse,
    getCredential,
    getCredentialOffer,
    getIssueStatus,
    getMetadata,
    getDidSpec,
    getOpenidConfiguration,
    getOAuthConfiguration,
    listCredentials,
    revokeCredential,
    getNonce,
} from '../endpoints/index.js';
import { getOIDFed } from '../endpoints/getOIDFed.js';
import { revokeIndex } from '../endpoints/statuslists/revokeIndex.js';
import { getStatus } from '../endpoints/statuslists/getStatus.js';
import { setStatus } from '../endpoints/statuslists/setStatus.js';
import { getStatusListCredential } from '../endpoints/statuslists/getStatusListCredential.js';

vi.mock('../endpoints/index.js', () => ({
    accessToken: vi.fn(),
    createCredentialOfferResponse: vi.fn(),
    getCredential: vi.fn(),
    getCredentialOffer: vi.fn(),
    getIssueStatus: vi.fn(),
    getMetadata: vi.fn(),
    getDidSpec: vi.fn(),
    getOpenidConfiguration: vi.fn(),
    getOAuthConfiguration: vi.fn(),
    listCredentials: vi.fn(),
    revokeCredential: vi.fn(),
    getNonce: vi.fn(),
}));
vi.mock('../endpoints/getOIDFed.js', () => ({ getOIDFed: vi.fn() }));
vi.mock('../endpoints/statuslists/revokeIndex.js', () => ({ revokeIndex: vi.fn() }));
vi.mock('../endpoints/statuslists/getStatus.js', () => ({ getStatus: vi.fn() }));
vi.mock('../endpoints/statuslists/setStatus.js', () => ({ setStatus: vi.fn() }));
vi.mock('../endpoints/statuslists/getStatusListCredential.js', () => ({ getStatusListCredential: vi.fn() }));
// unused in createRoutesForIssuer.ts, but imported for its (side-effecting) type; keep it out of the module graph
vi.mock('#root/statusLists/StatusListType', () => ({ StatusListType: vi.fn() }));

function createIssuer(options: Partial<IssuerConfiguration> = {}, metadata: Partial<MetadataConfiguration> = {}): Issuer {
    return new Issuer(
        { name: 'acme', baseUrl: 'https://issuer.example.com', did: 'did-config', ...options },
        { credential_configurations_supported: {}, credential_issuer: '', credential_endpoint: '', ...metadata },
    );
}

function createApp() {
    return { use: vi.fn() } as unknown as Express;
}

const wellKnownRouter = {} as Router;

beforeEach(() => {
    vi.clearAllMocks();
});

test('creates the always-on endpoints with the right paths', async () => {
    const issuer = createIssuer();
    const app = createApp();

    await createRoutesForIssuer(issuer, app, wellKnownRouter);

    expect(issuer.router).toBeDefined();
    expect(app.use).toHaveBeenCalledWith('/acme', issuer.router);

    expect(accessToken).toHaveBeenCalledWith(issuer, '/token');
    expect(getMetadata).toHaveBeenCalledWith(issuer, '/acme', wellKnownRouter);
    expect(getOIDFed).toHaveBeenCalledWith(issuer);
    expect(getCredential).toHaveBeenCalledWith(issuer, '/credentials');
    expect(createCredentialOfferResponse).toHaveBeenCalledWith(issuer, '/api/create-offer', '/get-credential-offer');
    expect(getCredentialOffer).toHaveBeenCalledWith(issuer, '/get-credential-offer/:id');
    expect(getIssueStatus).toHaveBeenCalledWith(issuer, '/api/check-offer');
    expect(listCredentials).toHaveBeenCalledWith(issuer, '/api/list-credentials');
    expect(revokeCredential).toHaveBeenCalledWith(issuer, '/api/revoke-credential');
});

test('registers the nonce endpoint only when the issuer uses nonces', async () => {
    const withNonces = createIssuer({ usesNonces: true });
    await createRoutesForIssuer(withNonces, createApp(), wellKnownRouter);
    expect(getNonce).toHaveBeenCalledWith(withNonces);

    vi.clearAllMocks();

    const withoutNonces = createIssuer({ usesNonces: false });
    await createRoutesForIssuer(withoutNonces, createApp(), wellKnownRouter);
    expect(getNonce).not.toHaveBeenCalled();
});

test('registers the did:web endpoint only when the issuer did provider is did:web', async () => {
    const didWebIssuer = createIssuer();
    didWebIssuer.did = { provider: 'did:web' } as Issuer['did'];
    await createRoutesForIssuer(didWebIssuer, createApp(), wellKnownRouter);
    expect(getDidSpec).toHaveBeenCalledWith(didWebIssuer);

    vi.clearAllMocks();

    const didJwkIssuer = createIssuer();
    didJwkIssuer.did = { provider: 'did:jwk' } as Issuer['did'];
    await createRoutesForIssuer(didJwkIssuer, createApp(), wellKnownRouter);
    expect(getDidSpec).not.toHaveBeenCalled();

    vi.clearAllMocks();

    // did is null until setDid() is called
    const noDidIssuer = createIssuer();
    await createRoutesForIssuer(noDidIssuer, createApp(), wellKnownRouter);
    expect(getDidSpec).not.toHaveBeenCalled();
});

test('always registers the AS endpoints, even when an external authorization server is configured', async () => {
    const selfAsIssuer = createIssuer();
    await createRoutesForIssuer(selfAsIssuer, createApp(), wellKnownRouter);
    expect(getOpenidConfiguration).toHaveBeenCalledWith(selfAsIssuer, '/acme', 'https://issuer.example.com/token', wellKnownRouter);
    expect(getOAuthConfiguration).toHaveBeenCalledWith(selfAsIssuer, '/acme', 'https://issuer.example.com/token', wellKnownRouter);

    vi.clearAllMocks();

    // an external AS only serves the authorization_code flow; the issuer may still act as
    // its own AS for pre-authorized_code flow sessions, so these must still be published.
    const externalAsIssuer = createIssuer({ authorizationEndpoint: 'https://as.example.com/authorize' });
    await createRoutesForIssuer(externalAsIssuer, createApp(), wellKnownRouter);
    expect(getOpenidConfiguration).toHaveBeenCalledWith(externalAsIssuer, '/acme', 'https://issuer.example.com/token', wellKnownRouter);
    expect(getOAuthConfiguration).toHaveBeenCalledWith(externalAsIssuer, '/acme', 'https://issuer.example.com/token', wellKnownRouter);
});

test('creates no status list endpoints when the metadata has no status lists', async () => {
    const issuer = createIssuer();
    await createRoutesForIssuer(issuer, createApp(), wellKnownRouter);

    expect(revokeIndex).not.toHaveBeenCalled();
    expect(getStatus).not.toHaveBeenCalled();
    expect(setStatus).not.toHaveBeenCalled();
    expect(getStatusListCredential).not.toHaveBeenCalled();
});

test('creates status list endpoints for every status list referenced by the credential configurations', async () => {
    const issuer = createIssuer({}, {
        credential_configurations_supported: {
            badge: {
                format: 'jwt_vc_json',
                statuslist: [
                    { name: 'revocation', size: 100000, purpose: 'revocation' },
                    { name: 'suspension', size: 100000, purpose: 'suspension' },
                ],
            },
        },
    });

    await createRoutesForIssuer(issuer, createApp(), wellKnownRouter);

    expect(revokeIndex).toHaveBeenCalledTimes(2);
    expect(getStatus).toHaveBeenCalledTimes(2);
    expect(setStatus).toHaveBeenCalledTimes(2);
    expect(getStatusListCredential).toHaveBeenCalledTimes(2);

    const [revocationSlo, suspensionSlo] = issuer.findAllStatusLists();

    expect(revokeIndex).toHaveBeenCalledWith(issuer, revocationSlo, '/api/sl/revocation/revoke');
    expect(getStatus).toHaveBeenCalledWith(issuer, revocationSlo, '/api/sl/revocation/status');
    expect(setStatus).toHaveBeenCalledWith(issuer, revocationSlo, '/api/sl/revocation/status');
    expect(getStatusListCredential).toHaveBeenCalledWith(issuer, revocationSlo, '/sl/revocation');

    expect(revokeIndex).toHaveBeenCalledWith(issuer, suspensionSlo, '/api/sl/suspension/revoke');
    expect(getStatus).toHaveBeenCalledWith(issuer, suspensionSlo, '/api/sl/suspension/status');
    expect(setStatus).toHaveBeenCalledWith(issuer, suspensionSlo, '/api/sl/suspension/status');
    expect(getStatusListCredential).toHaveBeenCalledWith(issuer, suspensionSlo, '/sl/suspension');
});
