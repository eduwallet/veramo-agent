import { StatusList } from "#root/database/entities/StatusList";

export interface StatusListInterface
{
    name:string;
    id:string;
    adminTokens:string[];
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

export interface StatusListTypeOptions {
    name: string;
    tokens: string[];
    size: number;
    bitSize?: number;
    purpose:string;
    type?:string;
    messages?:StatusListMessage[];
}
