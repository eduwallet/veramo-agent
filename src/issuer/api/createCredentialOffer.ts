import Debug from 'debug';
const debug = Debug('issuer:api');
import { Issuer } from '../Issuer.js';
import { normalizeGrants } from '../../protocol/normalizeGrants.js';
import { AUTHORIZATION_CODE_GRANT, PRE_AUTHORIZED_CODE_GRANT } from 'types/specification/credential_offer.js';
import { APIGrants, CreateCredentialOfferRequest } from 'types/api/credentialOffer.js';
import { StringKeyedObject } from 'types/index.js';
import { CredentialOfferData } from 'types/specification/credential_offer.js';
import { CreateCredentialData } from 'types/internal.js';
import { CredentialOfferStatus } from 'types/api.js';

// The input for a single data set of an offer: one credential to be issued
export interface OfferDataSetInput {
    credentialId: string;           // the credential_configuration_id
    data?: StringKeyedObject;
    credential?: any;
    callback?: string;
}

export interface OfferInput {
    grants: APIGrants;
    dataSets: OfferDataSetInput[];
    credentialMetadata?: StringKeyedObject;
    // verification during issuance: the DCQL query that the wallet has to answer before it gets an access token
    presentation?: { dcql: object };
}

/**
 * The identifier of a data set in the session. It is transaction-unique and is passed to the wallet as
 * credential_identifier in the authorization_details of the token response.
 */
export function createDataSetId(credentialId:string, index:number):string
{
    return `${credentialId}#${index}`;
}

// The (v1) request offers a single credential
export async function createCredentialOffer(issuer:Issuer, request:CreateCredentialOfferRequest):Promise<CreateCredentialData> {
    debug("creating credential offer", request);
    return createCredentialOfferForDataSets(issuer, {
        grants: request.grants,
        credentialMetadata: request.credentialMetadata,
        dataSets: [{
            credentialId: request.credentials[0],
            data: request.credentialDataSupplierInput,
            credential: request.credential,
            callback: request.credential_callback
        }]
    });
}

export async function createCredentialOfferForDataSets(issuer:Issuer, input:OfferInput):Promise<CreateCredentialData> {
    const { grants, issuerState, preAuthorizedCode, userPin } = normalizeGrants(input.grants);

    // spec ID-1:4.1.1 -> a non-empty array of unique strings
    const credentialConfigIds = [...new Set(input.dataSets.map((ds) => ds.credentialId))];

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

    // spec ID-1:4.1.1 -> authorization_server: the Wallet MUST use this authorization server for the
    // grant. The issuer selects it, depending on the flow
    if (grants[AUTHORIZATION_CODE_GRANT]) {
        grants[AUTHORIZATION_CODE_GRANT].authorization_server = issuer.authorizationServerFor('authorization_code', !!input.presentation);
    }
    if (grants[PRE_AUTHORIZED_CODE_GRANT]) {
        grants[PRE_AUTHORIZED_CODE_GRANT].authorization_server = issuer.authorizationServerFor('pre-authorized_code', false);
    }

    // before we create a new session, clear out the old ones
    await issuer.clearExpired();

    const session = await issuer.getSessionById();
    session.data.status = CredentialOfferStatus.OFFER_CREATED;
    session.data.credentialOffer = credentialOffer;
    session.data.metaData = input.credentialMetadata || {};
    if (input.presentation) {
        session.data.authorization = { presentation: { dcql: input.presentation.dcql } };
    }

    // store the requested data sets, each with its own identifier. The wallet requests these
    // one by one using the credential_identifiers of the access token response
    session.data.credentialDataSets = {};
    input.dataSets.forEach((dataSet, idx) => {
        const id = createDataSetId(dataSet.credentialId, idx);
        // a deferred credential can be created without any data, as the back-office can supply it later
        const deferredSettings = issuer.getDeferredSettings(dataSet.credentialId);
        session.data.credentialDataSets[id] = {
            id,
            credentialId: dataSet.credentialId,
            credentialConfiguration: issuer.getCredentialConfiguration(dataSet.credentialId)!,
            data: deferredSettings ? (dataSet.data ?? {}) : dataSet.data,
            ...(dataSet.credential && {credential: dataSet.credential}),
            ...(dataSet.callback && {callback: dataSet.callback})
        };
    });

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