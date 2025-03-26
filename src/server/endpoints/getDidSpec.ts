import { Request } from 'express'
import { Issuer } from 'issuer/Issuer';

export function getDidSpec(issuer:Issuer) {
    issuer.router!.get('/.well-known/did.json', async (req: Request, res) => {
        const didDoc = issuer.getDidDoc();
        return res.json(didDoc);
    });
}
