import Debug from 'debug';
const debug = Debug('issuer:credentials');

import { CREDENTIAL_CONFIGURATION_PATH } from "../environment.js";
import { loadJsonFiles } from "utils/generic.js";
import { CredentialConfiguration } from "types/specification/metadata.js";

export interface CredentialConfigurationStore {
  [x: string]: CredentialConfiguration;
}

const _credentialConfigurationStore: CredentialConfigurationStore = {};
export const getCredentialConfigurationStore = (): CredentialConfigurationStore => _credentialConfigurationStore;

async function readFromFile()
{
  try {
    debug('Loading credential configurations, path: ' + CREDENTIAL_CONFIGURATION_PATH);
    const configurations = loadJsonFiles<CredentialConfiguration>({ path: CREDENTIAL_CONFIGURATION_PATH }).asObject;
    for (const configId of Object.keys(configurations)) {
      if (!_credentialConfigurationStore[configId]) {
        debug("adding file base credential configuration to store");
        _credentialConfigurationStore[configId] = configurations[configId];
      }
    }
  }
  catch (e) {
    debug("Missing credentials configuration path", e);
  }
}

export async function initialiseCredentialConfigurationStore() {
  await readFromFile();
  debug('end of credential configuration store initialisation');
}
