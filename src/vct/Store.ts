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
    source?: any;       // the document as configured, before {{ here }} was replaced
}

export interface VctConfigurationStore {
  [x: string]: VctConfiguration;
}

const _vctConfigurationStore: VctConfigurationStore = {};
export const getVctConfigurationStore = (): VctConfigurationStore => _vctConfigurationStore;

async function readFromFile()
{
    try {
        debug('Loading vct configurations, path: ' + VCT_CONFIGURATION_PATH);
        try {
            const configurations = loadJsonFiles<VctConfiguration>({ path: VCT_CONFIGURATION_PATH }).asObject;
            for (const key of Object.keys(configurations)) {
                if (!_vctConfigurationStore[key]) {
                    const cfg = Object.assign({}, configurations[key]);
                    cfg.fullPath = getBaseUrl() + cfg.path;
                    let jsonDoc = JSON.stringify(cfg['document']);
                    jsonDoc = jsonDoc.replaceAll(/{{ ?here ?}}/gi, cfg.fullPath);
                    cfg.document = JSON.parse(jsonDoc);
                    cfg.document.vct = cfg.fullPath;
                    cfg.source = configurations[key].document;
                    _vctConfigurationStore[key] = cfg;
                }
            }
        }
        catch (e) {
            debug("Missing conf path for vcts", e);
        }
    }
    catch (e) {
        console.error("Caught exception on VCT store initialisation", e);
    }
}

export async function initialiseVctConfigurationStore() {
    await readFromFile();
    debug('end of VCT configuration store initialisation', _vctConfigurationStore);
}

export function getVctForCredentialType(credentialType:string): Vct|null
{
    for (const key in _vctConfigurationStore) {
        const cfg = _vctConfigurationStore[key];
        if (cfg.credentials.includes(credentialType)) {
            return cfg.document;
        }
    }
    return null;
}