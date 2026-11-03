import { expect, test } from 'vitest';
import { Credential } from '#root/credentials/Credential';
import { CredentialFactory } from '#root/credentials/CredentialFactory';
import { Issuer } from '#root/issuer/Issuer';
import { Session } from '#root/database/entities/index';

function newIssuer() {
    return new Issuer(
        { name: 'issuer', baseUrl: 'https://example.com/issuer', did: '' },
        { credential_configurations_supported: {}, credential_issuer: '', credential_endpoint: '' } as any
    );
}

function newSession(accessData:any) {
    const session = new Session();
    session.uuid = 'sess-1';
    session.data = { accessData } as any;
    return session;
}

function newCredential(scope:string, claims:any[], data:any) {
    const credential = new Credential();
    credential.issuer = newIssuer();
    credential.setConfiguration({
        format: 'dc+sd-jwt',
        scope,
        credential_definition: { type: [scope], claims }
    } as any);
    credential.data = data;
    return credential;
}

test('generic credentials get claims from their configured origins', async () => {
    const credential = newCredential('Test', [
        { path: ['name'], origin: [['#deferred', 'name'], ['#offer', 'name']] },
        { path: ['email'], origin: [['#accessData', 'email']] },
    ], { name: 'offer' });
    credential.deferredData = { name: 'deferred' };
    expect(await CredentialFactory.resolve(credential, newSession({ email: 'a@b.c' }))).toBe(true);
    expect(credential.data.name).toBe('deferred');
    expect(credential.data.email).toBe('a@b.c');
});

test('generic credentials without claim configuration are not changed', async () => {
    const credential = newCredential('Test', [], { name: 'offer', other: 1 });
    await CredentialFactory.resolve(credential, newSession({ email: 'a@b.c' }));
    expect(credential.data).toStrictEqual({ name: 'offer', other: 1 });
});

test('type specific credentials use the copied claims', async () => {
    const credential = newCredential('AcademicEnrollmentCredential', [
        { path: ['name'], origin: [['#deferred', 'name']] },
        { path: ['phase'], origin: [['#offer', 'phase']] },
    ], { name: 'offer', phase: 'bachelor' });
    credential.deferredData = { name: 'deferred' };
    await CredentialFactory.resolve(credential, newSession({}));
    expect(credential.data).toStrictEqual({ name: 'deferred', phase: 'bachelor' });
});

test('PID credentials can take claims from the access data', async () => {
    const credential = newCredential('PID', [
        { path: ['personal_administrative_number'], origin: [['#accessData', 'sub']] },
        { path: ['issuance_date'], origin: [['#offer', 'issuance_date']] },
    ], { issuance_date: '01-02-2024' });
    await CredentialFactory.resolve(credential, newSession({ sub: '12345' }));
    expect(credential.data.personal_administrative_number).toBe('12345');
    expect(credential.principalId).toBe('12345');
});
