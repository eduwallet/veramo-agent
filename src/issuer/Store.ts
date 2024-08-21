/*
 * Instantiate Issuers, connect them to configured keys and metadata and store this
 * data in the in-memory Veramo data store
 */

import { IMetadataImportArgs} from "@sphereon/ssi-sdk.oid4vci-issuer-store";
import { IssuerMetadataV1_0_13 } from '@sphereon/oid4vci-common';
import { METADATA_PATH, ISSUER_PATH } from "../environment";
import { loadJsonFiles } from "@utils/generic";
import { IEWIssuerOptsImportArgs } from "types";
import { Issuer } from "./Issuer";

export interface IssuerStore {
    [x:string]:Issuer;
}

var _issuerStore:IssuerStore = {};
export const getIssuerStore = ():IssuerStore => _issuerStore;

export async function initialiseIssuerStore() {
    console.log('initialising issuer store, reading json files');
    const issuerOptionsObjects = loadJsonFiles<IEWIssuerOptsImportArgs>({path: ISSUER_PATH});
    const metadatas = loadJsonFiles<IMetadataImportArgs>({path: METADATA_PATH});

    console.log('looping of ', issuerOptionsObjects.asArray.length,' objects');
    for(const conf of issuerOptionsObjects.asArray) {
        console.log('creating new issuer');
        const issuer = new Issuer(conf, findMetaDataForCorrelation(conf.options.correlationId, metadatas.asArray));
        await issuer.setDid(); // do some asynchronous post-initialisation
        console.log('setting issuer on store');
        _issuerStore[conf.options.correlationId] = issuer;
    };
    console.log('end of issuer store initialisation');
}

function findMetaDataForCorrelation(correlationId:string, metadatas: IMetadataImportArgs[]): IssuerMetadataV1_0_13
{
    for(const md of metadatas) {
        if (md.correlationId == correlationId) {
            return md.metadata as IssuerMetadataV1_0_13;
        }
    }
    throw new Error("Unable to find metadata belonging to correlation " + correlationId);
}
