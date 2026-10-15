import { createHash, timingSafeEqual } from 'node:crypto';
import { Request } from 'express';
import { rateLimit } from 'express-rate-limit';
import { getIssuerStore } from '#root/issuer/Store';
import { adminBearerToken, hasAdminBearerToken } from '#root/utils/adminBearerToken';

// Shared rate limiters, grouped by threat profile rather than by endpoint. These are
// defense in depth, not the primary protection for any of them: the real protection
// against pin/secret guessing is e.g. the per-session pin attempt budget in
// validateAccessTokenRequest.ts. These limiters only slow down a single client/IP and
// can in principle be sidestepped by spreading requests across many source addresses.

// /token: the only real secret guarded here (the tx_code/pin) is additionally
// protected by a per-session attempt budget; this limiter just throttles a single
// client hammering the endpoint.
export const tokenEndpointRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 20,
    standardHeaders: true,
    legacyHeaders: false,
});

// /credentials: reachable with any valid (not necessarily DPoP-bound) access token,
// and expensive per request (proof-of-possession signature verification plus
// credential signing), so worth throttling independently of the token endpoint.
export const credentialEndpointRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
});

// /nonce: fully unauthenticated and persists new server-side nonce state on every
// call, so an unthrottled client can otherwise grow that storage without bound.
export const nonceEndpointRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
});

// Admin APIs (both the top-level /api/* admin API and the per-issuer /api/* back
// channel) are guarded by a long-lived, operator-configured bearer secret.
// Requests that present a valid admin bearer token are never rate limited: an
// authenticated partner can do as many calls as it needs (e.g. polling the status of
// many open offers). Only requests without a valid token are counted, which bounds
// brute-force attempts at the secret (and the samples available to an attacker probing
// the comparison) to a handful per minute per client address.
//
// The token is validated here, ahead of passport, because this limiter is mounted
// before the routes. Passport remains the authority: a request that is skipped here
// but fails there simply gets a 401 without having been counted, which is harmless as
// that can only happen for a token that was valid at the time of the check.
export const adminAuthRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 5,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (request) => hasValidAdminToken(request),
});

function digest(value: string): Buffer {
    return createHash('sha256').update(value).digest();
}

function hasValidAdminToken(request: Request): boolean {
    const match = /^Bearer (.+)$/i.exec(request.header('Authorization') ?? '');
    const presented = match?.[1]?.trim();
    if (!presented) {
        return false;
    }

    const candidates: string[] = [];
    if (hasAdminBearerToken()) {
        candidates.push(adminBearerToken());
    }
    for (const issuer of Object.values(getIssuerStore())) {
        const token = issuer.options?.adminToken;
        if (typeof token === 'string' && token.length > 0) {
            candidates.push(token);
        }
    }

    // compare digests so the comparison is constant-time regardless of token length
    const presentedDigest = digest(presented);
    let valid = false;
    for (const candidate of candidates) {
        if (timingSafeEqual(presentedDigest, digest(candidate))) {
            valid = true;
        }
    }
    return valid;
}

// Coarse, app-wide fallback for unauthenticated, low-sensitivity metadata/discovery
// endpoints (openid-configuration, did.json, contexts, vcts, status list
// credentials, ...) that have no endpoint-specific limiter of their own.
export const publicMetadataRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
