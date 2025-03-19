import { Issuer } from '../Issuer';
import { normalizeGrants } from '../../protocol/normalizeGrants';
import { AUTHORIZATION_CODE_GRANT } from 'types/specification';
import { CreateCredentialOfferRequest, CredentialOfferStatus } from 'types/api';
import { CredentialOfferData } from 'types/specification/credential_offer';
import { CreateCredentialData } from 'types/internal';

export function createCredentialOffer(issuer:Issuer, request:CreateCredentialOfferRequest):CreateCredentialData {
    let { grants, issuerState, preAuthorizedCode, userPin } = normalizeGrants(request.grants);

    const credentialConfigIds = request.credentials as string[]

    const credentialOffer: CredentialOfferData = {
        grants,
        credential_configuration_ids: credentialConfigIds,
        credential_issuer: issuer.metadata.credential_issuer,
    };

    // If we use Authorized Code flow, pass the OAuth2 client_id in the offer
    // This is an out-of-spec implementation of Sphereon, but not supported in
    // the open source versions of the VcIssuer. 
    if (grants[AUTHORIZATION_CODE_GRANT]) {
        if (issuer.options.clientId) {
            credentialOffer.client_id = issuer.options.clientId;
        }
        else {
            // EBSI stipulates that the credential_issuer is to be taken as client-id
            // Although the wallet can decide on this client_id itself, we pass it
            // along as out-of-spec data anyway
            credentialOffer.client_id = credentialOffer.credential_issuer;
        }
    }

    // before we create a new session, clear out the old ones
    issuer.clearExpired();

    const session = issuer.getSessionById();
    session.createdAt = Date.now();
    session.lastUpdatedAt = Date.now();
    session.status = CredentialOfferStatus.OFFER_CREATED;
    session.credentialOffer = credentialOffer;
    session.metaData = request.credentialMetadata || {};
    session.credentialId = credentialConfigIds[0];

    if (userPin) {
        session.pinCode = userPin;
    }
    if (request.credentialDataSupplierInput) {
        session.credentialDataSupplierInput = request.credentialDataSupplierInput;
    }
    if (preAuthorizedCode) {
        session.preAuthorizedCode = preAuthorizedCode;
        issuer.authorizationState.set(preAuthorizedCode, session.id);
    }
    if (issuerState) {
        session.issuerState = issuerState;
        issuer.authorizationState.set(issuerState, session.id);
    }

    issuer.storeSession(session);

    return {
        id: session.preAuthorizedCode || session.issuerState || session.id,
        ...(userPin && {pinCode:userPin })
    };
}