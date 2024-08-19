/*
 * Instantiate Issuers, connect them to configured keys and metadata and store this
 * data in the in-memory Veramo data store
 */

import { IMetadataImportArgs} from "@sphereon/ssi-sdk.oid4vci-issuer-store";
import { IssuerMetadataV1_0_13 } from '@sphereon/oid4vci-common';
import { OID4VCI_ISSUER_METADATA_PATH, OID4VCI_ISSUER_OPTIONS_PATH } from "../environment";
import { loadJsonFiles } from "@utils/generic";
import { IEWIssuerOptsImportArgs } from "types";
import { Issuer } from "./Issuer";

export interface IssuerStore {
    [x:string]:Issuer;
}

var _issuerStore:IssuerStore = {};
export const getIssuerStore = ():IssuerStore => _issuerStore;

export function initialiseIssuerStore() {
    const issuerOptionsObjects = loadJsonFiles<IEWIssuerOptsImportArgs>({path: OID4VCI_ISSUER_OPTIONS_PATH});
    const metadatas = loadJsonFiles<IMetadataImportArgs>({path: OID4VCI_ISSUER_METADATA_PATH});
    issuerOptionsObjects.asArray.forEach((conf) => {
        const issuer = new Issuer(conf, findMetaDataForCorrelation(conf.options.correlationId, metadatas.asArray));
        _issuerStore[conf.options.correlationId] = issuer;
    });
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
