import { GrantTypes } from '#root/types/specification/access_token';
import { Request, Response, Router } from 'express'
import { Issuer } from 'issuer/Issuer.js';

export function getOpenidConfiguration(issuer:Issuer, basePath:string, tokenpath: string|undefined, wellKnownRouter:Router|null) {
    const path = `/.well-known/openid-configuration`
    issuer.router!.get(path, getOIDCConfig(issuer, tokenpath));
    if (wellKnownRouter) {
        wellKnownRouter.get('/openid-configuration' + basePath, getOIDCConfig(issuer, tokenpath));
    }
}

function getOIDCConfig(issuer:Issuer, tokenpath:string|undefined)
{
    return (request: Request, response: Response) => {
        const data:any = {
            "issuer": issuer.options.baseUrl
        };

        if (issuer.options.authorizationEndpoint) {
            data.authorization_endpoint = issuer.options.authorizationEndpoint;
        }
        else {
            data.grant_types_supported = [GrantTypes.PRE_AUTHORIZED_CODE];
        }

        if (issuer.options.tokenEndpoint) {
            data.token_endpoint = issuer.options.tokenEndpoint;
        }
        else {
            // token endpoint is an external URL, prepend it with the issuer base url
            data.token_endpoint = tokenpath ?? issuer.options.baseUrl + '/token';
        }

        return response.json(data)
    };
}