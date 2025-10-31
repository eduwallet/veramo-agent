import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer.js';

export function getOAuthConfiguration(issuer:Issuer, tokenpath: string|undefined) {
    const path = `/.well-known/oauth-authorization-server`
    issuer.router!.get(path, (request: Request, response: Response) => {
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
        data.response_types_supported = ["token"];

        return response.json(data)
    })
}
