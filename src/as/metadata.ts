import { Request, Response, Router } from 'express';
import { Issuer } from '#root/issuer/Issuer';
import { SUPPORTED_ALGS as DPOP_SUPPORTED_ALGS } from '#root/issuer/lib/validateDPoPProof';

// RFC 8414 metadata of the embedded authorization server, see DESIGN_PRESENTATION_DURING_ISSUANCE.md, 4.1

export function embeddedASMetadata(issuer: Issuer) {
    const settings = issuer.embeddedASSettings();
    const base = issuer.options.baseUrl + '/as';
    return {
        issuer: base,
        authorization_challenge_endpoint: base + '/authorization-challenge',
        ...(settings && settings.mode != 'in-app' && { authorization_endpoint: base + '/authorize' }),
        token_endpoint: base + '/token',
        grant_types_supported: ['authorization_code'],
        response_types_supported: ['code'],
        code_challenge_methods_supported: ['S256'],
        token_endpoint_auth_methods_supported: ['none'],
        dpop_signing_alg_values_supported: DPOP_SUPPORTED_ALGS
    };
}

export function getEmbeddedASMetadata(issuer: Issuer, basePath: string, wellKnownRouter: Router | null, singleTenant: boolean) {
    const handler = (_request: Request, response: Response) => response.json(embeddedASMetadata(issuer));

    // as subpath of the issuer, and as fallback with openid-configuration (see retrieveServerMetadata)
    issuer.router!.get('/as/.well-known/oauth-authorization-server', handler);
    issuer.router!.get('/as/.well-known/openid-configuration', handler);

    // RFC 8414 path insertion: /.well-known/oauth-authorization-server/<tenant>/as
    if (singleTenant) {
        issuer.router!.get('/.well-known/oauth-authorization-server/as', handler);
    }
    else if (wellKnownRouter) {
        wellKnownRouter.get('/oauth-authorization-server' + basePath + '/as', handler);
    }
}
