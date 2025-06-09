import Debug from 'debug';
const debug = Debug('issuer:api');
import { verifyAccessTokenJWT } from '../lib/verifyAccessTokenJWT.js';
import { Request } from 'express'
import { Issuer } from 'issuer/Issuer.js';
import { CredentialOfferStatus, ErrorCodes } from 'types/api.js';
import { ApiState } from 'types/internal.js';
import { CredentialRequest } from 'types/specification/credential_request.js';
import { SessionState } from 'utils/SessionStateManager.js';
import { JWT } from '#root/jwt/JWT';
import { getSignatureKeyFromProofJwt } from '../lib/getSignatureKeyFromProofJwt.js';
import { Factory } from '@muisit/cryptokey';

export async function validateCredentialRequest(issuer:Issuer, request:Request)
{
    debug("validating credential request", request.body);
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};

    const jwt = extractBearerToken(request.header('Authorization'));
    if (!jwt) {
        debug("invalid because the bearer token is not present");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Unauthorized";
        return error;
    }

    let session:SessionState|null = null;

    // try to decode the access token as if it were a JWT
    try {
        const data  = await verifyAccessTokenJWT(jwt, issuer);

        if (issuer.usesAuthorisedCodeFlow()) {
            // the issuer should be one of our authorization servers
            if (!issuer.metadata.authorization_servers.includes(data.payload.iss)) {
                debug("invalid because the access token issuer is not in our AS list", data.payload.iss);
                error.error = ErrorCodes.INVALID_REQUEST;
                error.description = "Unauthorised";
                return error;
            }
        }
        else  {
            // we must have issued it ourselves
            if (data.payload.iss != issuer.did?.did) {
                debug("invalid because the token issuer is not our did", data.payload.iss);
                error.error = ErrorCodes.INVALID_REQUEST;
                error.description = "Unauthorised";
                return error;
            }
        }
    
        const stateid = data.payload.issuer_state;
        const sessionId = issuer.authorizationState.get(stateid);

        if (!sessionId) {
            debug("invalid because we could not find the state", stateid);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "No state found";
            return error;
        }
        session = issuer.getSessionById(sessionId);

        if (!issuer.usesAuthorisedCodeFlow() && session && session.status != CredentialOfferStatus.ACCESS_TOKEN_CREATED) {
            debug("invalid because we use pre-authorised code flow and did not yet create an access token");
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "No access token created";
            return error;
        }
    }
    catch (e) {
        debug("caught error on access token validation", e);
        console.error("Caught exception on validating access token", e);
    }

    if (!session) {
        debug("invalid because session could not be found");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No state found";
        return error;
    }
    session.status = CredentialOfferStatus.CREDENTIAL_REQUEST_RECEIVED;
    issuer.storeSession(session);

    let credentialDataSet:any = null;
    if (request.body.credential_identifier) {
        credentialDataSet = session.credentialDataSets[request.body.credential_identifier];
    }

    if (!credentialDataSet) {
        // see if we have a set based on the session credential id
        credentialDataSet = session.credentialDataSets[session.credentialId];
    }

    if (!credentialDataSet) {
        // if we did not get a credentialDataSet back, we rely on the id as documented in the session
        const credentialConfiguration = issuer.getCredentialConfiguration(session.credentialId);
        if (credentialConfiguration === null) {
            debug("invalid because credential configuration could not be found", session.credentialId);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Credential type not found";
            return error;
        }

        if (request.body.format && credentialConfiguration.format !== request.body.format) {
            debug("invalid because the requested format is not supported by this credential", request.body.format);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Requested credential format not supported";
            return error;
        }
        credentialDataSet = {
            credentialId: session.credentialId,
            credentialConfiguration,
            data: {} // we hope the credential implementation can determine the required values itself
        };
    }

    error = await validateCredentialRequestProof(issuer, session, request.body);
    if (error.error != ErrorCodes.NO_ERROR) {
        debug("invalid proof");
        return error;
    }
    session.holder = error.data.did;
    issuer.storeSession(session);

    // return a CredentialProofData object
    error.data = { session, credentialDataSet, nonce: error.data.nonce, key: error.data.key, did: error.data.did};
    debug("credential request is valid");
    return error;
}

async function validateCredentialRequestProof(issuer:Issuer, session:SessionState, credentialRequest:CredentialRequest): Promise<ApiState>
{
    let error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    // we only support JWT proofs at this moment
    if (!credentialRequest.proof || !credentialRequest.proof.jwt) {
        debug("Proof is invalid because it is missing", credentialRequest.proof);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Proof of possession missing";
        return error;
    }

    const jwt = JWT.fromToken(credentialRequest.proof.jwt!);
    if (!jwt.header.kid && !jwt.header.jwk) {
        debug("Proof is invalid because the issuer key is not set");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid proof of possession";
        return error;
    }

    const ckey = await getSignatureKeyFromProofJwt(jwt);
    if (!ckey) {
        debug("Proof is invalid because the issuer key cannot be resolved");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid proof of possession";
        return error;
    }
    const verificationResult = await jwt.verify(ckey);
    
    if (!verificationResult) {
        debug("Proof is invalid because the token could not be verified", verificationResult);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid proof of possession";
        return error;
    }

    const header = jwt.header;
    const alg = header.alg;
    // checking the composition of the proof, which should normally be a no-brainer
    //
    // we are not going to check the validity of the signature and whether the header
    // composition is valid or not: if verifyJWT was able to verify the signature,
    // the JWT is signed and the contents are valid

    // https://openid.net/specs/openid-4-verifiable-credential-issuance-1_0-ID1.html#name-jwt-proof-type
    // alg: required, must not be none
    if (!alg || alg === 'none') {
        // if we did not determine an algorithm, how did verifyJWT return a verified result above...
        debug("Proof is invalid because the algorithm is invalid", alg);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid proof algorithm";
        return error;
    }
    // typ: required, must be openid4vci-proof+jwt'
    // the did-jwt library predefines the typ header claim to always be JWT, which is
    // obviously not the case
    if ((header.typ as string) !== 'openid4vci-proof+jwt') {
        debug("Proof is invalid because the JWT type is incorrect", header.typ);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid proof type";
        return error;
    }

    // kid: optional. If present it must be a did
    // jwk: optional, used instead of kid. 
    // x5c: optional, used instead of kid. not supported at the moment
    // trust_chain: optional, OIDFed information
    let did = header.kid;
    if (did && did.indexOf('#') > 0) {
        did = did.substring(0, did.indexOf('#'));
    }
    else {
        // create a did from the key material so we can use it as credentialSubject id
        did = Factory.toDIDJWK(ckey);
    }

    const payload = jwt.payload;
    const { iss, aud, iat, nonce } = payload;
    // in the body:
    // iss: optional, must not be present for pre-auth, contains client_id
    if (session.issuerState && !iss) {
        debug("Proof is invalid because iss claim is not found", iss);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No iss claim found";
        return error;
    }

    // aud: required, credential issuer identifier
    if (!aud || aud !== issuer.metadata.credential_issuer) {
        debug("Proof is invalid because aud claim is incorrect", aud);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid aud claim";
        return error;
    }

    // iat: required, time the proof was created
    // cannot be after the expiration time
    if (!iat || iat > Math.round(session.expires / 1000)) {
        debug("Proof is invalid because it expired based in iat", iat, Math.round(session.expires / 1000));
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid iat claim";
        return error;
    }
    
    if (issuer.usesNonces && !issuer.usesAuthorisedCodeFlow()) {
        // nonce: optional, must be present if a c_nonce was supplied
        if (!nonce) {
            debug("Proof is invalid because the nonce is not present");
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "No nonce value found";
            return error;
        }

        const cNonceState = issuer.nonceStates.get(nonce);
        if (!cNonceState) {
            debug("Proof is invalid because the nonce was not found", nonce);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Invalid nonce";
            return error;
        }

        if (cNonceState !== session.id) {
            debug("Proof is invalid because the nonce does not match", cNonceState, session.id);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Invalid nonce";
            return error;
        }
    }

    if (!did) {
        debug("Proof is invalid because we could not find a did");
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "No did found";
        return error;
    }

    // return the did of the proof, this is the holder key
    error.data = {did, nonce, key: ckey};
    debug("Proof is valid");
    return error;
}

function extractBearerToken (authorizationHeader?: string): string | undefined 
{
    return authorizationHeader ? /Bearer (.*)/i.exec(authorizationHeader)?.[1] : undefined;
};

