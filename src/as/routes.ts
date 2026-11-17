import { Router } from 'express';
import { Issuer } from '#root/issuer/Issuer';
import { authorizationChallenge } from '#root/as/challenge';
import { asToken } from '#root/as/token';
import { authorize, authorizeContinue, authorizeStatus } from '#root/as/authorize';
import { getEmbeddedASMetadata } from '#root/as/metadata';
import { asChallengeRateLimiter, asChallengeSessionRateLimiter, tokenEndpointRateLimiter } from '#root/server/rateLimiters';

/**
 * The embedded authorization server lives under <issuer base url>/as.
 * See doc/DESIGN_PRESENTATION_DURING_ISSUANCE.md
 */
export function createRoutesForEmbeddedAS(issuer: Issuer, basePath: string, wellKnownRouter: Router | null, singleTenant: boolean) {
    if (!issuer.usesEmbeddedAS()) {
        return;
    }

    getEmbeddedASMetadata(issuer, basePath, wellKnownRouter, singleTenant);

    issuer.router!.post('/as/authorization-challenge', asChallengeRateLimiter, asChallengeSessionRateLimiter, (request, response) => authorizationChallenge(issuer, request, response));
    // the redirect flow, only when the configuration allows it (the handlers check the mode as well)
    if (issuer.embeddedASSettings()!.mode != 'in-app') {
        issuer.router!.get('/as/authorize', asChallengeRateLimiter, (request, response) => authorize(issuer, request, response));
        issuer.router!.get('/as/authorize/status', asChallengeRateLimiter, (request, response) => authorizeStatus(issuer, request, response));
        issuer.router!.get('/as/continue', asChallengeRateLimiter, (request, response) => authorizeContinue(issuer, request, response));
    }
    issuer.router!.post('/as/token', tokenEndpointRateLimiter, (request, response) => asToken(issuer, request, response));
}
