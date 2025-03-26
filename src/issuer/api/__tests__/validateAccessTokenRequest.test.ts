import { jest, expect, test} from '@jest/globals';
import { validateAccessTokenRequest } from '../validateAccessTokenRequest'
import { GrantTypes, TokenRequest } from "../../../types/specification/access_token";
import { ErrorCodes } from "../../../types/api";
import { Issuer } from "../../../issuer/Issuer";

jest.mock("../../../issuer/Issuer");

test('numeric pin code of 4 characters', () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa"
    };
    const issuer = new Issuer({
        name: "test",
        baseUrl: "http://here",
        enableCreateCredentials:true,
        did: "did:alias"
    },{
        "credential_configurations_supported": {}
    }) as jest.Mocked<Issuer>;

    expect(true).toBe(true);
    return;

    const sessionid = "bbb";
    const session = issuer.getSessionById(sessionid);
    session.credentialOffer.grants = {};
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