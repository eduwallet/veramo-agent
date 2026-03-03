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
import { getDbConnection } from '#root/database/databaseService';
import { Issuer as IssuerEntity } from '#root/database/entities/index';
import { hasAdminBearerToken } from '#root/utils/adminBearerToken';

export interface IssuerStore {
    [x:string]:Issuer;
}

var _issuerStore:IssuerStore = {};
export const getIssuerStore = ():IssuerStore => _issuerStore;

async function readFromDB()
{
    try {
        debug('initialising issuer store, reading database');
        const dbConnection = await getDbConnection();
        const issuerRepo = dbConnection.getRepository(IssuerEntity);
        const issuers = await issuerRepo.createQueryBuilder('issuer').getMany();
        for (const issuer of issuers) {
            const entry = new Issuer({
                name: issuer.name,
                baseUrl: issuer.baseUrl,
                clientId: issuer.clientId,
                clientSecret: issuer.clientSecret,
                adminToken: issuer.adminToken,
                authorizationEndpoint: issuer.authorizationEndpoint,
                tokenEndpoint: issuer.tokenEndpoint,
                statusLists: JSON.parse(issuer.statuslists ?? '{}'),
                did: issuer.did,
            }, JSON.parse(issuer.metadata ?? '{}'));

            // we store the entry, then initialise. If there is an error on
            // initialisation, do not read the file config to override this
            // (which may/would/will cause double entries)
            _issuerStore[issuer.name] = entry;
            try {
                await entry.setDid(); // do some asynchronous post-initialisation
                await entry.retrieveASServerKeys(); // retrieve the AS server keys

            }
            catch (e) {
                console.error("Caught error initialising issuer, skipping entry", e);
            }
        }
    }
    catch (e) {
        console.error("Caught error initialising issuer store", e);
    }
}

async function clearDB()
{
    try {
        debug('initialising issuer store, reading database');
        const dbConnection = await getDbConnection();
        const issuerRepo = dbConnection.getRepository(IssuerEntity);
        await issuerRepo.clear();
    }
    catch (e) {
        console.error("Caught error initialising issuer store", e);
    }
}

async function readFromFile()
{
    try {
        debug('initialising issuer store, reading json files');
        const dbConnection = await getDbConnection();
        const issuerRepo = dbConnection.getRepository(IssuerEntity);

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
                    try {
                        await issuer.setDid(); // do some asynchronous post-initialisation
                        await issuer.retrieveASServerKeys(); // retrieve the AS server keys
                        debug('setting issuer on store');
                        _issuerStore[correlationId] = issuer;
                    }
                    catch (e) {
                        console.error('Caught exception on initialising file based issuer config, skipping entry', e);
                    }

                    // save the entry to the database as well
                    const dbIssuer = new IssuerEntity();
                    dbIssuer.name = correlationId;
                    dbIssuer.adminToken = config.adminToken || '';
                    dbIssuer.did = config.did;
                    dbIssuer.baseUrl = config.baseUrl;
                    dbIssuer.authorizationEndpoint = config.authorizationEndpoint;
                    dbIssuer.tokenEndpoint = config.tokenEndpoint;
                    dbIssuer.clientId = config.clientId;
                    dbIssuer.clientSecret = config.clientSecret;
                    dbIssuer.metadata = JSON.stringify(metadata);
                    dbIssuer.statuslists = JSON.stringify(config.statusLists);
                    await issuerRepo.save(dbIssuer);
                }
            }
        }
        catch (e) {
            debug("Missing issuer configuration path", e);
        }
    }
    catch (e) {
        console.error("Caught error initialising issuer store", e);
    }
}

export async function initialiseIssuerStore() {
    if (hasAdminBearerToken()) {
        await readFromDB();
    }
    else {
        await clearDB();
    }
    await readFromFile();
    debug('end of issuer store initialisation');
}
