import { JWT } from "#root/jwt/JWT";
import { HolderData } from "#root/types/internal";
import { CryptoKey, Factory } from "@muisit/cryptokey";

async function getSignatureKeyFromProofJwt(jwt:JWT): Promise<CryptoKey|null>
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

export async function getHolderKeyFromProofJwt(jwt:JWT): Promise<HolderData|null>
{
    const ckey = await getSignatureKeyFromProofJwt(jwt);
    const did = ckey ? await Factory.toDIDJWK(ckey) : null;
    if (jwt.header.kid) {
        // the kid must be an absolute key, so including the did and the reference
        return {
            type: "kid",
            data: jwt.header.kid,
            ...(did && {did}),
            ...(ckey && {ckey})
        };
    }
    if (jwt.header.jwk) {
        return {
            type: "jwk",
            data: jwt.header.jwk,
            ...(did && {did}),
            ...(ckey && {ckey})
        };
    }
    if (jwt.header.x5c) {
        return {
            type: "jwk",
            data: jwt.header.jwk
        };
    }
    return null;
}