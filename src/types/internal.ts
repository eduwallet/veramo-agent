import { ErrorCodes } from './api';
import { StringKeyedObject } from './index';
import { Metadata, StatusListsOption, TxCode } from './specification';
import { Credential } from './specification/virtual_credential';

// Session state as maintained by the Issuer in the whole process of creating an offer up
// to receiving notifications
export interface IssuerSessionData {
    createdAt: number;
    state: string;
    credential?: Credential;
    metaData?: StringKeyedObject;
    holder?:string;
    principalCredentialId?: string;
    credentialId?: string;
    credentialType?: string;
    uuid?: string;
    requestResponseData?:any;
}


interface IIssuerOptsPersistArgs {
    overwriteExisting?: boolean // Whether to overwrite any existing metadata for a credential issuer. Defaults to true
    issuerOpts: IIssuerOptions
}  

export interface IssuerConfiguration {
    name:string;
    options: IIssuerOptsPersistArgs;
    baseUrl: string
    enableCreateCredentials: boolean
    clientId?:string;
    clientSecret?:string;
    adminToken?:string;
    authorizationEndpoint?:string;
    tokenEndpoint?:string;
    statusLists?:StatusListsOption;
    did:string;
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
    data: StringKeyedObject;
}
