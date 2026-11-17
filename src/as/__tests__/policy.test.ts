import { expect, test } from 'vitest';
import { evaluatePresentation } from '../policy';

const dcql = {
    credentials: [
        { id: 'PID', format: 'dc+sd-jwt', claims: [{ path: ['given_name'] }, { path: ['address', 'locality'] }] },
        { id: 'ADDRESS', format: 'dc+sd-jwt', multiple: true }
    ]
};
const ok = [{ code: 'JWT_VERIFIED' }, { code: 'STATUS_LIST_VALID' }, { code: 'NO_STATUS_LIST' }, { code: 'VCDM2' }, { code: 'OIDFED_OK' }, { code: 'CREDENTIAL_OK' }, { code: 'VCDM1.1' }];
const pid = { claims: { given_name: 'A', address: { locality: 'X' } }, issuer: 'did:iss', holder: 'did:holder' };

function check(credentials: any, messages: any[] = ok, status = 'RESPONSE_RECEIVED') {
    return evaluatePresentation(dcql, { status, result: { credentials, messages } });
}

test('accepts a complete response and stores the claims per credential id', () => {
    const outcome = check({ PID: [pid], ADDRESS: [{ claims: { street: 's' } }] });
    expect(outcome.accepted).toBe(true);
    expect(outcome.presentationData).toEqual({ PID: pid.claims, ADDRESS: { street: 's' } });
    expect(outcome.presentationMeta!.PID).toEqual({ issuer: 'did:iss', holder: 'did:holder' });
});

test('an array of claims is stored when the wallet used multiple', () => {
    const outcome = check({ PID: [pid], ADDRESS: [{ claims: { a: 1 } }, { claims: { a: 2 } }] });
    expect(outcome.presentationData!.ADDRESS).toEqual([{ a: 1 }, { a: 2 }]);
});

test('rejects when the status is not RESPONSE_RECEIVED or the result is missing', () => {
    expect(check({ PID: [pid], ADDRESS: [{ claims: {} }] }, ok, 'RESPONSE_PROCESSING').accepted).toBe(false);
    expect(evaluatePresentation(dcql, { status: 'RESPONSE_RECEIVED' }).accepted).toBe(false);
});

test('every message code that is not accepted is an error', () => {
    for (const code of ['INVALID_VC', 'STATUS_LIST_REVOKED', 'SOMETHING_NEW']) {
        expect(check({ PID: [pid], ADDRESS: [{ claims: {} }] }, [...ok, { code }]).accepted).toBe(false);
    }
});

test('rejects a missing credential unless credential_sets are used', () => {
    expect(check({ PID: [pid] }).accepted).toBe(false);
    const withSets = { ...dcql, credential_sets: [{ options: [['PID'], ['ADDRESS']] }] };
    const outcome = evaluatePresentation(withSets, { status: 'RESPONSE_RECEIVED', result: { credentials: { PID: [pid] }, messages: ok } });
    expect(outcome.accepted).toBe(true);
    expect(Object.keys(outcome.presentationData!)).toEqual(['PID']);
});

test('rejects an empty response and drops credentials that were not asked for', () => {
    expect(check({}).accepted).toBe(false);
    expect(check({ OTHER: [pid] }).accepted).toBe(false);
    const outcome = check({ PID: [pid], ADDRESS: [{ claims: {} }], OTHER: [pid] });
    expect(Object.keys(outcome.presentationData!)).toEqual(['PID', 'ADDRESS']);
});

test('rejects a presented credential that misses a requested claim', () => {
    expect(check({ PID: [{ claims: { given_name: 'A' } }], ADDRESS: [{ claims: {} }] }).accepted).toBe(false);
});

test('rejects more than one presentation without multiple', () => {
    expect(check({ PID: [pid, pid], ADDRESS: [{ claims: {} }] }).accepted).toBe(false);
});
