import { getOIDFedInfo } from 'utils/getOIDFedInfo.js';
import { Request, Response } from 'express'
import { Issuer } from 'issuer/Issuer.js'

export function getOIDFed(issuer: Issuer) {
    const path = '/.well-known/openid-federation';

    issuer.router!.get(path, async (request: Request, response: Response) => {
        return response.send(await getOIDFedInfo(issuer));
    });
}
