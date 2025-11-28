import { Issuer } from "#root/issuer/Issuer";
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
    try {
        const jwt = JWT.fromToken(token);
        if (await jwt.verify(issuer.key!)) {
            return jwt;
        }
        throw new Error("Invalid JWT");
    }
    catch (e) {
        if (issuer.usesAuthorisedCodeFlow()) {
            const userdata = await issuer.retrieveASIssuerIntrospection(token);
            if (userdata && Object.keys(userdata).length > 0) {
                const jwt = new JWT();
                jwt.payload = {
                    ...userdata['user-info'],
                    ...(userdata['token-details'] && userdata['token-details'].issuer_state && {issuer_state: userdata['token-details'].issuer_state})
                };
                jwt.payload.iss = issuer.options?.authorizationEndpoint; // the location where we got our info
                return jwt;
            }
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
