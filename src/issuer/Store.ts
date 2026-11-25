import Debug from 'debug';
const debug = Debug('issuer:issuer');
/*
 * Instantiate Issuers, connect them to configured keys and metadata and store this
 * data in the in-memory data store
 */

import { METADATA_PATH, ISSUER_PATH } from "environment.js";
import { loadJsonFiles } from "utils/generic.js";
import { Issuer } from "./Issuer.js";
import { IssuerConfiguration } from "types/internal.js";
import { MetadataConfiguration } from "types/api/metadata.js";
import { DeferredConfigurationError } from './lib/deferredConfiguration.js';

export interface IssuerStore {
    [x:string]:Issuer;
}

const _issuerStore:IssuerStore = {};
export const getIssuerStore = ():IssuerStore => _issuerStore;

async function readFromFile()
{
    try {
        debug('initialising issuer store, reading json files');
        try {
            const issuerOptionsObjects = loadJsonFiles<IssuerConfiguration>({path: ISSUER_PATH});
            const metadatas = loadJsonFiles<MetadataConfiguration>({path: METADATA_PATH});

            debug('looping of ', issuerOptionsObjects.asArray.length,' objects');
            for(const correlationId of Object.keys(issuerOptionsObjects.asObject)) {
                debug('creating new issuer');
                if (!_issuerStore[correlationId]) {
                    const metadata = metadatas.asObject[correlationId];
                    if (!metadata) {
                        throw new Error("Unable to find matching metadata for " + correlationId);
                    }
                    const config = issuerOptionsObjects.asObject[correlationId];
                    const issuer = new Issuer(config, metadata);
                    // an incorrect deferred configuration is fatal: do not start with it
                    issuer.validateConfiguration();
                    try {
                        await issuer.setDid(); // do some asynchronous post-initialisation
                        await issuer.retrieveASServerKeys(); // retrieve the AS server keys
                        debug('setting issuer on store');
                        _issuerStore[correlationId] = issuer;
                    }
                    catch (e) {
                        console.error('Caught exception on initialising file based issuer config, skipping entry', e);
                    }
                }
            }
        }
        catch (e) {
            if (e instanceof DeferredConfigurationError) {
                throw e;
            }
            debug("Missing issuer configuration path", e);
        }
    }
    catch (e) {
        if (e instanceof DeferredConfigurationError) {
            throw e;
        }
        console.error("Caught error initialising issuer store", e);
    }
}

export async function initialiseIssuerStore() {
    await readFromFile();
    debug('end of issuer store initialisation');
}
