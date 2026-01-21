import { JWT } from "#root/jwt/JWT";
import { HolderData } from "#root/types/internal";
import { CryptoKey, Factory } from "@muisit/cryptokey";

export async function getHolderKeyFromProofJwt(jwt:JWT): Promise<HolderData|null>
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

    if (jwt.header.kid) {
        // the kid must be an absolute key, so including the did and the reference
        const kid = jwt.header.kid.split('#')[0].trim('=');
        const ckey = await Factory.resolve(kid);
        const did = ckey ? (ckey.keyType + ':' + ckey.exportPublicKey()) : null;
        return {
            type: "kid",
            data: kid,
            ...(did && {did}),
            ...(ckey && {ckey})
        };
    }
    if (jwt.header.jwk) {
        const kid = jwt.header.jwk;
        const ckey = await Factory.createFromJWK(kid);
        const did = ckey ? (ckey.keyType + ':' + ckey.exportPublicKey()) : null;
        return {
            type: "jwk",
            data: kid,
            ...(did && {did}),
            ...(ckey && {ckey})
        };
    }
    if (jwt.header.x5c) {
        return {
            type: "x5c",
            data: jwt.header.x5c
        };
    }
    return null;
}