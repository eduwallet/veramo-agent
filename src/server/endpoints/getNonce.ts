import { Request } from 'express'
import { Issuer } from '#root/issuer/Issuer';
import { nonceEndpointRateLimiter } from '#root/server/rateLimiters';

export function getNonce(issuer:Issuer) {
    issuer.router!.use('/nonce', nonceEndpointRateLimiter);
    issuer.router!.post('/nonce', async (req: Request, res) => {
        const nonce = await issuer.nonceStates.get('');
        const response = {
            c_nonce: nonce.uuid
        }
        return res.json(response);
    });
}
