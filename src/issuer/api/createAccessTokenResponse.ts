import { v4 } from 'uuid';
import { AccessTokenResponse } from 'types/specification/access_token';
import { Issuer } from 'issuer/Issuer';
import { CredentialOfferStatus } from 'types/api';
import { SessionState } from 'utils/SessionStateManager';
import { JWT } from 'types/specification/jwt';

const TOKEN_EXPIRY = 30 * 60 * 1000;

export async function createAccessTokenResponse(issuer:Issuer,session:SessionState) {
    session.lastUpdatedAt = Date.now();
    session.status = CredentialOfferStatus.ACCESS_TOKEN_CREATED;
    issuer.storeSession(session);
    
    const cNonce = v4();
    issuer.nonceStates.set(cNonce, session.id);

    const access_token = await generateAccessToken(issuer, session); 
    const response: AccessTokenResponse = {
      access_token,
      token_type: 'bearer',
      expires_in: TOKEN_EXPIRY / 1000,
      c_nonce: cNonce,
      c_nonce_expires_in: TOKEN_EXPIRY / 1000,
      authorization_pending: false,
      authorization_details: [{
        type: 'openid-credential',
        credential_configuration_id: session.credentialId!,
        credential_configurations: [session.credentialId!]
      }]
    }
    return response
}
  
async function generateAccessToken(issuer:Issuer, session:SessionState)
{
    // JWT uses seconds for iat and exp
    const iat = new Date().getTime() / 1000
    const exp = iat + TOKEN_EXPIRY;
    const jwt: JWT = {
        header: { typ: 'JWT', alg: issuer.signingAlg() },
        payload: {
            iat,
            exp,
            iss: issuer.did!.did,
            ...(session.preAuthorizedCode && { preAuthorizedCode: session.preAuthorizedCode }),
            token_type: 'Bearer',
        }
    }
    return await issuer.signToken(jwt);
}
