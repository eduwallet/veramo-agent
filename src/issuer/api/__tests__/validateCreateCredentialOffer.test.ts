import { expect, test, vi } from 'vitest';
import { ErrorCodes } from '#root/types/api';
import { validateCreateCredentialOffer } from '../validateCreateCredentialOffer';

const issuer:any = {
    name: 'issuer',
    hasCredentialConfiguration: () => ({}),
    getDeferredSettings: () => null,
    checkCredentialData: vi.fn(() => true),
};

function request(extra:object) {
    return { credentials: ['A'], grants: { authorization_code: {} }, ...extra } as any;
}

test.each([5, 'callback', 'file:///etc/passwd', ''])('rejects credential_callback %j', (credential_callback) => {
    expect(validateCreateCredentialOffer(issuer, request({ credential_callback })).error).toBe(ErrorCodes.INVALID_REQUEST);
});

test('accepts a missing or https credential_callback', () => {
    expect(validateCreateCredentialOffer(issuer, request({})).error).toBe(ErrorCodes.NO_ERROR);
    expect(validateCreateCredentialOffer(issuer, request({ credential_callback: 'https://example.com/hook' })).error).toBe(ErrorCodes.NO_ERROR);
});
