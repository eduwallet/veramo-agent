import Debug from 'debug';
const debug = Debug('issuer:context');
/*
 * Instantiate context configurations
 */

import { CONTEXT_CONFIGURATION_PATH } from "../environment";
import { loadJsonFiles } from "utils/generic";
import { getBaseUrl } from "utils/getBaseUrl";
import fs from 'fs';

export interface ContextConfiguration {
    basePath: string;
    fullPath?: string;
    document: any;
}

interface ContextConfigurations {
  [x:string]: ContextConfiguration;
}

class ContextConfigurationStore {
    private configuration:ContextConfigurations = {
      'https://www.w3.org/ns/credentials/v2': {
          fullPath: 'https://www.w3.org/ns/credentials/v2',
          basePath: "./src/contexts/defaults/www.w3.org:ns:credentials:v2",
          document: null
      }
    };

    public init()
    {
        try {
            debug('Loading context configurations, path: ' + CONTEXT_CONFIGURATION_PATH);
            const configurations = loadJsonFiles<ContextConfiguration>({ path: CONTEXT_CONFIGURATION_PATH });
            this.configuration = configurations.asObject;
            for (const key in _contextConfigurationStore) {
                var cfg = this.configuration[key];
                cfg.fullPath = getBaseUrl() + cfg.basePath;
                this.add(cfg.fullPath, cfg.document, cfg.basePath);
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    public add(url:string, doc:any, bp?:string)
    {
        let jsonDoc = JSON.stringify(doc);
        jsonDoc = jsonDoc.replaceAll(/{{ ?here ?}}/gi, url);
        doc = JSON.parse(jsonDoc);
        this.configuration[url] = {
            basePath: bp ?? '',
            document: doc,
            fullPath: url
        };
    }

    public resolve(url:string):any
    {
        if (this.configuration[url]) {
            if (this.configuration[url].document !== null) {
                return this.configuration[url].document;
            }

            if (this.configuration[url].basePath && fs.existsSync(this.configuration[url].basePath)) {
                const json = fs.readFileSync(this.configuration[url].basePath, 'utf8').toString();
                console.error(json);
                const obj = JSON.parse(json);
                if (obj && Object.keys(obj).length > 0) {
                    return obj;
                }
            }
        }
        return null;
    }
}

var _contextConfigurationStore: ContextConfigurationStore = new ContextConfigurationStore();
export const getContextConfigurationStore = (): ContextConfigurationStore => _contextConfigurationStore;
