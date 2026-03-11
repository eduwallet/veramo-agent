import { JWT } from "#root/jwt/JWT";
import { HolderData } from "#root/types/internal";
import { Factory } from "@muisit/cryptokey";

export async function getHolderKeyFromProofJwt(jwt:JWT): Promise<HolderData|null>
{
    if (jwt.header.kid) {
        // the kid must be an absolute key, so including the did and the reference
        const kid = jwt.header.kid;
        // the split is needed because resolve does not take a reference (though it should)
        // the trim is needed due to a deviant test vector
        const ckey = await Factory.resolve(kid.split('#')[0].trim('='));
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