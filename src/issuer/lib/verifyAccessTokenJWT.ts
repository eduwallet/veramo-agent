import { Issuer } from "#root/issuer/Issuer";
import { ManagedKeyInfo } from "@veramo/core";
import { jwtVerify } from "jose";

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
    if (!managedKey.publicKeyHex) {
        throw new Error('Key does not have a public key hex');
    }

    // Convert hex to Uint8Array
    const keyBytes = Uint8Array.from(Buffer.from(managedKey.publicKeyHex, 'hex'));

    // Map Veramo key type to JWK format
    let jwk: any = {};
    if (managedKey.type === 'Ed25519') {
        jwk = {
            kty: 'OKP',
            crv: 'Ed25519',
            x: Buffer.from(keyBytes).toString('base64url'),
        };
    } else if (managedKey.type.startsWith('Secp256k1')) {
        jwk = {
            kty: 'EC',
            crv: 'secp256k1',
            x: Buffer.from(keyBytes.slice(1, 33)).toString('base64url'),
            y: Buffer.from(keyBytes.slice(33)).toString('base64url'),
        };
    } else {
        throw new Error(`Unsupported key type: ${managedKey.type}`);
    }

    return jwk;
}