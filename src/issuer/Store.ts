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

export interface IssuerStore {
    [x:string]:Issuer;
}

var _issuerStore:IssuerStore = {};
export const getIssuerStore = ():IssuerStore => _issuerStore;

export async function initialiseIssuerStore() {
    debug('initialising issuer store, reading json files');
    const issuerOptionsObjects = loadJsonFiles<IssuerConfiguration>({path: ISSUER_PATH});
    const metadatas = loadJsonFiles<MetadataConfiguration>({path: METADATA_PATH});

    debug('looping of ', issuerOptionsObjects.asArray.length,' objects');
    for(const correlationId of Object.keys(issuerOptionsObjects.asObject)) {
        debug('creating new issuer');
        const metadata = metadatas.asObject[correlationId];
        if (!metadata) {
            throw new Error("Unable to find matching metadata for " + correlationId);
        }
        const issuer = new Issuer(issuerOptionsObjects.asObject[correlationId], metadata);
        await issuer.setDid(); // do some asynchronous post-initialisation
        await issuer.retrieveASServerKeys(); // retrieve the AS server keys
        debug('setting issuer on store');
        _issuerStore[correlationId] = issuer;
    };
    debug('end of issuer store initialisation');
}
