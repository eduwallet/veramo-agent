import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer';

export function getOpenidConfiguration(
    issuer:Issuer,
    tokenpath: string|undefined) {
    const path = `/.well-known/openid-configuration`
    issuer.router!.get(path, (request: Request, response: Response) => {
        var data:any = {
            "issuer": issuer.metadata.credential_issuer,
            "token_endpoint": tokenpath ?? issuer.options.baseUrl + '/token'
        };

        if (issuer.options.authorizationEndpoint) {
            data.authorization_endpoint = issuer.options.authorizationEndpoint;
        }
        if (issuer.options.tokenEndpoint) {
            data.token_endpoint = issuer.options.tokenEndpoint;
        }

        return response.send(data)
    })
}
