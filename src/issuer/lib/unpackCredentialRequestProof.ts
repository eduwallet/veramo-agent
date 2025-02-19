import { ALG_ERROR, CredentialRequest, DID_NO_DIDDOC_ERROR, JWT_VERIFY_CONFIG_ERROR, KID_DID_NO_DID_ERROR, KID_JWK_X5C_ERROR, TYP_ERROR } from "@sphereon/oid4vci-common"

export async function unpackCredentialRequestProof(credentialRequest:CredentialRequest, jwtVerifyCallback:Function)
{
    const supportedIssuanceFormats = ['jwt_vc_json', 'jwt_vc_json-ld', 'vc+sd-jwt', 'ldp_vc']
    if (credentialRequest.format && !supportedIssuanceFormats.includes(credentialRequest.format)) {
        throw Error(`Format ${credentialRequest.format} not supported yet`)
    }
    else if (typeof this._jwtVerifyCallback !== 'function' && typeof jwtVerifyCallback !== 'function') {
        throw new Error(JWT_VERIFY_CONFIG_ERROR)
    }
    else if (!credentialRequest.proof) {
        throw Error('Proof of possession is required. No proof value present in credential request')
    }

    const jwtVerifyResult = await jwtVerifyCallback(credentialRequest.proof);
    const { didDocument, did, jwt } = jwtVerifyResult
    const { header, payload } = jwt;
    const { nonce } = payload;

    // The verify callback should set the correct values, but let's look at the JWT ourselves to to be sure
    const alg = jwtVerifyResult.alg ?? header.alg
    const kid = jwtVerifyResult.kid ?? header.kid
    const jwk = jwtVerifyResult.jwk ?? header.jwk
    const x5c = jwtVerifyResult.x5c ?? header.x5c
    const typ = header.typ

    if (typ !== 'openid4vci-proof+jwt') {
        throw Error(TYP_ERROR)
    }
    else if (!alg) {
        throw Error(ALG_ERROR)
    }
    else if (!([kid, jwk, x5c].filter((x) => !!x).length === 1)) {
        // only 1 is allowed, but need to look into whether jwk and x5c are allowed together
        throw Error(KID_JWK_X5C_ERROR)
    }
    else if (kid && !did) {
        if (!jwk && !x5c) {
            // Make sure the callback function extracts the DID from the kid
            throw Error(KID_DID_NO_DID_ERROR)
        }
        else {
            // If JWK or x5c is present, log the information and proceed
            console.log(`KID present but no DID, using JWK or x5c`)
        }
    }
    else if (did && !didDocument) {
        // Make sure the callback function does DID resolution when a did is present
        throw Error(DID_NO_DIDDOC_ERROR)
    }

    if (!nonce) {
        throw Error('No nonce was found in the Proof of Possession')
    }

    return jwtVerifyResult
}