/*
 * Instantiate context configurations
 */

import { CONTEXT_CONFIGURATION_PATH } from "../environment";
import { debug } from "utils/logger";
import { loadJsonFiles } from "utils/generic";

export interface ContextConfiguration {
  path: string;
  "@context": any;
}

export interface ContextConfigurationStore {
  [x: string]: ContextConfiguration;
}

var _contextConfigurationStore: ContextConfigurationStore = {};
export const getContextConfigurationStore = (): ContextConfigurationStore => _contextConfigurationStore;

export async function initialiseContextConfigurationStore() {
  debug('Loading context configurations, path: ' + CONTEXT_CONFIGURATION_PATH);
  const configurations = loadJsonFiles<ContextConfiguration>({ path: CONTEXT_CONFIGURATION_PATH });
  _contextConfigurationStore = configurations.asObject;
  debug('end of context configuration store initialisation');
}
