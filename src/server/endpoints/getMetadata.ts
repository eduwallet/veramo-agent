import { Request, Response, Router } from 'express'
import { Issuer } from 'issuer/Issuer.js'

export function getMetadata(issuer: Issuer, basePath:string, wellKnownRouter:Router) {
    const path = '/.well-known/openid-credential-issuer';

    issuer.router!.get(path, (request: Request, response: Response) => {
        return response.json(issuer.generateMetadata())
    });
    wellKnownRouter.get('/openid-credential-issuer' + basePath, (request: Request, response: Response) => {
        return response.json(issuer.generateMetadata())
    });
}
