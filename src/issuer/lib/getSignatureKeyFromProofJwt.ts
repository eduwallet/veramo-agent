import { JWT } from "#root/jwt/JWT";
import { CryptoKey, Factory } from "@muisit/cryptokey";

export async function getSignatureKeyFromProofJwt(jwt:JWT): Promise<CryptoKey|null>
{
    let ckey:CryptoKey|null = null;
    if (jwt.header.kid) {
        // do some cleanup. The trim is only needed because we have a deviant test vector
        const kid = jwt.header.kid.split('#')[0].trim('=');
        ckey = await Factory.resolve(kid);
    }
    else if(jwt.header.jwk) {
        ckey = await Factory.createFromJWK(jwt.header.jwk);
    }
    return ckey;
}
