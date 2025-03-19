// https://w3c.github.io/vc-bitstring-status-list/#examples
export interface StatusList {
    id: string;
    type: string;
    statusPurpose: string;
    statusListIndex: string
    statusListCredential: string;
}

export interface StatusListOption {
    url: string;
    revoke: string;
    token: string;
}

export interface StatusListsOption {
    [x:string]: StatusListOption;
}
