import { Response } from 'express';

// https://www.rfc-editor.org/rfc/rfc9449#section-8
// Dedicated response for the DPoP nonce challenge/retry protocol. This is not a generic
// error and is therefore not routed through ApiState/ErrorCodes/sendErrorResponse.
export function sendDpopNonceResponse(response: Response, statusCode: number, nonce: string) {
    if (response.headersSent) {
        return response;
    }
    response.set('DPoP-Nonce', nonce);
    response.set('Cache-Control', 'no-store');
    if (statusCode === 401) {
        // RFC 9449 §9: a resource server (credential and deferred endpoints) signals the nonce challenge
        // in the WWW-Authenticate header. Wallets such as Paradym only retry on this header, not on the body.
        response.set('WWW-Authenticate', 'DPoP error="use_dpop_nonce", error_description="Resource server requires nonce in DPoP proof"');
    }
    return response.status(statusCode).json({ error: 'use_dpop_nonce' });
}
