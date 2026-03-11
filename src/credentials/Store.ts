import Debug from 'debug';
const debug = Debug('issuer:credentials');

import { CREDENTIAL_CONFIGURATION_PATH } from "../environment.js";
import { loadJsonFiles } from "utils/generic.js";
import { CredentialConfiguration } from "types/specification/metadata.js";
import { getDbConnection } from '#root/database/databaseService';
import { CredentialType } from '#root/database/entities/CredentialType';
import { hasAdminBearerToken } from '#root/utils/adminBearerToken';

export interface CredentialConfigurationStore {
  [x: string]: CredentialConfiguration;
}

const _credentialConfigurationStore: CredentialConfigurationStore = {};
export const getCredentialConfigurationStore = (): CredentialConfigurationStore => _credentialConfigurationStore;

async function readFromDB()
{
  try {
    const dbConnection = await getDbConnection();
    const credRepo = dbConnection.getRepository(CredentialType);
    const credTypes = await credRepo.createQueryBuilder('credential_type').getMany();
    for (const credType of credTypes) {
      _credentialConfigurationStore[credType.name] = JSON.parse(credType.configuration);
    }
  }
  catch (e) {
    console.error("Caught error on initialising credentials", e);
  }
}

async function clearDB()
{
  const dbConnection = await getDbConnection();
  const credRepo = dbConnection.getRepository(CredentialType);
  await credRepo.clear();
}


async function readFromFile()
{
  try {
    const dbConnection = await getDbConnection();
    const credRepo = dbConnection.getRepository(CredentialType);

    debug('Loading credential configurations, path: ' + CREDENTIAL_CONFIGURATION_PATH);
    try {
      const configurations = loadJsonFiles<CredentialConfiguration>({ path: CREDENTIAL_CONFIGURATION_PATH }).asObject;
      for (const configId of Object.keys(configurations)) {
        if (!_credentialConfigurationStore[configId]) {
          debug("adding file base credential configuration to store");
          _credentialConfigurationStore[configId] = configurations[configId];

          const credType = new CredentialType();
          credType.name = configId;
          credType.configuration = JSON.stringify(configurations[configId]);
          await credRepo.save(credType);
        }
      }
    }
    catch (e) {
      debug("Missing credentials configuration path", e);
    }
  }
  catch (e) {
    console.error("Caught error on initialising credentials", e);
  }
}

export async function initialiseCredentialConfigurationStore() {
  if (hasAdminBearerToken()) {
    await readFromDB();
  }
  else {
    await clearDB();
  }
  await readFromFile();
  debug('end of credential configuration store initialisation');
}
