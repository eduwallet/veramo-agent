import { vi, expect, test } from 'vitest';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';
import { getIssueStatus } from '../endpoints/getIssueStatus';

vi.mock('passport', () => ({ default: { authenticate: () => vi.fn() } }));

function setup(session:Session) {
    const issuer = new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
        { credential_configurations_supported: {}, credential_issuer: '', credential_endpoint: '' } as any
    );
    let handler:any;
    issuer.router = { post: (_path:string, _auth:any, h:any) => { handler = h; } } as any;
    getIssueStatus(issuer, '/api/check-offer');
    vi.spyOn(issuer, 'getSessionById').mockResolvedValue(session);
    return handler;
}

function newSession(data:object) {
    const session = new Session();
    session.uuid = 'sess-1';
    session.data = { status: 'CREDENTIAL_ISSUED', createdAt: 1, lastUpdatedAt: 2, credentialOffer: {}, ...data } as any;
    return session;
}

async function check(session:Session) {
    const res:any = { statusCode: 200 };
    res.status = (c:number) => { res.statusCode = c; return res; };
    res.json = (b:any) => { res.body = b; return res; };
    await setup(session)({ body: { id: 'sess-1' } }, res);
    return res;
}

test('lists every issued credential with its data set', async () => {
    const issuedCredentials = [
        { uuid: 'u1', dataset_id: 'A#0', credential_configuration_id: 'A' },
        { uuid: 'u2', dataset_id: 'B#1', credential_configuration_id: 'B' },
        { uuid: 'u3', dataset_id: 'B#1', credential_configuration_id: 'B' },
    ];
    const res = await check(newSession({ issuedCredentials }));
    expect(res.body.credentials).toStrictEqual(issuedCredentials);
    expect(res.body).not.toHaveProperty('uuid');
});

test('has no credentials attribute before anything was issued', async () => {
    const res = await check(newSession({ status: 'OFFER_CREATED' }));
    expect(res.body).not.toHaveProperty('credentials');
});
