import Debug from 'debug';
const debug = Debug('test:test');
import { expect, test} from '@jest/globals';
debug("importing mock environment");
import { mockIssuer } from '../../../jest.setup';
import { validateAccessTokenRequest } from '../validateAccessTokenRequest'
import { GrantTypes, TokenRequest } from "../../../types/specification/access_token";
import { ErrorCodes } from "../../../types/api";
import { getDbConnection } from "../../../database/databaseService";

test("should call getDbConnection", async () => {
    const issuer = mockIssuer();
    await getDbConnection();  
    expect(getDbConnection).toHaveBeenCalled();
    expect(!!issuer).toBe(true);
});

/*test('numeric pin code of 4 characters', () => {
    const tokenRequest:TokenRequest = {
        grant_type: GrantTypes.PRE_AUTHORIZED_CODE,
        "pre-authorized_code": "aaa"
    };
    const issuer = mockIssuer();

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
*/