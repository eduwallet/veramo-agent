import { Grant, CredentialDataSupplierInput, CredentialIssuerMetadataOpts, CredentialOfferPayloadV1_0_13, IssueStatus, CredentialOfferSession
 } from '@sphereon/oid4vci-common'
import { VcIssuer } from '@sphereon/oid4vci-issuer'

import { IEWIssuerOptsImportArgs } from '../../types';
import { normalizeGrants } from './normalizeGrants';

export interface CredentialOfferData {
  id: string;
  userPin: string|undefined;
}

export async function createCredentialOffer<DIDDoc extends object>(
    configuredGrants: Grant,
    credentialData: CredentialDataSupplierInput,
    credentials: string[],
    pinLength: number,
    metadata: CredentialIssuerMetadataOpts,
    options: IEWIssuerOptsImportArgs,
    issuer: VcIssuer<DIDDoc>
  ):Promise<CredentialOfferData> {
    let { grants, issuerState, preAuthorizedCode, userPin } = normalizeGrants(configuredGrants, pinLength);

    const credentialOfferPayload: CredentialOfferPayloadV1_0_13 = {
      ...(grants && { grants }),
      ...(credentials && { credentials }),
      ...(credentials && { credential_configuration_ids: credentials }),
      credential_issuer: metadata.credential_issuer,
    } as CredentialOfferPayloadV1_0_13

    // If we use Authorized Code flow, pass the OAuth2 client_id in the offer
    // This is an out-of-spec implementation of Sphereon, but not supported in
    // the open source versions of the VcIssuer. 
    if (grants.authorization_code) {
        if (options.clientId) {
            credentialOfferPayload.client_id = options.clientId;
        }
        else {
            // EBSI stipulates that the credential_issuer is to be taken as client-id
            // Although the wallet can decide on this client_id itself, we pass it
            // along as out-of-spec data anyway
            credentialOfferPayload.client_id = metadata.credential_issuer;
        }
    }

    const createdAt = +new Date()
    const lastUpdatedAt = createdAt
    const status = IssueStatus.OFFER_CREATED
    const session: CredentialOfferSession = {
      preAuthorizedCode,
      issuerState,
      createdAt,
      lastUpdatedAt,
      status,
      ...(userPin && { userPin }),
      ...(credentialData && { credentialDataSupplierInput: credentialData }),
      credentialOffer: { credential_offer: credentialOfferPayload },
    }

    // link the session data to easy-to-retrieve keys
    if (preAuthorizedCode) {
      await issuer.credentialOfferSessions.set(preAuthorizedCode, session)
    }
    if (issuerState) {
      await issuer.credentialOfferSessions.set(issuerState, session)
    }

    // return the unique id with which to retrieve the offer from the session
    if (preAuthorizedCode) {
      return { id: preAuthorizedCode, userPin: userPin };
    }
    else {
      return { id: issuerState ?? '', userPin: userPin };
    }
}