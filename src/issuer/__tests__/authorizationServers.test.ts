import { expect, test, vi } from 'vitest';
import { Issuer } from '../Issuer';
import { AuthorizationServerSelectionError } from '../lib/AuthorizationServerSelectionError';
import { expectedTokenIssuers } from '#root/utils/expectedTokenIssuers';
import { normalizeGrants } from '#root/protocol/normalizeGrants';
import { createCredentialOfferForDataSets } from '../api/createCredentialOffer';
import { createAccessTokenResponse } from '../api/createAccessTokenResponse';
import { Session } from '#root/database/entities/index';
import { JWT } from '#root/jwt/JWT';

const BASE = 'https://i.example/tenant';
const EXTERNAL = 'https://as.example';

function newIssuer(options:any = {}) {
    return new Issuer({ name: 'i', baseUrl: BASE, did: 'did:x', ...options }, { credential_configurations_supported: {} } as any);
}
const embedded = { embeddedAuthorizationServer: { enabled: true } };
const external = { authorizationEndpoint: EXTERNAL };

test('the authorization servers of the metadata', () => {
    expect(newIssuer().authorizationServers()).toEqual([BASE]);
    expect(newIssuer(embedded).authorizationServers()).toEqual([BASE, BASE + '/as']);
    expect(newIssuer({ ...embedded, ...external }).authorizationServers()).toEqual([BASE, BASE + '/as', EXTERNAL]);
    expect(newIssuer({ ...external, preAuthorizedCode: false }).authorizationServers()).toEqual([EXTERNAL]);
    expect(newIssuer({ ...embedded, preAuthorizedCode: false }).authorizationServers()).toEqual([BASE + '/as']);
    expect(newIssuer({ ...embedded, ...external }).generateMetadata().authorization_servers).toEqual([BASE, BASE + '/as', EXTERNAL]);
});

test('selecting the authorization server for an offer', () => {
    const both = newIssuer({ ...embedded, ...external });
    expect(both.authorizationServerFor('pre-authorized_code', false)).toBe(BASE);
    expect(both.authorizationServerFor('authorization_code', true)).toBe(BASE + '/as');
    expect(both.authorizationServerFor('authorization_code', false)).toBe(EXTERNAL);

    const onlyEmbedded = newIssuer(embedded);
    expect(onlyEmbedded.authorizationServerFor('authorization_code', false)).toBe(BASE + '/as');
    expect(onlyEmbedded.authorizationServerFor('authorization_code', true)).toBe(BASE + '/as');

    const onlyExternal = newIssuer(external);
    expect(onlyExternal.authorizationServerFor('authorization_code', false)).toBe(EXTERNAL);
    expect(() => onlyExternal.authorizationServerFor('authorization_code', true)).toThrow(AuthorizationServerSelectionError);

    const plain = newIssuer();
    expect(() => plain.authorizationServerFor('authorization_code', false)).toThrow(AuthorizationServerSelectionError);
    expect(() => newIssuer({ ...external, preAuthorizedCode: false }).authorizationServerFor('pre-authorized_code', false)).toThrow(AuthorizationServerSelectionError);
});

test('the expected token issuers come from the grants of the offer', () => {
    const session = (grants:any) => ({ data: { credentialOffer: { grants } } }) as any;
    expect(expectedTokenIssuers(session({ authorization_code: { authorization_server: EXTERNAL } }))).toEqual([EXTERNAL]);
    expect(expectedTokenIssuers(session({ authorization_code: { authorization_server: 'a' }, 'urn:x': { authorization_server: 'b' } }))).toEqual(['a', 'b']);
    // no authorization server, no session: nothing is accepted
    expect(expectedTokenIssuers(session({ authorization_code: {} }))).toEqual([]);
    expect(expectedTokenIssuers(null)).toEqual([]);
});

test('a caller cannot choose the authorization server', () => {
    const { grants } = normalizeGrants({
        authorization_code: { issuer_state: 'generate', authorization_server: 'https://evil' } as any,
        'urn:ietf:params:oauth:grant-type:pre-authorized_code': { authorization_server: 'https://evil' } as any,
    });
    expect((grants.authorization_code as any).authorization_server).toBeUndefined();
    expect((grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'] as any).authorization_server).toBeUndefined();
});

async function offerFor(issuer:Issuer, grants:any, presentation?:any) {
    const session = new Session();
    session.uuid = 's';
    session.data = {} as any;
    vi.spyOn(issuer, 'clearExpired').mockResolvedValue(undefined as any);
    vi.spyOn(issuer, 'getSessionById').mockResolvedValue(session);
    vi.spyOn(issuer, 'storeSession').mockResolvedValue(undefined as any);
    vi.spyOn(issuer, 'getDeferredSettings').mockReturnValue(null);
    vi.spyOn(issuer, 'getCredentialConfiguration').mockReturnValue({} as any);
    await createCredentialOfferForDataSets(issuer, { grants, dataSets: [{ credentialId: 'A' }], ...(presentation && { presentation }) });
    return session.data.credentialOffer;
}

test('the offer names the authorization server per grant, and has no client_id', async () => {
    const issuer = newIssuer({ ...embedded, ...external });
    const pre = await offerFor(issuer, { 'urn:ietf:params:oauth:grant-type:pre-authorized_code': { 'pre-authorized_code': 'generate' } });
    expect(pre!.grants!['urn:ietf:params:oauth:grant-type:pre-authorized_code']!.authorization_server).toBe(BASE);

    const code = await offerFor(issuer, { authorization_code: { issuer_state: 'generate' } });
    expect(code!.grants!.authorization_code!.authorization_server).toBe(EXTERNAL);
    expect((code as any).client_id).toBeUndefined();

    const presentation = await offerFor(issuer, { authorization_code: { issuer_state: 'generate' } }, { dcql: {} });
    expect(presentation!.grants!.authorization_code!.authorization_server).toBe(BASE + '/as');
});

test('the pre-authorized access token is an RFC 9068 token of the issuer', async () => {
    const issuer = newIssuer();
    issuer.did = { did: 'did:x' } as any;
    let signed:JWT|undefined;
    vi.spyOn(issuer, 'signToken').mockImplementation(async (jwt:JWT) => { signed = jwt; return 'token'; });
    vi.spyOn(issuer, 'storeSession').mockResolvedValue(undefined as any);
    issuer.usesNonces = false;
    const session = new Session();
    session.uuid = 's';
    session.state = 'state';
    session.data = {} as any;
    await createAccessTokenResponse(issuer, session);
    expect(signed!.header.typ).toBe('at+jwt');
    expect(signed!.payload.iss).toBe(BASE);
    expect(signed!.payload.aud).toBe(BASE);
    expect(typeof signed!.payload.jti).toBe('string');
    expect(signed!.payload.issuer_state).toBe('state');
});
