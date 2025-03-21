import { Issuer } from "issuer/Issuer";
import { CredentialOfferStatus } from "types/api";
import { CredentialRequest } from "types/specification/credential_request";
import { CredentialResponse } from "types/specification/credential_response";
import { CredentialConfiguration } from "types/specification/metadata";
import { SessionState } from "utils/SessionStateManager";

export async function issueCredential(issuer:Issuer, credentialRequest:CredentialRequest, session:SessionState, credentialType:CredentialConfiguration): CredentialResponse
{
    session.lastUpdatedAt = +new Date()
    session.status = CredentialOfferStatus.CREDENTIAL_REQUEST_RECEIVED;
    issuer.storeSession(session);

    const response = await this.vcIssuer.issueCredential({
        credentialRequest,
        tokenExpiresIn: 300,
        cNonceExpiresIn: 5000,
        jwtVerifyCallback: async (args: { jwt: string; kid?: string }) => {
            if (this.vcIssuer.jwtVerifyCallback) {
                // jump through some loops to get data about the holder into our session state
                const result = await this.vcIssuer.jwtVerifyCallback(args);
                const holder = result.did;
                const nonce = result.jwt.payload.nonce;
                const cNonceState = await this.vcIssuer.cNonces.getAsserted(nonce || '')
                stateId = cNonceState.preAuthorizedCode || cNonceState.issuerState || '';
                var sessionState = await this.getSessionById(stateId);
                sessionState.holder = holder;
                await this.sessionData.set(stateId, sessionState);
                return result;
            }
            throw new Error('no jwtVerifyCallback defined');
        }
    });


      const { preAuthSession, authSession, cNonceState, jwtVerifyResult } = validated
      const did = jwtVerifyResult.did
      const jwk = jwtVerifyResult.jwk
      const kid = jwtVerifyResult.kid
      const newcNonce = opts.newCNonce ? opts.newCNonce : uuidv4()
      const newcNonceState = {
        cNonce: newcNonce,
        createdAt: +new Date(),
        ...(authSession?.issuerState && { issuerState: authSession.issuerState }),
        ...(preAuthSession && { preAuthorizedCode: preAuthSession.preAuthorizedCode }),
      }
      await this.cNonces.set(newcNonce, newcNonceState)

      if (!opts.credential && this._credentialDataSupplier === undefined && opts.credentialDataSupplier === undefined) {
        throw Error(`Either a credential needs to be supplied or a credentialDataSupplier`)
      }
      let credential: CredentialIssuanceInput | undefined
      let format: OID4VCICredentialFormat | undefined = credentialRequest.format
      let signerCallback: CredentialSignerCallback<DIDDoc> | undefined = opts.credentialSignerCallback
      if (opts.credential) {
        credential = opts.credential
      } else {
        const credentialDataSupplier: CredentialDataSupplier | undefined =
          typeof opts.credentialDataSupplier === 'function' ? opts.credentialDataSupplier : this._credentialDataSupplier
        if (typeof credentialDataSupplier !== 'function') {
          throw Error('Data supplier is mandatory if no credential is supplied')
        }
        const session = preAuthorizedCode && preAuthSession ? preAuthSession : authSession
        if (!session) {
          throw Error('Either a preAuth or Auth session is required, none found')
        }
        const credentialOffer = session.credentialOffer
        if (!credentialOffer) {
          throw Error('Credential Offer missing')
        }
        const credentialDataSupplierInput = opts.credentialDataSupplierInput ?? session.credentialDataSupplierInput

        const result = await credentialDataSupplier({
          ...cNonceState,
          credentialRequest: opts.credentialRequest,
          credentialSupplierConfig: this._issuerMetadata.credential_supplier_config,
          credentialOffer /*todo: clientId: */,
          ...(credentialDataSupplierInput && { credentialDataSupplierInput }),
        } as CredentialDataSupplierArgs)
        credential = result.credential
        if (result.format) {
          format = result.format
        }
        if (typeof result.signCallback === 'function') {
          signerCallback = result.signCallback
        }
      }
      if (!credential) {
        throw Error('A credential needs to be supplied at this point')
      }
      // Bind credential to the provided proof of possession
      if (CredentialMapper.isSdJwtDecodedCredentialPayload(credential) && (kid || jwk) && !credential.cnf) {
        if (kid) {
          credential.cnf = {
            kid,
          }
        } else if (jwk) {
          credential.cnf = {
            jwk,
          }
        }
      }
      if (did && !CredentialMapper.isSdJwtDecodedCredentialPayload(credential)) {
        const credentialSubjects = Array.isArray(credential.credentialSubject) ? credential.credentialSubject : [credential.credentialSubject]
        credentialSubjects.map((subject) => {
          if (!subject.id) {
            subject.id = did
          }
          return subject
        })
        credential.credentialSubject = Array.isArray(credential.credentialSubject) ? credentialSubjects : credentialSubjects[0]
      }

      let issuer: string | undefined = undefined
      if (credential.iss) {
        issuer = credential.iss
      } else if (credential.issuer) {
        if (typeof credential.issuer === 'string') {
          issuer = credential.issuer
        } else if (typeof credential.issuer === 'object' && 'id' in credential.issuer && typeof credential.issuer.id === 'string') {
          issuer = credential.issuer.id
        }
      }

      const verifiableCredential = await this.issueCredentialImpl(
        {
          credentialRequest: opts.credentialRequest,
          format,
          credential,
          jwtVerifyResult,
          issuer,
        },
        signerCallback,
      )
      // TODO implement acceptance_token (deferred response)
      // TODO update verification accordingly
      if (!verifiableCredential) {
        // credential: OPTIONAL. Contains issued Credential. MUST be present when acceptance_token is not returned. MAY be a JSON string or a JSON object, depending on the Credential format. See Appendix E for the Credential format specific encoding requirements
        throw new Error(CREDENTIAL_MISSING_ERROR)
      }
      // remove the previous nonce
      await this.cNonces.delete(cNonceState.cNonce)

      let notification_id: string | undefined

      if (preAuthorizedCode && preAuthSession) {
        preAuthSession.lastUpdatedAt = +new Date()
        preAuthSession.status = IssueStatus.CREDENTIAL_ISSUED
        notification_id = preAuthSession.notification_id
        await this._credentialOfferSessions.set(preAuthorizedCode, preAuthSession)
      } else if (issuerState && authSession) {
        // If both were set we used the pre auth flow above as well, hence the else if
        authSession.lastUpdatedAt = +new Date()
        authSession.status = IssueStatus.CREDENTIAL_ISSUED
        notification_id = authSession.notification_id
        await this._credentialOfferSessions.set(issuerState, authSession)
      }

      const response: CredentialResponse = {
        credential: verifiableCredential,
        // format: credentialRequest.format,
        c_nonce: newcNonce,
        c_nonce_expires_in: this._cNonceExpiresIn,
        ...(notification_id && { notification_id }),
      }
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      const experimentalSubjectIssuance = opts.credentialRequest.credential_subject_issuance
      if (experimentalSubjectIssuance?.subject_proof_mode) {
        if (experimentalSubjectIssuance.subject_proof_mode !== 'proof_replace') {
          throw Error('Only proof replace is supported currently')
        }
        response.transaction_id = authSession?.issuerState
        response.credential_subject_issuance = experimentalSubjectIssuance
      }
      return response
    } catch (error: unknown) {
      await this.updateErrorStatus({ preAuthorizedCode, issuerState, error })
      throw error
    }

    await issuer.storeCredential(response.state);
    return response.response;
}
