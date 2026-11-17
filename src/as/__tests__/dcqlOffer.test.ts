import { expect, test } from 'vitest';
import { applyPresentationDefaults, validatePresentationRequest } from '../dcqlOffer';
import { validateEmbeddedASConfiguration, EmbeddedASConfigurationError } from '../config';
import { Issuer } from '#root/issuer/Issuer';
import { ErrorCodes } from '#root/types/api';
import { validateCreateCredentialOfferV2 } from '#root/issuer/api/v2/validateCreateCredentialOffer';

const dcql = { credentials: [{ id: 'PID', format: 'dc+sd-jwt' }, { id: 'ADDRESS', format: 'dc+sd-jwt' }] };

function newIssuer(embedded: any = { enabled: true, mode: 'in-app', verifier: { url: 'https://v.example/x', verifierToken: 't' } }, claims: any = {}) {
    return new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '', ...(embedded && { embeddedAuthorizationServer: embedded }) },
        { credential_configurations_supported: { A: { format: 'dc+sd-jwt', claims } } } as any
    );
}
const request = (extra: any = {}): any => ({ credentials: [{ credential_configuration_id: 'A' }], dcql, ...extra });

test('a dcql query implies the authorization_code grant', () => {
    const r = request();
    applyPresentationDefaults(r);
    expect(r.grant).toBe('authorization_code');
    const other = request({ grant: 'pre-authorized_code' });
    applyPresentationDefaults(other);
    expect(other.grant).toBe('pre-authorized_code');
});

test('accepts a valid query', () => {
    const r = request(); applyPresentationDefaults(r);
    expect(validatePresentationRequest(newIssuer(), r)).toBeNull();
    expect(validateCreateCredentialOfferV2(newIssuer(), request()).error).toBe(ErrorCodes.NO_ERROR);
});

test('requests without a dcql query are not affected', () => {
    expect(validatePresentationRequest(newIssuer(null), { grant: 'authorization_code', credentials: [] } as any)).toBeNull();
});

test('create-offer fails when the AS cannot start a verification', () => {
    const r = request(); applyPresentationDefaults(r);
    expect(validatePresentationRequest(newIssuer(null), r)).toMatch(/embedded authorization server/);
    expect(validatePresentationRequest(newIssuer({ enabled: true, mode: 'in-app', verifier: { url: 'https://v' } }), r)).toMatch(/verifierToken/);
    expect(validatePresentationRequest(newIssuer({ enabled: true, mode: 'in-app', verifier: { verifierToken: 't' } }), r)).toMatch(/verifier.url/);
    expect(validatePresentationRequest(newIssuer({ enabled: true, verifier: { url: 'https://v', verifierToken: 't' } }), r)).toMatch(/clients/);
    const state = validateCreateCredentialOfferV2(newIssuer({ enabled: true, mode: 'in-app', verifier: { url: 'https://v' } }), request());
    expect(state.error).toBe(ErrorCodes.INVALID_REQUEST);
});

test('a dcql query cannot be combined with the pre-authorized grant', () => {
    expect(validateCreateCredentialOfferV2(newIssuer(), request({ grant: 'pre-authorized_code' })).error).toBe(ErrorCodes.INVALID_REQUEST);
});

test('validates the structure that the agent needs', () => {
    const issuer = newIssuer();
    const check = (q: any) => { const r = request({ dcql: q }); applyPresentationDefaults(r); return validatePresentationRequest(issuer, r); };
    expect(check({})).not.toBeNull();
    expect(check({ credentials: [] })).not.toBeNull();
    expect(check([])).not.toBeNull();
    expect(check({ credentials: [{ format: 'x' }] })).not.toBeNull();
    expect(check({ credentials: [{ id: 'a b' }] })).not.toBeNull();
    expect(check({ credentials: [{ id: 'A' }, { id: 'A' }] })).toMatch(/Duplicate/);
    expect(check({ credentials: [{ id: 'sub' }] })).toMatch(/access token claim/);
    expect(check({ credentials: [{ id: 'PID' }], credential_sets: 'passed on unchanged', anything: 1 })).toBeNull();
});

test('claims that read #accessData must refer to a credential of the query', () => {
    const claims = [{ path: ['given_name'], origin: [['#accessData', 'PID', 'given_name']] }];
    const r = request(); applyPresentationDefaults(r);
    expect(validatePresentationRequest(newIssuer(undefined, claims), r)).toBeNull();
    const typo = [{ path: ['given_name'], origin: [['#accessData', 'PIDD', 'given_name']] }];
    expect(validatePresentationRequest(newIssuer(undefined, typo), r)).toMatch(/PIDD/);
    const tokenClaim = [{ path: ['x'], origin: [['#accessData', 'iss']] }];
    expect(validatePresentationRequest(newIssuer(undefined, tokenClaim), r)).toBeNull();
});

test('configuration validation', () => {
    const base = (e: any, extra: any = {}) => ({ name: 'i', baseUrl: 'https://i', did: '', embeddedAuthorizationServer: e, ...extra });
    const verifier = { url: 'https://v', verifierToken: 't' };
    expect(() => validateEmbeddedASConfiguration(base({ enabled: false }))).not.toThrow();
    expect(() => validateEmbeddedASConfiguration(base({ enabled: true, mode: 'in-app', verifier }))).not.toThrow();
    // enabled with an external AS
    expect(() => validateEmbeddedASConfiguration(base({ enabled: true, mode: 'in-app', verifier }, { authorizationEndpoint: 'https://as' }))).toThrow(EmbeddedASConfigurationError);
    // no verifier url
    expect(() => validateEmbeddedASConfiguration(base({ enabled: true, mode: 'in-app' }))).toThrow(EmbeddedASConfigurationError);
    // redirect modes need clients
    expect(() => validateEmbeddedASConfiguration(base({ enabled: true, verifier }))).toThrow(EmbeddedASConfigurationError);
    const clients = [{ clientId: 'a', redirectUris: ['https://w/cb'] }];
    expect(() => validateEmbeddedASConfiguration(base({ enabled: true, verifier, clients }))).not.toThrow();
    expect(() => validateEmbeddedASConfiguration(base({ enabled: true, verifier, clients: [...clients, ...clients] }))).toThrow(/duplicate/);
    expect(() => validateEmbeddedASConfiguration(base({ enabled: true, verifier, clients: [{ clientId: 'a', redirectUris: ['https://w/cb#x'] }] }))).toThrow(EmbeddedASConfigurationError);
    expect(() => validateEmbeddedASConfiguration(base({ enabled: true, mode: 'in-app', verifier, codeTtl: 0 }))).toThrow(EmbeddedASConfigurationError);
});
