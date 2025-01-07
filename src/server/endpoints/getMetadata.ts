import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer'

export function getMetadata(issuer: Issuer) {
  const path = `/.well-known/openid-credential-issuer`
  issuer.router!.get(path, (_request: Request, response: Response) => {
    return response.json(issuer.generateMetadata())
  })
}
