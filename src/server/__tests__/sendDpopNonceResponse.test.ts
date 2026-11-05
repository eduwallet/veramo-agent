import { describe, expect, it } from 'vitest';
import { sendDpopNonceResponse } from '#root/server/sendDpopNonceResponse';

function fakeResponse() {
    const headers: Record<string, string> = {};
    const res: any = {
        headersSent: false,
        headers,
        statusCode: 0,
        body: undefined,
        set(name: string, value: string) { headers[name] = value; return res; },
        status(code: number) { res.statusCode = code; return res; },
        json(body: unknown) { res.body = body; return res; },
    };
    return res;
}

describe('sendDpopNonceResponse', () => {
    it('adds the WWW-Authenticate challenge for resource endpoints (401)', () => {
        const res = fakeResponse();
        sendDpopNonceResponse(res, 401, 'abc');
        expect(res.statusCode).toBe(401);
        expect(res.headers['DPoP-Nonce']).toBe('abc');
        expect(res.headers['WWW-Authenticate']).toMatch(/^DPoP error="use_dpop_nonce"/);
        expect(res.body).toEqual({ error: 'use_dpop_nonce' });
    });

    it('does not add WWW-Authenticate for the token endpoint (400)', () => {
        const res = fakeResponse();
        sendDpopNonceResponse(res, 400, 'abc');
        expect(res.headers['DPoP-Nonce']).toBe('abc');
        expect(res.headers['WWW-Authenticate']).toBeUndefined();
    });
});
