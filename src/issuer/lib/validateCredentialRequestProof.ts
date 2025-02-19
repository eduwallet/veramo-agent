export async function validateCredentialRequestProof(jwtVerifyResult:any, tokenExpiresIn:number, nonceState: any, sessionState:any)
{
    const { didDocument, did, jwt } = jwtVerifyResult
    const { header, payload } = jwt
    const { iss, aud, iat, nonce } = payload

    preAuthorizedCode = cNonceState.preAuthorizedCode
    issuerState = cNonceState.issuerState
    const createdAt = cNonceState.createdAt

  if (!preAuthSession && !authSession) {
    throw Error('Either a pre-authorized code or issuer state needs to be present')
  }
  if (preAuthSession) {
    if (!preAuthSession.preAuthorizedCode || preAuthSession.preAuthorizedCode !== preAuthorizedCode) {
      throw Error('Invalid pre-authorized code')
    }
    preAuthSession.lastUpdatedAt = +new Date()
    preAuthSession.status = IssueStatus.CREDENTIAL_REQUEST_RECEIVED
    await this._credentialOfferSessions.set(preAuthorizedCode, preAuthSession)
  }
  if (authSession) {
    if (!authSession.issuerState || authSession.issuerState !== issuerState) {
      throw Error('Invalid issuer state')
    }
    authSession.lastUpdatedAt = +new Date()
    authSession.status = IssueStatus.CREDENTIAL_REQUEST_RECEIVED
  }

  // https://www.rfc-editor.org/rfc/rfc6749.html#section-3.2.1
  // A client MAY use the "client_id" request parameter to identify itself
  // when sending requests to the token endpoint.  In the
  // "authorization_code" "grant_type" request to the token endpoint, an
  // unauthenticated client MUST send its "client_id" to prevent itself
  // from inadvertently accepting a code intended for a client with a
  // different "client_id".  This protects the client from substitution of
  // the authentication code.  (It provides no additional security for the
  // protected resource.)
  if (!iss && authSession?.credentialOffer.credential_offer?.grants?.authorization_code) {
    throw new Error(NO_ISS_IN_AUTHORIZATION_CODE_CONTEXT)
  }
  // iss: OPTIONAL (string). The value of this claim MUST be the client_id of the client making the credential request.
  // This claim MUST be omitted if the Access Token authorizing the issuance call was obtained from a Pre-Authorized Code Flow through anonymous access to the Token Endpoint.
  // TODO We need to investigate further what the comment above means, because it's not clear if the client or the user may be authorized anonymously
  // if (iss && grants && grants[PRE_AUTH_GRANT_LITERAL]) {
  //   throw new Error(ISS_PRESENT_IN_PRE_AUTHORIZED_CODE_CONTEXT)
  // }
  /*if (iss && iss !== clientId) {
    throw new Error(ISS_MUST_BE_CLIENT_ID + `iss: ${iss}, client_id: ${clientId}`)
  }*/
  if (!aud || aud !== this._issuerMetadata.credential_issuer) {
    throw new Error(AUD_ERROR)
  }
  if (!iat) {
    throw new Error(IAT_ERROR)
  } else if (iat > Math.round(createdAt / 1000) + tokenExpiresIn) {
    // createdAt is in milliseconds whilst iat and tokenExpiresIn are in seconds
    throw new Error(IAT_ERROR)
  }
  // todo: Add a check of iat against current TS on server with a skew

  return { jwtVerifyResult, preAuthorizedCode, preAuthSession, issuerState, authSession, cNonceState }
} catch (error: unknown) {
  await this.updateErrorStatus({ preAuthorizedCode, issuerState, error })
  throw error
}    
}