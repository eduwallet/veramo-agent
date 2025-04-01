import { expect, test} from 'vitest';
import { normalizeGrants } from '../normalizeGrants'
import { AUTHORIZATION_CODE_GRANT, PRE_AUTHORIZED_CODE, PRE_AUTHORIZED_CODE_GRANT, PreAuthGrant, TxCode } from '../../types/specification/credential_offer';
import type { APIGrants } from '../../types/api/credentialOffer';

test('generate authorization issuer state', () => {
    let grant:APIGrants = {};
    grant[AUTHORIZATION_CODE_GRANT] = {};
    const newGrant = normalizeGrants(grant);

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]).toBeTruthy();
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state).toBeTruthy();
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state?.length).toBeGreaterThan(0);
    expect(Object.keys(newGrant.grants[AUTHORIZATION_CODE_GRANT] || {}).length).toBe(1);
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state).toBe(newGrant.issuerState);
});

test('generate authorization issuer state from empty state', () => {
    let grant:APIGrants = {};
    grant[AUTHORIZATION_CODE_GRANT] = {issuer_state:''};
    const newGrant = normalizeGrants(grant);

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]).toBeTruthy();
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state).toBeTruthy();
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state?.length).toBeGreaterThan(0);
    expect(Object.keys(newGrant.grants[AUTHORIZATION_CODE_GRANT] || {}).length).toBe(1);
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state).toBe(newGrant.issuerState);
});

test('generate authorization issuer state from generate', () => {
    let grant:APIGrants = {};
    grant[AUTHORIZATION_CODE_GRANT] = {issuer_state:'generate'};
    const newGrant = normalizeGrants(grant);

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]).toBeTruthy();
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state).toBeTruthy();
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state?.length).toBeGreaterThan(0);
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state == 'generate').toBeFalsy();
    expect(Object.keys(newGrant.grants[AUTHORIZATION_CODE_GRANT] || {}).length).toBe(1);
    expect(newGrant.grants[AUTHORIZATION_CODE_GRANT]?.issuer_state).toBe(newGrant.issuerState);
});

test('generate pre-auth state', () => {
    let grant:APIGrants = {};
    grant[PRE_AUTHORIZED_CODE_GRANT] = {};
    const newGrant = normalizeGrants(grant);
    const preAuth = (newGrant.grants[PRE_AUTHORIZED_CODE_GRANT] || {}) as PreAuthGrant;

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[PRE_AUTHORIZED_CODE_GRANT]).toBeTruthy();
    expect(preAuth[PRE_AUTHORIZED_CODE]).toBeTruthy();
    expect(preAuth[PRE_AUTHORIZED_CODE]?.length).toBeGreaterThan(0);
    expect(Object.keys(preAuth).length).toBe(1);
    expect(preAuth[PRE_AUTHORIZED_CODE]).toBe(newGrant.preAuthorizedCode);
});

test('generate pre-auth state from empty', () => {
    let grant:APIGrants = {};
    grant[PRE_AUTHORIZED_CODE_GRANT] = {'pre-authorized_code':''};
    const newGrant = normalizeGrants(grant);
    const preAuth = (newGrant.grants[PRE_AUTHORIZED_CODE_GRANT] || {}) as PreAuthGrant;

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[PRE_AUTHORIZED_CODE_GRANT]).toBeTruthy();
    expect(preAuth[PRE_AUTHORIZED_CODE]).toBeTruthy();
    expect(preAuth[PRE_AUTHORIZED_CODE]?.length).toBeGreaterThan(0);
    expect(Object.keys(preAuth).length).toBe(1);
    expect(preAuth[PRE_AUTHORIZED_CODE]).toBe(newGrant.preAuthorizedCode);
});

test('generate pre-auth state from generate', () => {
    let grant:APIGrants = {};
    grant[PRE_AUTHORIZED_CODE_GRANT] = {'pre-authorized_code':'generate'};
    const newGrant = normalizeGrants(grant);
    const preAuth = (newGrant.grants[PRE_AUTHORIZED_CODE_GRANT] || {}) as PreAuthGrant;

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[PRE_AUTHORIZED_CODE_GRANT]).toBeTruthy();
    expect(preAuth[PRE_AUTHORIZED_CODE]).toBeTruthy();
    expect(preAuth[PRE_AUTHORIZED_CODE]?.length).toBeGreaterThan(0);
    expect(preAuth[PRE_AUTHORIZED_CODE] === 'generate').toBeFalsy();
    expect(Object.keys(preAuth).length).toBe(1);
    expect(preAuth[PRE_AUTHORIZED_CODE]).toBe(newGrant.preAuthorizedCode);
});

test('generate pin from boolean', () => {
    let grant:APIGrants = {};
    grant[PRE_AUTHORIZED_CODE_GRANT] = {'pre-authorized_code':'generate', tx_code: true};
    const newGrant = normalizeGrants(grant);
    const preAuth = (newGrant.grants[PRE_AUTHORIZED_CODE_GRANT] || {}) as PreAuthGrant;
    const txCode = preAuth.tx_code as TxCode;

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[PRE_AUTHORIZED_CODE_GRANT]).toBeTruthy();
    expect(preAuth.tx_code).toBeTruthy();
    expect(txCode.input_mode).toBe('numeric');
    expect(txCode.length).toBe(4);
    expect(txCode.description).toBe('PIN');
    expect(newGrant.userPin).toBeTruthy();
    expect(newGrant.userPin!.length).toBe(4);
});

test('generate pin from object', () => {
    let grant:APIGrants = {};
    grant[PRE_AUTHORIZED_CODE_GRANT] = {'pre-authorized_code':'generate', tx_code: {}};
    const newGrant = normalizeGrants(grant);
    const preAuth = (newGrant.grants[PRE_AUTHORIZED_CODE_GRANT] || {}) as PreAuthGrant;

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[PRE_AUTHORIZED_CODE_GRANT]).toBeTruthy();
    expect(preAuth.tx_code).toBeTruthy();
    expect(preAuth.tx_code?.input_mode).toBe('numeric');
    expect(preAuth.tx_code?.length).toBe(4);
    expect(preAuth.tx_code?.description).toBe('PIN');
    expect(newGrant.userPin).toBeTruthy();
    expect(newGrant.userPin!.length).toBe(4);
});

test('generate pin from object length', () => {
    let grant:APIGrants = {};
    grant[PRE_AUTHORIZED_CODE_GRANT] = {'pre-authorized_code':'generate', tx_code: {length:6}};
    const newGrant = normalizeGrants(grant);
    const preAuth = (newGrant.grants[PRE_AUTHORIZED_CODE_GRANT] || {}) as PreAuthGrant;
    const txCode = preAuth.tx_code as TxCode;

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[PRE_AUTHORIZED_CODE_GRANT]).toBeTruthy();
    expect(preAuth.tx_code).toBeTruthy();
    expect(txCode.input_mode).toBe('numeric');
    expect(txCode.length).toBe(6);
    expect(txCode.description).toBe('PIN');
    expect(newGrant.userPin).toBeTruthy();
    expect(newGrant.userPin!.length).toBe(6);
});

test('generate pin from object length and mode', () => {
    let grant:APIGrants = {};
    grant[PRE_AUTHORIZED_CODE_GRANT] = {'pre-authorized_code':'generate', tx_code: {length:8, input_mode:'text'}};
    const newGrant = normalizeGrants(grant);
    const preAuth = (newGrant.grants[PRE_AUTHORIZED_CODE_GRANT] || {}) as PreAuthGrant;
    const txCode = preAuth.tx_code as TxCode;

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[PRE_AUTHORIZED_CODE_GRANT]).toBeTruthy();
    expect(preAuth.tx_code).toBeTruthy();
    expect(txCode.input_mode).toBe('text');
    expect(txCode.length).toBe(8);
    expect(txCode.description).toBe('PIN');
    expect(newGrant.userPin).toBeTruthy();
    expect(newGrant.userPin!.length).toBe(8);
    expect(newGrant.userPin!.match(/^[A-Z]+$/)).toBeTruthy();
});

test('copy description', () => {
    let grant:APIGrants = {};
    grant[PRE_AUTHORIZED_CODE_GRANT] = {'pre-authorized_code':'generate', tx_code: {description: 'yolo'}};
    const newGrant = normalizeGrants(grant);
    const preAuth = (newGrant.grants[PRE_AUTHORIZED_CODE_GRANT] || {}) as PreAuthGrant;
    const txCode = preAuth.tx_code as TxCode;

    expect(Object.keys(newGrant.grants).length).toBe(1);
    expect(newGrant.grants[PRE_AUTHORIZED_CODE_GRANT]).toBeTruthy();
    expect(preAuth.tx_code).toBeTruthy();
    expect(txCode.description).toBe('yolo');
});
