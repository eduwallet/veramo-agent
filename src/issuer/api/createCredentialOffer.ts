import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from '../Issuer.js';
import { normalizeGrants } from '../../protocol/normalizeGrants.js';
import { AUTHORIZATION_CODE_GRANT } from 'types/specification/credential_offer.js';
import { CreateCredentialOfferRequest } from 'types/api/credentialOffer.js';
import { CredentialOfferData } from 'types/specification/credential_offer.js';
import { CreateCredentialData } from 'types/internal.js';
import { CredentialOfferStatus } from 'types/api.js';

export function createCredentialOffer(issuer:Issuer, request:CreateCredentialOfferRequest):CreateCredentialData {
    debug("creating credential offer", request);
    let { grants, issuerState, preAuthorizedCode, userPin } = normalizeGrants(request.grants);

    const credentialConfigIds = request.credentials as string[]

    const credentialOffer:CredentialOfferData = {
        grants,
        credential_configuration_ids: credentialConfigIds,
        credential_issuer: issuer.metadata.credential_issuer,
    };

    // If we use Authorized Code flow, pass the OAuth2 client_id in the offer
    // This is an out-of-spec implementation of Sphereon, but not supported in
    // the open source versions of the VcIssuer. 
    if (grants[AUTHORIZATION_CODE_GRANT]) {
        debug("offer for authorisation_code flow");
        if (issuer.options.clientId) {
            credentialOffer.client_id = issuer.options.clientId;
        }
        else {
            // EBSI stipulates that the credential_issuer is to be taken as client-id
            // Although the wallet can decide on this client_id itself, we pass it
            // along as out-of-spec data anyway
            credentialOffer.client_id = credentialOffer.credential_issuer;
        }
        debug("client id is ", credentialOffer.client_id);
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

    // store the requested dataset as a credential-data-set named after the credential id
    session.credentialDataSets = {};
    session.credentialDataSets[credentialConfigIds[0]] = {
        credentialId: credentialConfigIds[0],
        credentialConfiguration: issuer.getCredentialConfiguration(credentialConfigIds[0], false),
        data: request.credentialDataSupplierInput
    };

    if (userPin) {
        debug("using pincode ", userPin);
        session.pinCode = userPin;
    }

    if (preAuthorizedCode) {
        debug("using pre-authorized_code", preAuthorizedCode);
        session.state = preAuthorizedCode;
        issuer.authorizationState.set(preAuthorizedCode, session.id);
    }
    if (issuerState) {
        debug("using issuerState", issuerState);
        session.state = issuerState;
        issuer.authorizationState.set(issuerState, session.id);
    }

    issuer.storeSession(session);

    const retval = {
        id: session.id,
        ...(userPin && {pinCode:userPin })
    };
    debug("returning ", retval);
    return retval;
}