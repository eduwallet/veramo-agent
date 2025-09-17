import { Request, Router } from 'express'
import { Issuer } from '#root/issuer/Issuer';

export function getNonce(issuer:Issuer) {
    issuer.router!.post('/nonce', async (req: Request, res) => {
        const nonce = await issuer.nonceStates.get('');
        const response = {
            c_nonce: nonce.uuid
        }
        return res.json(response);
    });
}
