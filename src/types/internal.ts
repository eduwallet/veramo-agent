import { SessionState } from 'utils/SessionStateManager.js';
import { ErrorCodes } from './api.js';
import { StringKeyedObject } from './index.js';
import { StatusListsOption } from './specification/statuslists.js';
import { CredentialOffer } from './specification/credential_offer.js';
import { CredentialConfiguration, CredentialFormat } from './specification/metadata.js';
import { CredentialPayload } from '@veramo/core';

// Session state as maintained by the Issuer in the whole process of creating an offer up
// to receiving notifications
export interface IssuerSessionData extends SessionState {
    createdAt: number;
    lastUpdatedAt: number;
    status: string;
    credentialOffer:CredentialOffer;
    metaData: StringKeyedObject;
    credential: CredentialResult;
    principalCredentialId: string;
    credentialType: string;
    credentialId: string;
    credentialDataSets:StringKeyedObject;
    pinCode?:string;
    preAuthorizedCode?:string;
    issuerState?:string;
    requestResponseData?:any;
}

export interface IssuerConfiguration {
    name:string;
    baseUrl: string
    clientId?:string;
    clientSecret?:string;
    adminToken?:string;
    authorizationEndpoint?:string;
    tokenEndpoint?:string;
    statusLists?:StatusListsOption;
    did:string;
    usesNonces?:boolean;
}

export interface ApiState {
    error:ErrorCodes;
    description:string;
    data?:any;
}

export interface CreateCredentialData {
    id:string;
    pinCode?:string;
}

export interface CredentialDataSet {
    credentialId: string;
    credentialConfiguration:CredentialConfiguration;
    data: StringKeyedObject;
}

export interface CredentialProofData {
    session:IssuerSessionData;
    credentialDataSet:CredentialDataSet;
    nonce:string;
    key: any;
    did: string;
}

export interface CredentialResult {
    credential: CredentialPayload;
    format?: CredentialFormat;
    signCallback?: any // If the data supplier wants to actually sign directly
}