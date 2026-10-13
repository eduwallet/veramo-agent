import { JWT } from "#root/jwt/JWT";
import { HolderData } from "#root/types/internal";
import { Factory } from "@muisit/cryptokey";

export async function getHolderKeyFromProofJwt(jwt:JWT): Promise<HolderData|null>
{
    if (jwt.header.kid) {
        // the kid must be an absolute key, so including the did and the reference
        const kid = jwt.header.kid;

        // did:web requires the issuer to perform an HTTPS fetch to a host/port/path
        // that is entirely attacker-controlled (it is taken verbatim from the proof
        // JWT header of an unauthenticated/self-service request). We do not accept
        // it as a holder proof-of-possession key: wallets must instead use did:key,
        // did:jwk, or the jwk/x5c proof headers, none of which require us to make
        // outbound network calls to resolve the key.
        if (kid.startsWith('did:web:')) {
            return null;
        }

        // the split is needed because resolve does not take a reference (though it should)
        // the trim is needed due to a deviant test vector
        let ckey = null;
        try {
            ckey = await Factory.resolve(kid.split('#')[0].trim('='));
        }
        catch (e) {
            // never leak resolver-internal errors (dns/connection/parse failures) to the
            // caller: treat any resolution failure the same as "key not found"
            return null;
        }
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
        let ckey = null;
        try {
            ckey = await Factory.createFromJWK(kid);
        }
        catch (e) {
            return null;
        }
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