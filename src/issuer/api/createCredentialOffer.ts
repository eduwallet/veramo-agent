import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from '../Issuer.js';
import { normalizeGrants } from '../../protocol/normalizeGrants.js';
import { AUTHORIZATION_CODE_GRANT } from 'types/specification/credential_offer.js';
import { CreateCredentialOfferRequest } from 'types/api/credentialOffer.js';
import { CredentialOfferData } from 'types/specification/credential_offer.js';
import { CreateCredentialData } from 'types/internal.js';
import { CredentialOfferStatus } from 'types/api.js';

export async function createCredentialOffer(issuer:Issuer, request:CreateCredentialOfferRequest):Promise<CreateCredentialData> {
    debug("creating credential offer", request);
    let { grants, issuerState, preAuthorizedCode, userPin } = normalizeGrants(request.grants);

    const credentialConfigIds = request.credentials as string[]

    const credentialOffer:CredentialOfferData = {
        // spec ID-1:4.1.1 -> Object indicating to the Wallet the Grant Types the Credential Issuer's
        // Authorization Server is prepared to process for this Credential Offer.
        grants,
        // spec ID-1:3.3.4 ->  the Credential Issuer identifies offered Credential Configurations using the
        // credential_configuration_ids parameter
        // spec ID-1:4.1.1 -> A non-empty array of unique strings that each identify one of the keys in the
        // name/value pairs stored in the credential_configurations_supported Credential Issuer metadata.
        credential_configuration_ids: credentialConfigIds,
        // spec ID-1:4.1.1 -> The URL of the Credential Issuer, as defined in Section 11.2.1, from which
        // the Wallet is requested to obtain one or more Credentials. 
        credential_issuer: issuer.options.baseUrl,
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
    await issuer.clearExpired();

    const session = await issuer.getSessionById();
    session.data.status = CredentialOfferStatus.OFFER_CREATED;
    session.data.credentialOffer = credentialOffer;
    session.data.metaData = request.credentialMetadata || {};
    // TODO: update this when we want to support multiple credential issuance
    // We need to create a list of ids allowed for this session by the offer
    session.data.credentialId = credentialConfigIds[0];

    // store the requested dataset as a credential-data-set named after the credential id
    session.data.credentialDataSets = {};
    // TODO: update this when we want to support multiple credential issuance
    // We need to loop over all the ids supplied and set the relevant configuration and data
    session.data.credentialDataSets[credentialConfigIds[0]] = {
        credentialId: credentialConfigIds[0],
        credentialConfiguration: issuer.getCredentialConfiguration(credentialConfigIds[0], false),
        data: request.credentialDataSupplierInput,
        ...(request.credential && {credential: request.credential})
    };

    if (userPin) {
        debug("using pincode ", userPin);
        session.data.pinCode = userPin;
    }

    if (preAuthorizedCode) {
        debug("using pre-authorized_code", preAuthorizedCode);
        session.state = preAuthorizedCode;
    }
    if (issuerState) {
        debug("using issuerState", issuerState);
        session.state = issuerState;
    }

    await issuer.storeSession(session);

    const retval = {
        id: session.uuid,
        ...(userPin && {pinCode:userPin })
    };
    debug("returning ", retval);
    return retval;
}