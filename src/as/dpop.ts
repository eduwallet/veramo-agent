import { Request } from 'express';
import { Issuer } from '#root/issuer/Issuer';
import { DPoPNonceRequiredError, validateDPoPProof } from '#root/issuer/lib/validateDPoPProof';

export interface DpopCheck {
    jkt?: string;
    error?: string;
}

/**
 * Validates the DPoP header (if present) of a request to one of the endpoints of the embedded AS.
 * If a key thumbprint is expected (bound at the first call), the proof must be made with that key.
 * Throws DPoPNonceRequiredError, which the caller turns into the nonce response.
 */
export async function checkDpop(issuer: Issuer, request: Request, htu: string, expectedJkt?: string): Promise<DpopCheck> {
    const header = request.header('DPoP');
    if (!header) {
        return expectedJkt ? { error: 'DPoP proof required' } : {};
    }
    try {
        const result = await validateDPoPProof(issuer, header, 'POST', htu);
        if (expectedJkt && result?.jkt !== expectedJkt) {
            return { error: 'DPoP proof key does not match' };
        }
        return { jkt: result?.jkt };
    }
    catch (e) {
        if (e instanceof DPoPNonceRequiredError) {
            throw e;
        }
        return { error: (e as Error).message };
    }
}
