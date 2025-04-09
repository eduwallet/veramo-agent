import Debug from 'debug';
const debug = Debug('issuer:api');
import { AccessTokenResponse } from 'types/specification/access_token';
import { Issuer } from 'issuer/Issuer';
import { CredentialOfferStatus } from 'types/api';
import { SessionState } from 'utils/SessionStateManager';
import { JWT } from 'types/specification/jwt';
import { createUniqueId } from '#root/utils/createUniqueId';

const TOKEN_EXPIRY = 30 * 60 * 1000;

export async function createAccessTokenResponse(issuer:Issuer,session:SessionState) {
    debug("creating access token");
    session.lastUpdatedAt = Date.now();
    session.status = CredentialOfferStatus.ACCESS_TOKEN_CREATED;
    issuer.storeSession(session);
    

    const access_token = await generateAccessToken(issuer, session);
    debug("signed token", access_token);
    // https://www.rfc-editor.org/rfc/rfc6749.html#section-5
    const response: AccessTokenResponse = {
        access_token,
        token_type: 'bearer',
        expires_in: TOKEN_EXPIRY / 1000,
        // refresh_token is optional
    };

    // if using pre-authorised code flow, we do not have authorization_details
    // in our authorization request, hence the spec does not allow us to
    // use it in our token response.
    // The only option left is to use the scope attribute, which is actually
    // required according to RFC6749 if it was not specified by the client
    response.scope = session.credentialId!;

    if (issuer.usesNonces) {
        const cNonce = createUniqueId();
        issuer.nonceStates.set(cNonce, session.id);
        debug("nonce created: ", cNonce);
        response.c_nonce = cNonce;
        response.c_nonce_expires_in = TOKEN_EXPIRY / 1000;
    }
    debug("access token response", response);
    return response
}
  
async function generateAccessToken(issuer:Issuer, session:SessionState)
{
    debug("generating access token");
    // JWT uses seconds for iat and exp
    const iat = new Date().getTime() / 1000
    const exp = iat + TOKEN_EXPIRY;
    const jwt: JWT = {
        header: { typ: 'JWT', alg: issuer.signingAlg(), kid: issuer.did.did },
        payload: {
            iat,
            exp,
            iss: issuer.did!.did,
            ...(session.preAuthorizedCode && { issuer_state: session.preAuthorizedCode }),
            token_type: 'Bearer',
        }
    }
    debug("access token content", jwt);
    return await issuer.signToken(jwt);
}
