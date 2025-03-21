import { verifyJWT } from 'did-jwt';
import { Request } from 'express'
import { Issuer } from 'issuer/Issuer';
import { CredentialOfferStatus, ErrorCodes } from 'types/api';
import { ApiState } from 'types/internal';
import { resolver } from 'resolver';
import { CredentialRequest, CredentialRequestJwtVC, CredentialRequestLdpVC, CredentialRequestSdJwt } from 'types/specification/credential_request';
import { SessionState } from 'utils/SessionStateManager';
import { ExtendableCredentialConfiguration } from 'types/api/metadata';
import { unpackCredentialRequestProof } from 'issuer/lib/unpackCredentialRequestProof';

export async function validateCredentialRequest(issuer:Issuer, request:Request)
{
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};

    const jwt = extractBearerToken(request.header('Authorization'));
    if (!jwt) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Unauthorized";
        return error;
    }

    let session:SessionState|null = null;
    if (!issuer.usesAuthorisedCodeFlow()) {
        // in this case we issued the access token ourselves, so we can decode it
        const data  = await verifyJWT(jwt || '', { resolver, proofPurpose: 'authentication'});
        if (data.issuer != issuer.did?.did) {
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Unauthorised";
            return error;
        }

        const stateid = data.payload.preAuthorizedCode;
        const sessionId = issuer.authorizationState.get(stateid);
        if (!sessionId) {
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "No state found";
            return error;
        }

        session = issuer.getSessionById(sessionId);

        if (session && session.status != CredentialOfferStatus.ACCESS_TOKEN_CREATED) {
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "No access token created";
            return error;
        }
    }

    if (!session) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }

    const type = getTypeFromRequest(request.body as CredentialRequest, { filterVerifiableCredential: true }) || '';

    // new style requests: the type is a credential_identifier identifying a specific dataset in our session
    let credentialDataSet = session.credentialDataSets[type];
    if (!credentialDataSet) {
        // old style, where we specify the type in the request and how that it matches the configuration
        const credentialConfiguration = issuer.getCredentialConfiguration(type);
        if (credentialConfiguration === null) {
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Credential type not found";
            return error;
        }

        if (request.body.format && credentialConfiguration.format !== request.body.format) {
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Requested credential format not supported";
            return error;
        }
        credentialDataSet = {
            credentialId: type,
            data: {} // we hope the credential implementation can determine the required values itself
        };
    }

    error = await validateCredentialRequestProof(issuer, session, request.body);
    if (error.error != ErrorCodes.NO_ERROR) {
        return error;
    }

    error.data = { session, type, credentialDataSet, proof:error.data.proof };
    return error;
}

async function validateCredentialRequestProof(issuer:Issuer, session:SessionState, credentialRequest:CredentialRequest): ApiState
{
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    // we only support JWT proofs at this moment
    if (!credentialRequest.proof || !credentialRequest.proof.jwt) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Proof of possession missing";
        return error;
    }

    const verificationResult = await issuer.verifyToken(credentialRequest.proof.jwt!);
    if (!verificationResult) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid proof of possession";
        return error;
    }

    const { didResolution, did, decoded, alg } = verificationResult!;
    const { didDocument } = didResolution;
    const { header, payload } = decoded;
    const { iss, aud, iat, nonce } = payload


    // checking the composition of the proof, which should normally be a no-brainer

    // we are not going to check the validity of the signature and whether the header
    // composition is valid or not: if verifyJWT was able to verify the signature,
    // the JWT is signed and the contents are valid

    // https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-jwt-proof-type
    // alg: required, must not be none
    if (!alg || alg === 'none') {
        // if we did not determine an algorithm, how did verifyJWT return a verified result above...
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid proof algorithm";
        return error;
    }
    // typ: required, must be openid4vci-proof+jwt'
    // the did-jwt library predefines the typ header claim to always be JWT, which is
    // obviously not the case
    if ((header.typ as string) !== 'openid4vci-proof+jwt') {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid proof type";
        return error;
    }

    // kid: optional. If present it must be a did. The did-jwt library extracts this
    // jwk: optional, used instead of kid. did-jwt does not support this
    // x5c: optional, used instead of kid. did-jwt does not support this
    // trust_chain: optional, OIDFed information

    // in the body:
    // iss: optional, must not be present for pre-auth, contains client_id
    if (session.issuerState && !iss) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No iss claim found";
        return error;
    }

    // aud: required, credential issuer identifier
    // iat: required, time the proof was created
    // nonce: optional, must be present if a c_nonce was supplied
    if (!nonce) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No nonce value found";
        return error;
    }

    const cNonceState = issuer.nonceStates.get(nonce);
    if (!cNonceState) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid nonce";
        return error;
    }

    if (cNonceState !== session.id) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid nonce";
        return error;
    }

    if (!did || !didDocument) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No did found";
        return error;
    }


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

function extractBearerToken (authorizationHeader?: string): string | undefined 
{
    return authorizationHeader ? /Bearer (.*)/i.exec(authorizationHeader)?.[1] : undefined;
};

function getTypeFromRequest(credentialRequest: CredentialRequest, opts?: { filterVerifiableCredential: boolean }) {
    // This issuer uses the credential_identifiers attribute of authorization details.
    // It is mandatory that wallets return that identifier in the request
    if (credentialRequest.credential_identifier) {
        // return the credential_identifier, the issuer will sort it out
        return credentialRequest.credential_identifier;
    }

    // So this is old-style, dead code if wallets implement things correctly
    // This part tests for the requested type, which should match the type as mentioned in the metadata
    // definitions. Each format has its own specific extensions to the credential request
    if (['jwt_vc', 'jwt_vc_json'].includes(credentialRequest.format || '')) {
        const request = credentialRequest as CredentialRequestJwtVC;
        const types = request.credential_definition!.type.filter((i:string) => i != 'VerifiableCredential');
        return types.length > 0 ? types[0] : '';
    }
    else if (['jwt_vc_json-ld', 'ldp_vc'].includes(credentialRequest.format || '')) {
        const request = credentialRequest as CredentialRequestLdpVC;
        const types = request.credential_definition!.type.filter((i:string) => i != 'VerifiableCredential');
        return types.length > 0 ? types[0] : '';
    }
    else if (['vc+sd-jwt', 'dc+sd-jwt'].includes(credentialRequest.format || '')) {
        const request = credentialRequest as CredentialRequestSdJwt;
        return request.vct;
    }
    return '';
}
  