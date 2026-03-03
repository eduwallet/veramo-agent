import Debug from 'debug';
const debug = Debug('issuer:api');
import { AccessTokenResponse } from 'types/specification/access_token.js';
import { Issuer } from 'issuer/Issuer.js';
import { CredentialOfferStatus } from 'types/api.js';
import { JWT } from '#root/jwt/JWT';
import { Session } from '#root/database/entities/index';
import moment from 'moment';

const TOKEN_EXPIRY = 30 * 60 * 1000;

export async function createAccessTokenResponse(issuer:Issuer, session:Session) {
    debug("creating access token");
    session.data.lastUpdatedAt = Date.now();
    session.data.status = CredentialOfferStatus.ACCESS_TOKEN_CREATED;
    await issuer.storeSession(session);

    const access_token = await generateAccessToken(issuer, session);
    debug("signed token", access_token);
    // https://www.rfc-editor.org/rfc/rfc6749.html#section-5
    const response: AccessTokenResponse = {
        access_token,
        token_type: 'bearer',
        expires_in: TOKEN_EXPIRY / 1000,
        // refresh_token is optional
    };

    // ID-1: 6.2: authorization_details is required if it was sent earlier on, optional
    // if not.
    // For now: we set this to the one credentialId of this interaction
    // TODO: update this when we want to support multiple credential issuance
    // We need to find all the datasets linked to the same credentialId and list these here,
    // so the wallet can potentially loop through these identifiers and request multiple
    // credentials in a row
    // We set the credential_configuration_id to the same value for lack of better ids
    // Please note: credential_configuration_id must be present in metadata.credential_configurations_supported
    // whereas credential_identifiers are a transaction-unique set of dataset-identifiers
    response.authorization_details = [{
        "type": "openid_credential",
        "credential_identifiers": [session.data.credentialId],
        "credential_configuration_id": session.data.credentialId
    }];

    // in ID2, nonces are retrieved from a nonce endpoint
    // DIIPv4 compliance: remove this section
    if (issuer.usesNonces) {
        const nonce = await issuer.nonceStates.get('', {session: session.uuid });
        debug("nonce created: ", nonce);
        response.c_nonce = nonce.uuid;
        response.c_nonce_expires_in = Math.floor((moment(nonce.expirationDate).toDate().getTime() - Date.now()) / 1000);
    }
    debug("access token response", response);
    return response
}
  
async function generateAccessToken(issuer:Issuer, session:Session)
{
    debug("generating access token");
    // JWT uses seconds for iat and exp
    const iat = new Date().getTime() / 1000
    const exp = iat + TOKEN_EXPIRY;
    const jwt:JWT = new JWT();
    jwt.header = { typ: 'JWT' };
    jwt.payload = {
            iat,
            exp,
            iss: issuer.did!.did,
            issuer_state: session.state,
            token_type: 'Bearer',
    };
    debug("access token content", jwt);
    return await issuer.signToken(jwt);
}
