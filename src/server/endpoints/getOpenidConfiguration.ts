import { getBasePath } from '#root/utils/getBasePath';
import { Request, Response, Router } from 'express'
import { Issuer } from 'issuer/Issuer.js';

export function getOpenidConfiguration(issuer:Issuer,tokenpath: string|undefined, wellKnownRouter:Router) {
    const path = `/.well-known/openid-configuration`
    issuer.router!.get(path, getOIDCConfig(issuer, tokenpath));

    const tenanturl = getBasePath(issuer.options.baseUrl);
    wellKnownRouter.get('/openid-configuration' + tenanturl, getOIDCConfig(issuer, tokenpath));
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
        if (issuer.options.tokenEndpoint) {
            data.token_endpoint = issuer.options.tokenEndpoint;
        }
        else {
            data.token_endpoint = tokenpath ?? issuer.options.baseUrl + '/token';
        }

        return response.json(data)
    };
}