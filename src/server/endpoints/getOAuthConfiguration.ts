import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer';

export function getOAuthConfiguration(issuer:Issuer, tokenpath: string|undefined) {
    const path = `/.well-known/oauth-authorization-server`
    issuer.router!.get(path, (request: Request, response: Response) => {
        var data:any = {
            "issuer": issuer.metadata.credential_issuer
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

        return response.send(data)
    })
}
