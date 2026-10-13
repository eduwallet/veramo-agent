import { randomInt } from 'crypto';

export function generatePin(type:'text'|'numeric', length:number)
{
    let validTokens = '0123456789';
    if (type == 'text') {
        validTokens = 'ABCDEFGHJKMNOPRSTWXYZ'; // leave out I/L, U/V and the Q
    }
    let retval = '';
    // this is the fallback pin used when the front-end issuer does not supply its own
    // (cryptographically secure) tx_code, so it must itself be generated from a secure
    // source of randomness rather than Math.random()
    while (retval.length < length) {
        retval += validTokens[randomInt(0, validTokens.length)];
    }
    return retval;
}