import Debug from 'debug';
const debug = Debug('issuer:credentials');

import { CREDENTIAL_CONFIGURATION_PATH } from "../environment.js";
import { loadJsonFiles } from "utils/generic.js";
import { CredentialConfiguration } from "types/specification/metadata.js";
import { getDbConnection } from '#root/database/databaseService';
import { CredentialType } from '#root/packages/datastore/index';

export interface CredentialConfigurationStore {
  [x: string]: CredentialConfiguration;
}

var _credentialConfigurationStore: CredentialConfigurationStore = {};
export const getCredentialConfigurationStore = (): CredentialConfigurationStore => _credentialConfigurationStore;

export async function initialiseCredentialConfigurationStore() {
  const dbConnection = await getDbConnection();
  const credRepo = dbConnection.getRepository(CredentialType);
  const credTypes = await credRepo.createQueryBuilder('credential_type').getMany();
  for (const credType of credTypes) {
    _credentialConfigurationStore[credType.name] = JSON.parse(credType.configuration);
  }

  debug('Loading credential configurations, path: ' + CREDENTIAL_CONFIGURATION_PATH);
  const configurations = loadJsonFiles<CredentialConfiguration>({ path: CREDENTIAL_CONFIGURATION_PATH }).asObject;
  for (const configId of Object.keys(configurations)) {
    if (!_credentialConfigurationStore[configId]) {
      debug("adding file base credential configuration to store");
      _credentialConfigurationStore[configId] = configurations[configId];

      const credType = new CredentialType();
      credType.name = configId;
      credType.configuration = JSON.stringify(configurations[configId]);
      credRepo.save(credType);
    }
  }
  debug('end of credential configuration store initialisation');
}
