import { Issuer } from "#root/issuer/Issuer";
import { jwtVerify } from "jose";
import { Factory } from "@muisit/cryptokey";
import { JWT } from "#root/jwt/JWT";

/*
 * This routine validates the access token JWT, if it is a JWT
 *
 * If it is our own access token, the header will contain the key id of the
 * issuer.
 * If it is an access token of an external server, the key must be inside the
 * list of serverKeys we retrieved at startup.
 */

export async function verifyAccessTokenJWT(token:string, issuer:Issuer)
{
    // because we do not yet support RSA256 in CryptoKey, we use the jwk implementation
    if (issuer.usesAuthorisedCodeFlow()) {
        return await jwtVerify(token, (a:any, b?:any) => getVerificationKey(issuer, a, b), {
            algorithms: ['RS256', 'EdDSA', 'ES256']
        });   
    }
    else {
        const jwt = JWT.fromToken(token);
        const key = await Factory.createFromManagedKey(issuer.key!);
        if (await jwt.verify(key)) {
            return jwt;
        }
    }
    return null;
}

async function getVerificationKey(issuer:Issuer, protectedHeader:any, jws?:any): Promise<any> {
    if (protectedHeader.kid && issuer.serverKeys[protectedHeader.kid]) {
        return issuer.serverKeys[protectedHeader.kid];
    }
    return {};
}
