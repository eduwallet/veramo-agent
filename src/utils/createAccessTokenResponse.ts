
import {
    AccessTokenRequest,
    IssueStatus,
    JWTSignerCallback,
    PRE_AUTH_CODE_LITERAL,
} from '@sphereon/oid4vci-common'
import { v4 } from 'uuid';
import { generateAccessToken } from '@sphereon/oid4vci-issuer';
import { AccessTokenResponse } from 'types/accesstoken';
import { Issuer } from 'issuer/Issuer';

export const createAccessTokenResponse = async (
    issuer:Issuer,
    request: AccessTokenRequest,
    opts: {
      cNonce?: string
      cNonceExpiresIn?: number // expiration in seconds
      tokenExpiresIn: number // expiration in seconds
      // preAuthorizedCodeExpirationDuration?: number
      accessTokenSignerCallback: JWTSignerCallback
      accessTokenIssuer: string
      interval?: number
    },
  ) => {
    const { cNonceExpiresIn, tokenExpiresIn, accessTokenIssuer, accessTokenSignerCallback, interval } = opts
    // Pre-auth flow
    const preAuthorizedCode = request[PRE_AUTH_CODE_LITERAL] as string
    const issuerSession = await issuer.getSessionById(preAuthorizedCode || '');
    const credentialOfferSessions = issuer.vcIssuer.credentialOfferSessions;
    const cNonces = issuer.vcIssuer.cNonces;
    const alg = issuer.signingAlg();
    const cNonce = opts.cNonce ?? v4()
    await cNonces.set(cNonce, { cNonce, createdAt: +new Date(), preAuthorizedCode })
  
    const access_token = await generateAccessToken({
      tokenExpiresIn,
      accessTokenSignerCallback,
      preAuthorizedCode,
      accessTokenIssuer,
      alg
    })
    const response: AccessTokenResponse = {
      access_token,
      token_type: 'bearer',
      expires_in: tokenExpiresIn,
      c_nonce: cNonce,
      c_nonce_expires_in: cNonceExpiresIn,
      authorization_pending: false,
      interval,
      authorization_details: [{
        type: 'openid-credential',
        credential_configuration_id: issuerSession.principalCredentialId,
        credential_configurations: [issuerSession.principalCredentialId]
      }]
    }
    const credentialOfferSession = await credentialOfferSessions.getAsserted(preAuthorizedCode)
    credentialOfferSession.status = IssueStatus.ACCESS_TOKEN_CREATED
    credentialOfferSession.lastUpdatedAt = +new Date()
    await credentialOfferSessions.set(preAuthorizedCode, credentialOfferSession)
    return response
}
  