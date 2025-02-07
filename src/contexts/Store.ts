/*
 * Instantiate context configurations
 */

import { CONTEXT_CONFIGURATION_PATH } from "../environment";
import { debug } from "utils/logger";
import { loadJsonFiles } from "utils/generic";
import { getBaseUrl } from "utils/getBaseUrl";

export interface ContextConfiguration {
  basePath: string;
  fullPath?: string;
  document: any;
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
  for (const key in _contextConfigurationStore) {
      var cfg = _contextConfigurationStore[key];
      cfg.fullPath = getBaseUrl() + cfg.basePath;
      var jsonDoc = JSON.stringify(cfg['document']);
      jsonDoc = jsonDoc.replaceAll(/{{ ?here ?}}/gi, cfg.fullPath);
      cfg['document'] = JSON.parse(jsonDoc);
      _contextConfigurationStore[key] = cfg;
  }
  debug('end of context configuration store initialisation', _contextConfigurationStore);
}
