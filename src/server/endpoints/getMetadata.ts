import { Request, Response, Router } from 'express'
import { Issuer } from 'issuer/Issuer.js'

export function getMetadata(issuer: Issuer, basePath:string, wellKnownRouter:Router|null) {
    const path = '/.well-known/openid-credential-issuer';

    issuer.router!.get(path, (request: Request, response: Response) => {
        return response.json(issuer.generateMetadata())
    });
    if (wellKnownRouter) {
        wellKnownRouter.get('/openid-credential-issuer' + basePath, (request: Request, response: Response) => {
            return response.json(issuer.generateMetadata())
        });
    }
}
