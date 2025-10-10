import Debug from 'debug';
const debug = Debug('issuer:vct');
/*
 * Instantiate vct configurations
 */

import { VCT_CONFIGURATION_PATH } from "#root/environment";
import { loadJsonFiles } from "#root/utils/generic";
import { getBaseUrl } from "#root/utils/getBaseUrl";
import { Vct } from "#root/types/specification/vct";
import { getDbConnection } from '#root/database/databaseService';
import { VCTDocument } from '#root/packages/datastore/index';


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

    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(VCTDocument);
        const objs = await repo.createQueryBuilder('vct_document').getMany();
        for (const obj of objs) {
            const fullPath = getBaseUrl() + obj.path;
            let jsonDoc = obj.document;
            jsonDoc = jsonDoc.replaceAll(/{{ ?here ?}}/gi, fullPath);
            const cfg:VctConfiguration = {
                credentials: JSON.parse(obj.credentials),
                path: obj.path,
                fullPath: fullPath,
                document: JSON.parse(jsonDoc)
            }
            cfg.document.vct = cfg.fullPath;
            _vctConfigurationStore[obj.name] = cfg;
        }


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
                    _vctConfigurationStore[key] = cfg;

                    const vctDoc = new VCTDocument();
                    vctDoc.name = key;
                    vctDoc.path = cfg.path;
                    vctDoc.document = JSON.stringify(configurations[key].document);
                    vctDoc.credentials = JSON.stringify(cfg.credentials);
                    await repo.save(vctDoc);
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
    debug('end of VCT configuration store initialisation', _vctConfigurationStore);
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