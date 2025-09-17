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
}

export interface RevokeCredentialRequest {
    uuid: string;
    state: string;
    listName?: string;
}
