/*
 * Instantiate credential configurations
 */

import { CREDENTIAL_CONFIGURATION_PATH } from "../environment";
import { debug } from "utils/logger";
import { loadJsonFiles } from "utils/generic";
import { CredentialConfiguration } from "types/specification/metadata";

export interface CredentialConfigurationStore {
  [x: string]: CredentialConfiguration;
}

var _credentialConfigurationStore: CredentialConfigurationStore = {};
export const getCredentialConfigurationStore = (): CredentialConfigurationStore => _credentialConfigurationStore;

export async function initialiseCredentialConfigurationStore() {
  debug('Loading credential configurations, path: ' + CREDENTIAL_CONFIGURATION_PATH);
  const configurations = loadJsonFiles<CredentialConfiguration>({ path: CREDENTIAL_CONFIGURATION_PATH });
  _credentialConfigurationStore = configurations.asObject;
  debug('end of credential configuration store initialisation');
}
