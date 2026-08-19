import { StatusList } from "#root/database/entities/StatusList";

export interface StatusListCredentialData {
    attribute:StatusListCredentialAttribute;
    listIndex: number;
    index: number;
    options: StatusListOptions;
}

export interface StatusListInterface
{
    name:string;
    id:string;
    size:number;
    purpose:string;
    type:string;
    bitSize:number;
    lists:StatusList[];

    getCredentialType():string;
}

export interface StatusListStatus
{
    type: StatusListInterface;
    statusList: StatusList;
    basepath:string;
    date:any;
}

export interface StatusListMessage {
    status: string;
    message: string;
}

export interface StatusListOptions {
    name: string;
    size: number;
    bitSize?: number;
    purpose:string;
    type?:string;
    messages?:StatusListMessage[];
}

export type StatusListCredentialAttribute = StatusListCredentialAttributeIETF | StatusListCredentialAttributeW3C;

export interface StatusListCredentialAttributeIETF
{
    idx: number;
    uri: string;
}

export interface StatusListCredentialAttributeW3C
{
    id: string;
    type: string;
    index: number;
    statusListCredential: string;
    statusPurpose?: string;
    statusSize?: number;
    statusMessage?:StatusListMessage[];
}