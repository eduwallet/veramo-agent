
import {
    AccessTokenRequest,
    AccessTokenResponse,
    Alg,
    CNonceState,
    CredentialOfferSession,
    EXPIRED_PRE_AUTHORIZED_CODE,
    GrantTypes,
    INVALID_PRE_AUTHORIZED_CODE,
    IssueStatus,
    IStateManager,
    Jwt,
    JWTSignerCallback,
    JWTVerifyCallback,
    PIN_NOT_MATCH_ERROR,
    PIN_VALIDATION_ERROR,
    PRE_AUTH_CODE_LITERAL,
    PRE_AUTHORIZED_CODE_REQUIRED_ERROR,
    TokenError,
    TokenErrorResponse,
    UNSUPPORTED_GRANT_TYPE_ERROR,
    USER_PIN_NOT_REQUIRED_ERROR,
    USER_PIN_REQUIRED_ERROR,
    USER_PIN_TX_CODE_SPEC_ERROR,
} from '@sphereon/oid4vci-common'
import { v4 } from 'uuid';
import { generateAccessToken } from '@sphereon/oid4vci-issuer';

export const createAccessTokenResponse = async (
    request: AccessTokenRequest,
    opts: {
      credentialOfferSessions: IStateManager<CredentialOfferSession>
      cNonces: IStateManager<CNonceState>
      cNonce?: string
      cNonceExpiresIn?: number // expiration in seconds
      tokenExpiresIn: number // expiration in seconds
      // preAuthorizedCodeExpirationDuration?: number
      accessTokenSignerCallback: JWTSignerCallback
      accessTokenIssuer: string
      interval?: number
      alg:Alg
    },
  ) => {
    const { credentialOfferSessions, cNonces, cNonceExpiresIn, tokenExpiresIn, accessTokenIssuer, accessTokenSignerCallback, interval } = opts
    // Pre-auth flow
    const preAuthorizedCode = request[PRE_AUTH_CODE_LITERAL] as string
  
    const cNonce = opts.cNonce ?? v4()
    await cNonces.set(cNonce, { cNonce, createdAt: +new Date(), preAuthorizedCode })
  
    const access_token = await generateAccessToken({
      tokenExpiresIn,
      accessTokenSignerCallback,
      preAuthorizedCode,
      accessTokenIssuer,
      alg: opts.alg,
    })
    const response: AccessTokenResponse = {
      access_token,
      token_type: 'bearer',
      expires_in: tokenExpiresIn,
      c_nonce: cNonce,
      c_nonce_expires_in: cNonceExpiresIn,
      authorization_pending: false,
      interval,
    }
    const credentialOfferSession = await credentialOfferSessions.getAsserted(preAuthorizedCode)
    credentialOfferSession.status = IssueStatus.ACCESS_TOKEN_CREATED
    credentialOfferSession.lastUpdatedAt = +new Date()
    await credentialOfferSessions.set(preAuthorizedCode, credentialOfferSession)
    return response
}
  