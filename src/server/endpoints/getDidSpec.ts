import { Request } from 'express'
import { Issuer } from 'issuer/Issuer';
import { didDocEndpoint } from '@veramo/remote-server';

export function getDidSpec(issuer:Issuer) {
    issuer.router!.get(didDocEndpoint, async (req: Request, res) => {
      const didDoc = issuer.getDidDoc();
      return res.json(didDoc);
    });
}
