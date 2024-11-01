/*
 * Instantiate credential configurations
 */

import { CREDENTIAL_CONFIGURATION_PATH } from "../environment";
import { CredentialConfigurationSupportedV1_0_13 } from '@sphereon/oid4vci-common';
import { debug } from "utils/logger";
import { loadJsonFiles } from "utils/generic";

export interface CredentialConfigurationStore {
  [x: string]: CredentialConfigurationSupportedV1_0_13;
}

var _credentialConfigurationStore: CredentialConfigurationStore = {};
export const getCredentialConfigurationStore = (): CredentialConfigurationStore => _credentialConfigurationStore;

export async function initialiseCredentialConfigurationStore() {
  debug('Loading credential configurations, path: ' + CREDENTIAL_CONFIGURATION_PATH);
  const configurations = loadJsonFiles<CredentialConfigurationSupportedV1_0_13>({ path: CREDENTIAL_CONFIGURATION_PATH });
  _credentialConfigurationStore = configurations.asObject;
  debug('end of credential configuration store initialisation');
}
