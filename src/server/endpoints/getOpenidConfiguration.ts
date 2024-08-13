import { Request, Response, Router } from 'express'
import { VcIssuer } from '@sphereon/oid4vci-issuer'
import { IEWIssuerOptsImportArgs } from 'types';

export function getOpenidConfiguration<DIDDoc extends object>(router: Router, issuer: VcIssuer<DIDDoc>, issuerOptions:IEWIssuerOptsImportArgs, baseUrl: string, tokenpath: string|undefined) {
    const path = `/.well-known/openid-configuration`
    router.get(path, (request: Request, response: Response) => {
        var data:any = {
            "credential_issuer": issuer.issuerMetadata.credential_issuer,
            "token_endpoint": tokenpath ?? baseUrl + '/token'
        };

        if (issuerOptions.authorizationEndpoint) {
            data.authorization_endpoint = issuerOptions.authorizationEndpoint;
        }
        if (issuerOptions.tokenEndpoint) {
            data.token_endpoint = issuerOptions.tokenEndpoint;
        }

        return response.send(data)
    })
}
