import { ErrorCodes } from '#root/types/api';
import { StringKeyedObject } from '#root/types/index';
import { StatusListsOption } from '#root/types/internal/statuslists';
import { CredentialOffer } from '#root/types/specification/credential_offer';
import { CredentialConfiguration, CredentialFormat } from '#root/types/specification/metadata';
import { Session } from '#root/packages/datastore/entities/Session';

// Session state as maintained by the Issuer in the whole process of creating an offer up
// to receiving notifications
export interface IssuerSessionData {
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
    id?: number;
    name:string;
    baseUrl: string
    clientId?:string;
    clientSecret?:string;
    adminToken?:string;
    authorizationEndpoint?:string;
    tokenEndpoint?:string;
    statusLists?:StatusListsOption;
    did:string;
    key?:string;
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
    credential?:any;
    callback?:string|null;
}

export interface HolderData {
    type: string;
    did?: string;
    data: any;
}

export interface SingleProofData {
    nonce:string;
    key: any;
    did: string;
    holder: HolderData;
}

export interface CredentialProofData {
    session:Session;
    credentialDataSet:CredentialDataSet;
    proofResults:SingleProofData[];
}

export interface CredentialResult {
    credential: any;
    format?: CredentialFormat;
    signCallback?: any // If the data supplier wants to actually sign directly
}