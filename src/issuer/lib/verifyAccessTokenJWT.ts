import Debug from 'debug';
const debug = Debug("issuer:verifyaccesstoken");

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
        debug("access token is a JWT", jwt.header, jwt.payload);
        if (await jwt.verify(issuer.key!)) {
            debug("access token JWT verifies");
            return jwt;
        }
        throw new Error("Invalid JWT");
    }
    catch {
        debug("access token is opaque or does not verify against the issuer key");
        // if we have any authorisation server defined, see if we can find additional data there
        if (issuer.usesAuthorisedCodeFlow()) {
            debug("there are authorisation servers configured, see if we can get data there");
            const userdata = await issuer.retrieveASIssuerIntrospection(token);
            debug("userdata", userdata);
            if (userdata && Object.keys(userdata).length > 0 && userdata.user_info) {
                debug("creating a new userdata JWT token with the remote userdata");
                const jwt = new JWT();
                jwt.payload = {
                    ...userdata.user_info,
                    ...(userdata.token_details && userdata.token_details.issuer_state && {issuer_state: userdata.token_details.issuer_state})
                };
                jwt.payload.iss = issuer.options?.authorizationEndpoint; // the location where we got our info
                return jwt;
            }
        }
    }
    debug("did not find any access token data");
    return null;
}
