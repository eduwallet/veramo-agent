/*
 * Instantiate Issuers, connect them to configured keys and metadata and store this
 * data in the in-memory Veramo data store
 */

import { METADATA_PATH, ISSUER_PATH } from "environment";
import { loadJsonFiles } from "utils/generic";
import { IEWIssuerOptsImportArgs, MetadataStorage } from "types";
import { Issuer } from "./Issuer";
import { Metadata } from "types/specification";
import { IssuerConfiguration } from "types/internal";

export interface IssuerStore {
    [x:string]:Issuer;
}

var _issuerStore:IssuerStore = {};
export const getIssuerStore = ():IssuerStore => _issuerStore;

export async function initialiseIssuerStore() {
    console.log('initialising issuer store, reading json files');
    const issuerOptionsObjects = loadJsonFiles<IssuerConfiguration>({path: ISSUER_PATH});
    const metadatas = loadJsonFiles<Metadata>({path: METADATA_PATH});

    console.log('looping of ', issuerOptionsObjects.asArray.length,' objects');
    for(const correlationId of Object.keys(issuerOptionsObjects.asObject)) {
        console.log('creating new issuer');
        const metadata = metadatas.asObject[correlationId];
        if (!metadata) {
            throw new Error("Unable to find matching metadata for " + correlationId);
        }
        const issuer = new Issuer(issuerOptionsObjects.asObject[correlationId], metadata);
        await issuer.setDid(); // do some asynchronous post-initialisation
        console.log('setting issuer on store');
        _issuerStore[correlationId] = issuer;
    };
    console.log('end of issuer store initialisation');
}
