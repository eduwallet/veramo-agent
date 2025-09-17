export interface StatusListW3C {
    id: string;
    type: string;
    statusListIndex: string
    statusListCredential: string;
    statusPurpose?: string;
    statusSize?:number;
    statusMessage?: any[];
}

export interface StatusListIETF {
    idx: number;
    uri: string;
}

// https://w3c.github.io/vc-bitstring-status-list/#examples
export interface StatusList {
    index:number;
    list:number;
    type:string;
    uri:string;
    credentialStatus: StatusListIETF|StatusListW3C
}

export interface StatusListOption {
    url: string;
    revoke: string;
    token: string;
}

export interface StatusListsOption {
    [x:string]: StatusListOption|StatusListOption[];
}
