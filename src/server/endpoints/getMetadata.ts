import { Request, Response, Router } from 'express'
import { VcIssuer } from '@sphereon/oid4vci-issuer'

export function getMetadata<DIDDoc extends object>(router: Router, issuer: VcIssuer<DIDDoc>) {
    const path = `/.well-known/openid-credential-issuer`
    router.get(path, (request: Request, response: Response) => {
      return response.send(issuer.issuerMetadata)
    })
}
