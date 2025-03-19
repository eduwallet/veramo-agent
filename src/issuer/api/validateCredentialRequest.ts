import { verifyJWT } from 'did-jwt';
import { Request } from 'express'
import { Issuer } from 'issuer/Issuer';
import { CredentialOfferStatus, ErrorCodes } from 'types/api';
import { ApiState } from 'types/internal';
import { resolver } from 'resolver';
import { CredentialRequest, CredentialRequestJwtVC, CredentialRequestLdpVC, CredentialRequestSdJwt } from 'types/specification/credential_request';
import { SessionState } from 'utils/SessionStateManager';

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
    if (issuer.hasCredentialConfiguration(type) !== false) {
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Credential type not found";
        return error;
    }

    error.data = { session, type };
    return error;
}

function extractBearerToken (authorizationHeader?: string): string | undefined 
{
    return authorizationHeader ? /Bearer (.*)/i.exec(authorizationHeader)?.[1] : undefined;
};

function getTypeFromRequest(credentialRequest: CredentialRequest, opts?: { filterVerifiableCredential: boolean }) {
    if (credentialRequest.credential_identifier) {
        // return the credential_identifier, the issuer will sort it out
        return credentialRequest.credential_identifier;
    }
    else if (['jwt_vc', 'jwt_vc_json'].includes(credentialRequest.format || '')) {
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
  