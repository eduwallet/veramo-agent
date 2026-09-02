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
    return response.status(statusCode).json({ error: 'use_dpop_nonce' });
}
