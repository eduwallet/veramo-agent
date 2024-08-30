/*
 * Instantiate credential configurations
 */

import { CREDENTIAL_CONFIGURATION_PATH } from "../environment";
import { loadJsonFiles } from "@utils/generic";
import { CredentialConfigurationSupportedV1_0_13 } from '@sphereon/oid4vci-common';

export interface CredentialConfigurationStore {
  [x: string]: CredentialConfigurationSupportedV1_0_13;
}

var _credentialConfigurationStore: CredentialConfigurationStore = {};
export const getCredentialConfigurationStore = (): CredentialConfigurationStore => _credentialConfigurationStore;

export async function initialiseCredentialConfigurationStore() {
  console.log('initialising credential configuration store, reading json files');
  const configurations = loadJsonFiles<CredentialConfigurationSupportedV1_0_13>({ path: CREDENTIAL_CONFIGURATION_PATH });
  _credentialConfigurationStore = configurations.asObject;
  console.log('end of credential configuration store initialisation');
}
