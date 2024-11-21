import { Request, Response, Router } from 'express'
import { Issuer } from 'issuer/Issuer'

export function getMetadata(issuer: Issuer) {
    const path = `/.well-known/openid-credential-issuer`
    issuer.router!.get(path, (request: Request, response: Response) => {
      return response.json(issuer.generateMetadata())
    })
}
