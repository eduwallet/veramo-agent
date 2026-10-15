import { rateLimit } from 'express-rate-limit';

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
// channel) are guarded by a long-lived, operator-configured bearer secret compared
// with a plain `==`. The secret's keyspace makes this throttling rather than the
// actual defense, but it still bounds both brute-force attempts and the number of
// samples available to an attacker probing the non-constant-time comparison.
// The limit is generous because the front-end polls the offer status (checkOffer) at
// least once a minute per open offer, and can have many offers open at the same time.
export const adminAuthRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 600,
    standardHeaders: true,
    legacyHeaders: false,
});

// Coarse, app-wide fallback for unauthenticated, low-sensitivity metadata/discovery
// endpoints (openid-configuration, did.json, contexts, vcts, status list
// credentials, ...) that have no endpoint-specific limiter of their own.
export const publicMetadataRateLimiter = rateLimit({
    windowMs: 60_000,
    limit: 100,
    standardHeaders: true,
    legacyHeaders: false,
});
