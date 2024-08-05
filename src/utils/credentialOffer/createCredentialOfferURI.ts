import { v4 } from 'uuid'

import { Grant, CredentialDataSupplierInput, CredentialIssuerMetadataOpts, CredentialOfferPayloadV1_0_11, toUniformCredentialOfferRequest,
  CredentialOfferV1_0_11, OpenId4VCIVersion, IssueStatus, CredentialOfferSession
 } from '@sphereon/oid4vci-common'
import { VcIssuer, assertValidPinNumber, createCredentialOfferObject, createCredentialOfferURIFromObject } from '@sphereon/oid4vci-issuer'

import { IEWIssuerOptsImportArgs } from '../../types';

export async function createCredentialOfferURI<DIDDoc extends object>(
    grants: Grant,
    credentialData: CredentialDataSupplierInput,
    credentials: string[],
    pinLength: number,
    metadata: CredentialIssuerMetadataOpts,
    options: IEWIssuerOptsImportArgs,
    issuer: VcIssuer<DIDDoc>
  ) {
    let preAuthorizedCode: string | undefined = undefined
    let issuerState: string | undefined = undefined

    const credentialOfferPayload: CredentialOfferPayloadV1_0_11 = {
      ...(grants && { grants }),
      ...(credentials && { credentials }),
      ...(credentials && { credential_definition: credentials }),
      credential_issuer: metadata.credential_issuer,
    } as CredentialOfferPayloadV1_0_11

    if (grants?.authorization_code) {
      issuerState = grants?.authorization_code.issuer_state
      if (!issuerState) {
        issuerState = v4()
        grants.authorization_code.issuer_state = issuerState
      }
    }

    let userPinRequired: boolean | undefined
    let userPin: string | undefined
    if (grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']) {
      preAuthorizedCode = grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.['pre-authorized_code']
      userPinRequired = grants?.['urn:ietf:params:oauth:grant-type:pre-authorized_code']?.user_pin_required
      if (userPinRequired === undefined) {
        userPinRequired = false
        grants['urn:ietf:params:oauth:grant-type:pre-authorized_code'].user_pin_required = userPinRequired
      }
      if (!preAuthorizedCode) {
        preAuthorizedCode = v4()
        grants['urn:ietf:params:oauth:grant-type:pre-authorized_code']['pre-authorized_code'] = preAuthorizedCode
      }

      if (userPinRequired) {
        const length = pinLength ?? 4
        userPin = ('' + Math.round((Math.pow(10, length) - 1) * Math.random())).padStart(length, '0')
        assertValidPinNumber(userPin)
      }
    }

    const baseUri = metadata.credential_issuer;
    const credentialOfferObject = createCredentialOfferObject(metadata,
      {
        credentialOffer: credentialOfferPayload,
        baseUri,
        userPinRequired,
        preAuthorizedCode,
        issuerState,
      }
    );

    // If we use Authorized Code flow, pass the OAuth2 client_id in the offer
    // This is an out-of-spec implementation of Sphereon, but not supported in
    // the open source versions of the VcIssuer. 
    if (grants.authorization_code && options.clientId) {
      credentialOfferObject.credential_offer!.client_id = options.clientId;
    }

    const createdAt = +new Date()
    const lastUpdatedAt = createdAt
    const credentialOffer = await toUniformCredentialOfferRequest(
      {
        credential_offer: credentialOfferObject.credential_offer,
        credential_offer_uri: credentialOfferObject.credential_offer_uri,
      } as CredentialOfferV1_0_11,
      {
        version: OpenId4VCIVersion.VER_1_0_11,
        resolve: false, // We are creating the object, so do not resolve
      },
    )

    const status = IssueStatus.OFFER_CREATED
    const session: CredentialOfferSession = {
      preAuthorizedCode,
      issuerState,
      createdAt,
      lastUpdatedAt,
      status,
      ...(userPin && { userPin }),
      ...(credentialData && { credentialDataSupplierInput: credentialData }),
      credentialOffer,
    }

    if (preAuthorizedCode) {
      await issuer.credentialOfferSessions.set(preAuthorizedCode, session)
    }
    // todo: check whether we could have the same value for issuer state and pre auth code if both are supported.
    if (issuerState) {
      await issuer.credentialOfferSessions.set(issuerState, session)
    }

    const uri = createCredentialOfferURIFromObject(credentialOffer);
    return {
      uri
    }
  }