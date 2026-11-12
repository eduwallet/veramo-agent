import { CredentialOfferStatus } from "#root/types/api";

export interface ListCredentialsRequest {
    issuanceDate?:string;
    state?:string;
    holder?:string;
    credential?:string;
    primaryId?:string;
}

export interface IssueStatusResponse {
    createdAt: number;
    lastUpdatedAt: number;
    status: CredentialOfferStatus;
    error?: string;
    clientId?: string;
    // the credentials issued so far, with the uuid to use for the revocation api
    credentials?: { uuid: string, dataset_id: string, credential_configuration_id: string }[];
    expiresAt?: number;  // deferred credentials: epoch milliseconds when the transaction expires
    reason?: string;     // deferred credentials: the reason the credential was denied
    // deferred credentials: the state of every deferred transaction of the offer
    deferred?: { id: string, credential_configuration_id: string, status: string, expiresAt: number, reason?: string }[];
}

export interface RevokeCredentialRequest {
    uuid: string;
    state: string;
    listName?: string;
}
