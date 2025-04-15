import { Issuer } from "#root/issuer/Issuer";
import { ManagedKeyInfo } from "@veramo/core";
import { jwtVerify } from "jose";
import { Factory } from "#root/crypto/Factory";

/*
 * This routine validates the access token JWT, if it is a JWT
 *
 * If it is our own access token, the header will contain the key id of the
 * issuer.
 * If it is an access token of an external server, the key must be inside the
 * list of serverKeys we retrieved at startup.
 */

export function verifyAccessTokenJWT(token:string, issuer:Issuer)
{
    return jwtVerify(token, (a:any, b?:any) => getVerificationKey(issuer, a, b), {
        algorithms: ['RS256', 'EdDSA', 'ES256', 'ES256K']
    });
}

async function getVerificationKey(issuer:Issuer, protectedHeader:any, jws?:any): Promise<any> {
    console.log('JWT Header:', protectedHeader);
    switch (protectedHeader.alg) {
        case 'EdDSA':
        case 'ES256':
        case 'ES256K':
        case 'RS256':
            if (issuer.usesAuthorisedCodeFlow()) {
                if (protectedHeader.kid && issuer.serverKeys[protectedHeader.kid]) {
                    return issuer.serverKeys[protectedHeader.kid];
                }
            }
            else if (protectedHeader.kid === issuer.did!.did) {
                return veramoKeyToJWK(issuer.key!);
            }
            break;
        default:
            throw new Error(`Algorithm not supported`);
    }
    return {};
}

function veramoKeyToJWK(managedKey: ManagedKeyInfo) {
    const key = Factory.createFromManagedKey(managedKey);

    if (!key.hasPublicKey()) {
        throw new Error('Key does not have a public key hex');
    }
    return key.toJWK();
}