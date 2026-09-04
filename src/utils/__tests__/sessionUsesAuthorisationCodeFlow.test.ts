import { expect, test } from 'vitest';
import { Session } from '#root/database/entities/index';
import { AUTHORIZATION_CODE_GRANT, PRE_AUTHORIZED_CODE_GRANT } from '#root/types/specification/credential_offer';
import { sessionUsesAuthorisationCodeFlow } from '../sessionUsesAuthorisationCodeFlow.js';

test('returns false when session is missing', () => {
    expect(sessionUsesAuthorisationCodeFlow(null)).toBe(false);
    expect(sessionUsesAuthorisationCodeFlow(undefined)).toBe(false);
});

test('returns false when the credential offer only has a pre-authorized_code grant', () => {
    const session = new Session();
    session.data = {
        credentialOffer: {
            grants: {
                [PRE_AUTHORIZED_CODE_GRANT]: { 'pre-authorized_code': 'aaa' }
            }
        }
    };
    expect(sessionUsesAuthorisationCodeFlow(session)).toBe(false);
});

test('returns true when the credential offer has an authorization_code grant', () => {
    const session = new Session();
    session.data = {
        credentialOffer: {
            grants: {
                [AUTHORIZATION_CODE_GRANT]: { issuer_state: 'xyz' }
            }
        }
    };
    expect(sessionUsesAuthorisationCodeFlow(session)).toBe(true);
});

test('returns true when both grants are present on the offer', () => {
    const session = new Session();
    session.data = {
        credentialOffer: {
            grants: {
                [AUTHORIZATION_CODE_GRANT]: { issuer_state: 'xyz' },
                [PRE_AUTHORIZED_CODE_GRANT]: { 'pre-authorized_code': 'aaa' }
            }
        }
    };
    expect(sessionUsesAuthorisationCodeFlow(session)).toBe(true);
});
