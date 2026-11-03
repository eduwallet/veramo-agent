import { ErrorCodes } from '#root/types/api';
import { StringKeyedObject } from '#root/types/index';
import { CredentialOffer } from '#root/types/specification/credential_offer';
import { CredentialConfiguration, CredentialFormat } from '#root/types/specification/metadata';
import { Session } from '#root/database/entities/index';
import { CryptoKey } from '@muisit/cryptokey';

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
    deferred?:DeferredSessionData;
}

// State of a deferred issuance transaction, stored in the session. The status is one of
// CredentialOfferStatus.CREDENTIAL_PENDING, CREDENTIAL_READY, CREDENTIAL_DENIED or CREDENTIAL_ISSUED
export interface DeferredSessionData {
    transactionId: string;
    status: string;
    credentialId: string;                     // the credential configuration id
    credentialDataSet: CredentialDataSet;     // the data set as it was known at the credential request
    holders: HolderData[];                    // the holder keys, one per proof, without the key objects
    claims: StringKeyedObject;                // the claims supplied by the back-office
    reason?: string;                          // the reason for denying the credential
    ttl: number;                              // seconds
    interval: number;                         // seconds
    createdAt: number;                        // epoch milliseconds
    expiresAt: number;                        // epoch milliseconds
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
    ckey?:CryptoKey;
}

export interface SingleProofData {
    nonce:string;
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