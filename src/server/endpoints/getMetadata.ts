import Debug from 'debug';
const debug = Debug('issuer:endpoints');

import { getBasePath } from '#root/utils/getBasePath';
import { Request, Response, Router } from 'express'
import { Issuer } from 'issuer/Issuer.js'

export function getMetadata(issuer: Issuer, wellKnownRouter:Router) {
    const path = '/.well-known/openid-credential-issuer';

    debug("creating endpoint at issuer router for ", path);
    issuer.router!.get(path, (request: Request, response: Response) => {
        return response.json(issuer.generateMetadata())
    });
    const tenanturl = getBasePath(issuer.options.baseUrl);
    debug("creating endpoint at wellknown router for ", '/openid-credential-issuer' + tenanturl);
    wellKnownRouter.get('/openid-credential-issuer' + tenanturl, (request: Request, response: Response) => {
        return response.json(issuer.generateMetadata())
    });
}
