import {
    AccessTokenRequest,
    CredentialOfferSession,
    EXPIRED_PRE_AUTHORIZED_CODE,
    GrantTypes,
    INVALID_PRE_AUTHORIZED_CODE,
    IssueStatus,
    IStateManager,
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
import { isPreAuthorizedCodeExpired, isValidGrant } from '@sphereon/oid4vci-issuer';
  
export const assertValidAccessTokenRequest = async (
    request: AccessTokenRequest,
    opts: {
      credentialOfferSessions: IStateManager<CredentialOfferSession>
      expirationDuration: number
    },
  ) => {
    const { credentialOfferSessions, expirationDuration } = opts
    // Only pre-auth supported for now
    if (request.grant_type !== GrantTypes.PRE_AUTHORIZED_CODE) {
      throw new TokenError(400, TokenErrorResponse.invalid_grant, UNSUPPORTED_GRANT_TYPE_ERROR)
    }
  
    // Pre-auth flow
    if (!request[PRE_AUTH_CODE_LITERAL]) {
      throw new TokenError(400, TokenErrorResponse.invalid_request, PRE_AUTHORIZED_CODE_REQUIRED_ERROR)
    }
  
    const credentialOfferSession = await credentialOfferSessions.getAsserted(request[PRE_AUTH_CODE_LITERAL])
    credentialOfferSession.status = IssueStatus.ACCESS_TOKEN_REQUESTED
    credentialOfferSession.lastUpdatedAt = +new Date()
    await credentialOfferSessions.set(request[PRE_AUTH_CODE_LITERAL], credentialOfferSession)
    if (!isValidGrant(credentialOfferSession, request.grant_type)) {
      throw new TokenError(400, TokenErrorResponse.invalid_grant, UNSUPPORTED_GRANT_TYPE_ERROR)
    }
  
    /*
   invalid_request:
   the Authorization Server does not expect a PIN in the pre-authorized flow but the client provides a PIN
    */
    if (!credentialOfferSession.credentialOffer.credential_offer?.grants?.[GrantTypes.PRE_AUTHORIZED_CODE]?.tx_code && (request.tx_code || request.user_pin)) {
      // >= v13
      throw new TokenError(400, TokenErrorResponse.invalid_request, USER_PIN_NOT_REQUIRED_ERROR)
    } 

    /*
    invalid_request:
    the Authorization Server expects a PIN in the pre-authorized flow but the client does not provide a PIN
     */
    if (
      // >= v13
      !!credentialOfferSession.credentialOffer.credential_offer?.grants?.[GrantTypes.PRE_AUTHORIZED_CODE]?.tx_code &&
      !request.tx_code &&
      !request.user_pin
    ) {
      throw new TokenError(400, TokenErrorResponse.invalid_request, USER_PIN_REQUIRED_ERROR)
    }
  
    if (isPreAuthorizedCodeExpired(credentialOfferSession, expirationDuration)) {
      throw new TokenError(400, TokenErrorResponse.invalid_grant, EXPIRED_PRE_AUTHORIZED_CODE)
    } else if (
      request[PRE_AUTH_CODE_LITERAL] !==
      credentialOfferSession.credentialOffer?.credential_offer?.grants?.[GrantTypes.PRE_AUTHORIZED_CODE]?.[PRE_AUTH_CODE_LITERAL]
    ) {
      throw new TokenError(400, TokenErrorResponse.invalid_grant, INVALID_PRE_AUTHORIZED_CODE)
    }
    /*
    invalid_grant:
    the Authorization Server expects a PIN in the pre-authorized flow but the client provides the wrong PIN
    the End-User provides the wrong Pre-Authorized Code or the Pre-Authorized Code has expired
     */
    if (request.tx_code) {
      const txCodeOffer = credentialOfferSession.credentialOffer.credential_offer?.grants?.[GrantTypes.PRE_AUTHORIZED_CODE]?.tx_code
      if (!txCodeOffer) {
        throw new TokenError(400, TokenErrorResponse.invalid_request, USER_PIN_NOT_REQUIRED_ERROR)
      } else if (txCodeOffer.input_mode === 'text') {
        if (!RegExp(`[\\D]{${txCodeOffer.length}`).test(request.tx_code)) {
          throw new TokenError(400, TokenErrorResponse.invalid_grant, `${PIN_VALIDATION_ERROR} ${txCodeOffer.length}`)
        }
      } else {
        if (!RegExp(`[\\d]{${txCodeOffer.length}}`).test(request.tx_code)) {
          throw new TokenError(400, TokenErrorResponse.invalid_grant, `${PIN_VALIDATION_ERROR} ${txCodeOffer.length}`)
        }
      }
      if (request.tx_code !== credentialOfferSession.txCode) {
        throw new TokenError(400, TokenErrorResponse.invalid_grant, PIN_NOT_MATCH_ERROR)
      }
    } else if (request.user_pin) {
      if (!/[\\d]{1,8}/.test(request.user_pin)) {
        throw new TokenError(400, TokenErrorResponse.invalid_grant, `${PIN_VALIDATION_ERROR} 1-8`)
      } else if (request.user_pin !== credentialOfferSession.txCode) {
        throw new TokenError(400, TokenErrorResponse.invalid_grant, PIN_NOT_MATCH_ERROR)
      }
    }
  
    return { preAuthSession: credentialOfferSession }
  }