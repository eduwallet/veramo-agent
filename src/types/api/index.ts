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
    uuid?: string;
    expiresAt?: number;  // deferred credentials: epoch milliseconds when the transaction expires
    reason?: string;     // deferred credentials: the reason the credential was denied
}

export interface RevokeCredentialRequest {
    uuid: string;
    state: string;
    listName?: string;
}
