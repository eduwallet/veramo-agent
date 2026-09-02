import Debug from 'debug';
const debug = Debug('issuer:dpop');
import crypto from 'node:crypto';
import { calculateJwkThumbprint, JWK } from 'jose';
import { CryptoKey, Factory } from '@muisit/cryptokey';
import { JWT } from '#root/jwt/JWT';
import { Issuer } from '#root/issuer/Issuer';

// https://www.rfc-editor.org/rfc/rfc9449
// Only ES256 is supported as a DPoP proof signing algorithm for now.
export const SUPPORTED_ALGS = ['ES256'];
const IAT_SKEW_SECONDS = 60;
const NONCE_TTL_MS = 5 * 60 * 1000;
const JTI_TTL_MS = 5 * 60 * 1000;

export class DPoPNonceRequiredError extends Error {
    public nonce: string;

    constructor(nonce: string) {
        super('use_dpop_nonce');
        this.name = 'DPoPNonceRequiredError';
        this.nonce = nonce;
    }
}

export interface DPoPValidationResult {
    jkt: string;
}

// Mints a new, single-use DPoP-Nonce value for this issuer.
export async function issueDpopNonce(issuer: Issuer): Promise<string> {
    const nonce = await issuer.dpopNonceStates.get('', { expirationDate: new Date(Date.now() + NONCE_TTL_MS) });
    return nonce.uuid;
}

/*
 * Validates a DPoP proof (RFC 9449) sent along with a token or resource (credential) request.
 *
 * Returns null when no DPoP header was supplied at all: the caller should then fall back to
 * regular bearer-token handling, since DPoP is optional per-wallet in this implementation.
 *
 * Throws DPoPNonceRequiredError when the caller must retry with a server-provided nonce.
 * Throws a regular Error for any other validation failure.
 */
export async function validateDPoPProof(
    issuer: Issuer,
    dpopHeader: string | undefined,
    htm: string,
    htu: string,
    accessToken?: string
): Promise<DPoPValidationResult | null> {
    if (!dpopHeader) {
        return null;
    }

    debug('validating DPoP proof', dpopHeader);
    const jwt = JWT.fromToken(dpopHeader);
    const header = jwt.header;
    const payload = jwt.payload;

    if ((header.typ as string) !== 'dpop+jwt') {
        throw new Error('Invalid DPoP proof type');
    }
    if (!SUPPORTED_ALGS.includes(header.alg as string)) {
        throw new Error('Unsupported DPoP proof algorithm');
    }

    const jwk = header.jwk as (JWK & { d?: string }) | undefined;
    if (!jwk || jwk.d) {
        // jwk must be present and must be a public key only
        throw new Error('Invalid or missing DPoP proof key');
    }

    const ckey = await Factory.createFromJWK(jwk);
    if (!(await jwt.verify(ckey))) {
        throw new Error('Invalid DPoP proof signature');
    }

    if (!payload.jti || typeof payload.jti !== 'string') {
        throw new Error('Missing DPoP proof jti');
    }
    if (payload.htm !== htm) {
        throw new Error('DPoP proof htm mismatch');
    }
    if (payload.htu !== htu) {
        throw new Error('DPoP proof htu mismatch');
    }
    if (typeof payload.iat !== 'number' || Math.abs(Date.now() / 1000 - payload.iat) > IAT_SKEW_SECONDS) {
        throw new Error('DPoP proof iat out of range');
    }

    if (accessToken) {
        // ath is only required on resource (credential) requests, not on the token request itself
        const expectedAth = CryptoKey.bytesToBase64Url(crypto.createHash('sha256').update(accessToken).digest());
        if (payload.ath !== expectedAth) {
            throw new Error('DPoP proof ath mismatch');
        }
    }

    if (!payload.nonce || typeof payload.nonce !== 'string' || !(await issuer.dpopNonceStates.consume(payload.nonce))) {
        debug('DPoP proof is missing a valid nonce, issuing a new one');
        throw new DPoPNonceRequiredError(await issueDpopNonce(issuer));
    }

    if (!(await issuer.dpopJtiStates.claim(payload.jti, new Date(Date.now() + JTI_TTL_MS)))) {
        throw new Error('DPoP proof jti has already been used');
    }

    const jkt = await calculateJwkThumbprint(jwk as JWK, 'sha256');
    return { jkt };
}
