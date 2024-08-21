/*
 * Instantiate credential configurations
 */

import { CREDENTIAL_PATH } from "../environment";
import { loadJsonFiles } from "@utils/generic";
import { CredentialConfigurationSupportedV1_0_13 } from '@sphereon/oid4vci-common';

export interface CredentialStore {
    [x:string]:CredentialConfigurationSupportedV1_0_13;
}

var _credentialStore:CredentialStore = {};
export const getCredentialStore = ():CredentialStore => _credentialStore;

export async function initialiseCredentialStore() {
    console.log('initialising credential store, reading json files');
    const configurations = loadJsonFiles<CredentialConfigurationSupportedV1_0_13>({path: CREDENTIAL_PATH});
    _credentialStore = configurations.asObject;
    console.log('end of credential store initialisation');
}
