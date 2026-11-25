import { Request, Response, Router } from 'express'
import { Issuer } from 'issuer/Issuer.js';
import { GrantTypes } from 'types/specification/access_token.js';
import { SUPPORTED_ALGS as DPOP_SUPPORTED_ALGS } from '#root/issuer/lib/validateDPoPProof';

export function getOAuthConfiguration(issuer:Issuer, basePath:string, tokenpath: string|undefined, wellKnownRouter:Router|null) {
    const path = `/.well-known/oauth-authorization-server`
    issuer.router!.get(path, getOAuthConfig(issuer, tokenpath));
    if (wellKnownRouter) {
        wellKnownRouter.get('/oauth-authorization-server' + basePath, getOAuthConfig(issuer, tokenpath));
    }
}

function getOAuthConfig(issuer:Issuer, tokenpath: string|undefined) {
    return (request: Request, response: Response) => {
        const data:any = {
            "issuer": issuer.options.baseUrl
        };

        // the issuer is only the authorization server of the pre-authorized_code flow: the embedded
        // and external authorization servers have their own metadata
        data.grant_types_supported = [GrantTypes.PRE_AUTHORIZED_CODE];

        // token endpoint is an external URL, prepend it with the issuer base url
        data.token_endpoint = tokenpath ?? issuer.options.baseUrl + '/token';
        data.response_types_supported = ["token"];
        // https://www.rfc-editor.org/rfc/rfc9449#section-5.1 - advertise DPoP support; wallets
        // that do not implement DPoP simply keep using bearer tokens
        data.dpop_signing_alg_values_supported = DPOP_SUPPORTED_ALGS;

        return response.json(data)
    };
}