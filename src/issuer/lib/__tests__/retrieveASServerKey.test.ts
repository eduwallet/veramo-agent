import { expect, test, describe, beforeEach, vi, afterEach} from 'vitest';
import { retrieveASServerKey } from '../retrieveASServerKey';

global.fetch = vi.fn();

const cfg_with_jwk = {
    meaningless_attribute: 'no value',
    jwks_uri: 'https://test/callthis'
};
const cfg_with_jwk_without_scheme = {
    meaningless_attribute: 'no value',
    jwks_uri: 'callthis'
};
const cfg_without_jwk = {
    meaningless_attribute: 'no value'
};
const correct_result = {
    keys: 'key value'
};
const incorrect_result = {
    nosuchkey: 'no value'
};

describe('retrieveASServerKey', () => {
    beforeEach(() => {
      global.fetch.mockReset();
    });
    afterEach(() => {
      global.fetch.mockReset();
    });
  
    test("happy flow", async () => {
        fetch.mockImplementation(createFetchResponse(cfg_with_jwk, null, correct_result));
        const result = await retrieveASServerKey('https://test');
        expect(result).toBeDefined();
        expect(result).toBe('key value');
    });  

    test("happy flow 2", async () => {
        fetch.mockImplementation(createFetchResponse(null, cfg_with_jwk, correct_result));
        const result = await retrieveASServerKey('https://test');
        expect(result).toBeDefined();
        expect(result).toBe('key value');
    });  

    test("attach base url", async () => {
        fetch.mockImplementation(createFetchResponse(null, cfg_with_jwk_without_scheme, correct_result));
        const result = await retrieveASServerKey('https://test');
        expect(result).toBeDefined();
        expect(result).toBe('key value');
    });  

    test("wrong cfg", async () => {
        fetch.mockImplementation(createFetchResponse(cfg_without_jwk, cfg_with_jwk, correct_result));
        const result = await retrieveASServerKey('https://test');
        expect(result).toBeNull();
    });  

    test("no keys", async () => {
        fetch.mockImplementation(createFetchResponse(cfg_without_jwk, cfg_with_jwk, incorrect_result));
        const result = await retrieveASServerKey('https://test');
        expect(result).toBeNull();
    });  
});

function createFetchResponse(oidc:any, oauth:any, data:any) {
    return async (url) => {
        if (url.indexOf('https://test/.well-known/openid-configuration') == 0) {
            return { json: () => new Promise((resolve) => resolve(oidc)) };
        }
        if (url.indexOf('https://test/.well-known/oauth-authorization-server') == 0) {
            return { json: () => new Promise((resolve) => resolve(oauth)) };
        }
        if (url.indexOf('https://test/callthis') == 0) {
            return { json: () => new Promise((resolve) => resolve(data)) };
        }
        return null;
    }
}
