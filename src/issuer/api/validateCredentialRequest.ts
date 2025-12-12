import Debug from 'debug';
const debug = Debug('issuer:api');
import { verifyAccessTokenJWT } from '#root/issuer/lib/verifyAccessTokenJWT';
import { Request } from 'express'
import { Issuer } from '#root/issuer/Issuer';
import { CredentialOfferStatus, ErrorCodes } from '#root/types/api';
import { ApiState } from '#root/types/internal';
import { CredentialRequest } from '#root/types/specification/credential_request';
import { JWT } from '#root/jwt/JWT';
import { getHolderKeyFromProofJwt, getSignatureKeyFromProofJwt } from '#root/issuer/lib/getSignatureKeyFromProofJwt';
import { Factory } from '@muisit/cryptokey';
import { Session } from '#root/packages/datastore/entities/Session';
import moment from 'moment';

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

    let session:Session|null = null;

    // try to decode the access token as if it were a JWT
    try {
        // this decodes the JWT, or retrieves data from the user info endpoint
        const data  = await verifyAccessTokenJWT(jwt, issuer);

        if (issuer.usesAuthorisedCodeFlow()) {
            // the issuer should be one of our authorization servers
            if (!issuer.options?.authorizationEndpoint == data?.payload?.iss) {
                debug("invalid because the access token issuer is not in our AS list", data!.payload.iss);
                error.error = ErrorCodes.INVALID_REQUEST;
                error.description = "Unauthorised";
                return error;
            }
        }
        else  {
            // we must have issued it ourselves
            if (data?.payload?.iss != issuer.did?.did) {
                debug("invalid because the token issuer is not our did", data?.payload?.iss);
                error.error = ErrorCodes.INVALID_REQUEST;
                error.description = "Unauthorised";
                return error;
            }
        }
    
        const stateid = data?.payload?.issuer_state;
        session = await issuer.getSessionByState(stateid);
        if (session) {
            debug('setting session access data to ', data?.payload);
            session.data.accessData = data?.payload;
        }

        if (!issuer.usesAuthorisedCodeFlow() && session && session.data?.status != CredentialOfferStatus.ACCESS_TOKEN_CREATED) {
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
    session.data.status = CredentialOfferStatus.CREDENTIAL_REQUEST_RECEIVED;
    await issuer.storeSession(session);

    let credentialDataSet:any = null;
    // spec ID-1: 8.2: credential_identifier: REQUIRED when an Authorization Details of type
    // openid_credential was returned from the Token Response. 
    if (request.body.credential_identifier) {
        credentialDataSet = session.data?.credentialDataSets[request.body.credential_identifier];
    }
    // spec ID-1: 8.2: credential_configuration_id: REQUIRED if a credential_identifiers
    // parameter was not returned from the Token Response as part of the authorization_details parameter.
    // As we return authorization_details, this should never happen for proper wallets
    // However, for authorization_code flow, we do not control the token endpoint, so we do not know what
    // the wallet ay decide.
    else if(request.body.credential_configuration_id) {
        credentialDataSet = session.data?.credentialDataSets[request.body.credential_configuration_id];
    }

    // the following overrides if the credential request refers to incorrect datasets
    // However, this only works if we have a single credential to hand out
    if (!credentialDataSet) {
        // TODO: update this when we want to support multiple credential issuance
        // see if we have a set based on the session credential id
        credentialDataSet = session.data?.credentialDataSets[session.data?.credentialId];
    }

    if (!credentialDataSet) {
    // TODO: update this when we want to support multiple credential issuance
        // if we did not get a credentialDataSet back, we rely on the id as documented in the session
        const credentialConfiguration = issuer.getCredentialConfiguration(session.data?.credentialId, false);
        if (credentialConfiguration === null) {
            debug("invalid because credential configuration could not be found", session.data?.credentialId);
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
        debug("Creating request credential data set based on session data instead of request data");
        credentialDataSet = {
            credentialId: session.data?.credentialId,
            credentialConfiguration,
            data: {} // we hope the credential implementation can determine the required values itself
        };
    }

    const proofResults = await validateCredentialRequestProofs(issuer, session, request.body);
    // if we get a single ApiState back, it is the error on the proof that fails
    if (!Array.isArray(proofResults.data) && proofResults.error && proofResults.error != ErrorCodes.NO_ERROR) {
        return error;
    }
    session.data.proofs = proofResults.data;
    await issuer.storeSession(session);

    // return a CredentialProofData object
    error.data = { session, credentialDataSet, proofResults: proofResults.data};
    debug("credential request is valid");
    return error;
}

async function validateCredentialRequestProofs(issuer:Issuer, session:Session, credentialRequest:CredentialRequest): Promise<ApiState>
{
    // we only support JWT proofs at this moment
    let proofs:string[] = credentialRequest.proofs?.jwt || [];

    // TODO: Version 16 does no longer specify the singular proof version.
    if ((!proofs || !proofs.length) && credentialRequest.proof && credentialRequest.proof.proof_type == 'jwt' && credentialRequest.proof.jwt) {
        proofs = [credentialRequest.proof?.jwt];
    }
    let proofResults:ApiState[] = [];

    if (!proofs || proofs.length < 1) {
        return {
            error: ErrorCodes.INVALID_REQUEST,
            description: "Proof of possession missing"
        };
    }

    for(const proof of proofs) {
        const proofError = await validateCredentialRequestProof(issuer, session, proof);

        if (proofError.error != ErrorCodes.NO_ERROR) {
            return proofError;
        }
        proofResults.push(proofError.data);
    }

    // return the did of the proof, this is the holder key
    return { error: ErrorCodes.NO_ERROR, description: '', data: proofResults};
}

async function validateCredentialRequestProof(issuer:Issuer, session:Session, proof:string):Promise<ApiState>
{
    const error:ApiState = {error:ErrorCodes.NO_ERROR, description: ''};
    
    if (!proof || !proof.length) {
        debug("Proof is invalid because it is missing", proof);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Proof of possession missing";
        return error;
    }

    const jwt = JWT.fromToken(proof);
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
    if ((header.typ as string) !== 'openid4vci-proof+jwt' && (header.typ as string) !== 'JWT') {
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
        // this is a special case for wwwallet, which uses a jwk in the proof and hence
        // does not have a regular did
        did = await Factory.toDIDJWK(ckey);
    }

    const payload = jwt.payload;
    const { iss, aud, iat, nonce } = payload;
    // in the body:
    // iss: optional, must not be present for pre-auth, contains client_id
    // not testing for this. We could test that it is not present in pre-auth, but who cares
    // we could test that it IS present in auth flow, but it is optional...

    // aud: required, credential issuer identifier
    if (!aud || aud !== issuer.options.baseUrl) {
        debug("Proof is invalid because aud claim is incorrect", aud);
        error.error = ErrorCodes.INVALID_REQUEST;
        error.description = "Invalid aud claim";
        return error;
    }

    // iat: required, time the proof was created
    // cannot be after the expiration time
    if (!iat || moment(iat * 1000).toDate() > session.expirationDate!) {
        debug("Proof is invalid because it expired based in iat", iat, (session.expirationDate!.getTime() / 1000));
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

        const cNonceState = await issuer.nonceStates.get(nonce);
        if (!cNonceState) {
            debug("Proof is invalid because the nonce was not found", nonce);
            error.error = ErrorCodes.INVALID_REQUEST;
            error.description = "Invalid nonce";
            return error;
        }

        // with the nonce endpoint, we do not always match a nonce with a session or state
        if (cNonceState.session != '' && cNonceState.session !== session.uuid) {
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
    error.data = {did, nonce, key: ckey, holder: getHolderKeyFromProofJwt(jwt, did)};
    return error;
}

function extractBearerToken (authorizationHeader?: string): string | undefined 
{
    return authorizationHeader ? /Bearer (.*)/i.exec(authorizationHeader)?.[1] : undefined;
};

