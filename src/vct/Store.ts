import Debug from 'debug';
const debug = Debug('issuer:vct');
/*
 * Instantiate vct configurations
 */

import { VCT_CONFIGURATION_PATH } from "#root/environment";
import { loadJsonFiles } from "#root/utils/generic";
import { getBaseUrl } from "#root/utils/getBaseUrl";
import { Vct } from "#root/types/specification/vct";


export interface VctConfiguration
{
    credentials:string[];
    path: string;
    fullPath?:string;
    document: Vct;
}

export interface VctConfigurationStore {
  [x: string]: VctConfiguration;
}

var _vctConfigurationStore: VctConfigurationStore = {};
export const getVctConfigurationStore = (): VctConfigurationStore => _vctConfigurationStore;

export async function initialiseVctConfigurationStore() {
  debug('Loading vct configurations, path: ' + VCT_CONFIGURATION_PATH);
  const configurations = loadJsonFiles<VctConfiguration>({ path: VCT_CONFIGURATION_PATH });
  _vctConfigurationStore = configurations.asObject;
  for (const key in _vctConfigurationStore) {
      var cfg = _vctConfigurationStore[key];
      cfg.fullPath = getBaseUrl() + cfg.path;
      var jsonDoc = JSON.stringify(cfg['document']);
      jsonDoc = jsonDoc.replaceAll(/{{ ?here ?}}/gi, cfg.fullPath);
      cfg['document'] = JSON.parse(jsonDoc);
      cfg.document.vct = cfg.fullPath;
      _vctConfigurationStore[key] = cfg;
  }
  debug('end of context configuration store initialisation', _vctConfigurationStore);
}

export function getVctForCredentialType(credentialType:string): Vct|null
{
    for (const key in _vctConfigurationStore) {
        var cfg = _vctConfigurationStore[key];
        if (cfg.credentials.includes(credentialType)) {
            return cfg.document;
        }
    }
    return null;
}