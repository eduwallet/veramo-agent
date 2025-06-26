import { vi, expect, test} from 'vitest';
import { ErrorCodes } from '../../../types/api.js';
import { GrantTypes, TokenRequest } from '../../../types/specification/access_token.js';
import { Issuer } from '../../Issuer.js';
import { validateAccessTokenRequest } from '../validateAccessTokenRequest.js';
import { Session } from '#root/packages/datastore/entities/Session';

test('basic offer', async () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa"
    };
    const issuer = new Issuer({name:'', baseUrl:"", did:''}, {credential_configurations_supported:{}, credential_issuer:'', credential_endpoint: ''});
    const sessionid = "bbb";
    const session = new Session();
    session.uuid = sessionid;
    session.data = {};
    session.data.credentialOffer = {
        grants: {}
    };
    session.data.credentialOffer.grants[GrantTypes.PRE_AUTHORIZED_CODE] = {
        "pre-authorized_code": "aaa"
    };
    session.state = 'aaa';
    vi.spyOn(issuer, 'getSessionById').mockResolvedValue(session);
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);

    const result = await validateAccessTokenRequest(issuer, tokenRequest);
    expect(!!(result || false)).toBe(true);
    expect(result.error).toBe(ErrorCodes.NO_ERROR);
    expect(!!(result.data)).toBe(true);
    expect(!!(result.data.session)).toBe(true);
    expect(result.data.session.id).toBe(session.id);
});

test('numeric pin code', async () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa",
        tx_code: "1234"
    };
    const issuer = new Issuer({name:'', baseUrl:"", did:''}, {credential_configurations_supported:{}, credential_issuer:'', credential_endpoint: ''});

    const sessionid = "bbb";
    const session = new Session();
    session.uuid = sessionid;
    session.data = {};
    session.data.pinCode = '1234';
    session.data.credentialOffer = {
        grants: {}
    };
    session.data.credentialOffer.grants[GrantTypes.PRE_AUTHORIZED_CODE] = {
        "pre-authorized_code": "aaa"
    };
    session.state = 'aaa';
    vi.spyOn(issuer, 'getSessionById').mockResolvedValue(session);
    vi.spyOn(issuer, 'getSessionByState').mockResolvedValue(session);

    const result = await validateAccessTokenRequest(issuer, tokenRequest);
    expect(!!(result || false)).toBe(true);
    expect(result.error).toBe(ErrorCodes.NO_ERROR);
});
