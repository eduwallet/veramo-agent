import { expect, test} from 'vitest';
import { ErrorCodes } from '../../../types/api';
import { GrantTypes, TokenRequest } from '../../../types/specification/access_token';
import { Issuer } from '../../Issuer';
import { validateAccessTokenRequest } from '../validateAccessTokenRequest';

test('basic offer', () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa"
    };
    const issuer = new Issuer({}, {});

    const sessionid = "bbb";
    const session = issuer.getSessionById(sessionid);
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    session.credentialOffer = {
        grants: {}
    };
    session.credentialOffer.grants[GrantTypes.PRE_AUTHORIZED_CODE] = {
        "pre-authorized_code": "aaa"
    };
    issuer.authorizationState.set('aaa', session.id);

    const result = validateAccessTokenRequest(issuer, tokenRequest);
    expect(!!(result || false)).toBe(true);
    expect(result.error).toBe(ErrorCodes.NO_ERROR);
    expect(!!(result.data)).toBe(true);
    expect(!!(result.data.session)).toBe(true);
    expect(result.data.session.id).toBe(session.id);
});

test('numeric pin code', () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa",
        tx_code: "1234"
    };
    const issuer = new Issuer({}, {});

    const sessionid = "bbb";
    const session = issuer.getSessionById(sessionid);
    expect(session).toBeDefined();
    expect(session.id).toBeDefined();
    session.pinCode = '1234';
    session.credentialOffer = {
        grants: {}
    };
    session.credentialOffer.grants[GrantTypes.PRE_AUTHORIZED_CODE] = {
        "pre-authorized_code": "aaa"
    };
    issuer.authorizationState.set('aaa', session.id);

    const result = validateAccessTokenRequest(issuer, tokenRequest);
    expect(!!(result || false)).toBe(true);
    expect(result.error).toBe(ErrorCodes.NO_ERROR);
});
