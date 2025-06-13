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
      },
      'https://w3id.org/security/v1': {
        fullPath: 'https://w3id.org/security/v1',
        basePath: "./src/contexts/defaults/w3id.org:security:v1",
        document: null
      },
      'https://w3id.org/security/v2': {
        fullPath: 'https://w3id.org/security/v2',
        basePath: "./src/contexts/defaults/w3id.org:security:v2",
        document: null
      },
      'https://w3id.org/security/suites/jws-2020/v1': {
        fullPath: "https://w3id.org/security/suites/jws-2020/v1",
        basePath: "./src/contexts/defaults/w3id.org:security:suites:jws-2020:v1",
        document: null
      }
    };

    public init()
    {
        try {
            debug('Loading context configurations, path: ' + CONTEXT_CONFIGURATION_PATH);
            const configurations = loadJsonFiles<ContextConfiguration>({ path: CONTEXT_CONFIGURATION_PATH });
            for (const key of Object.keys(configurations.asObject)) {
                var cfg = configurations.asObject[key];
                cfg.fullPath = getBaseUrl() + cfg.basePath;
                debug("context full path is ", cfg.fullPath);
                this.add(cfg.fullPath, cfg.document, cfg.basePath);
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    public add(url:string, doc:any, bp?:string)
    {
        if (doc) {
            let jsonDoc = JSON.stringify(doc);
            jsonDoc = jsonDoc.replaceAll(/{{ ?here ?}}/gi, url);
            doc = JSON.parse(jsonDoc);
        }
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

                const obj = JSON.parse(json);
                if (obj && Object.keys(obj).length > 0) {
                    return obj;
                }
            }
        }
        return null;
    }

    public keys() {
        return Object.keys(this.configuration);
    }

    public get(key:string) {
        if (this.configuration[key]) {
            return this.configuration[key];
        }
        return null;
    }
}

var _contextConfigurationStore: ContextConfigurationStore = new ContextConfigurationStore();
export const getContextConfigurationStore = (): ContextConfigurationStore => _contextConfigurationStore;
