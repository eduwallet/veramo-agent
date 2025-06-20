import Debug from 'debug';
const debug = Debug('issuer:did');
/*
 * Instantiate context configurations
 */

import { DID_OPTIONS_PATH } from "../environment";
import { loadJsonFiles } from "../utils/generic";
import { Identifier, Key, PrivateKey } from "#root/packages/datastore/index";
import { CryptoKey, Factory } from '@muisit/cryptokey';
import fs from 'fs';
import { getDbConnection } from 'database/databaseService.js';

export interface DIDConfiguration {
    did?: string
    alias?: string;
    type: string;
    provider: string;
    identifier: Identifier;
    key:CryptoKey;
}

interface DIDConfigurations {
  [x:string]: DIDConfiguration;
}

class DIDConfigurationStore {
    private configuration:DIDConfigurations = {};

    public async init()
    {
        try {
            debug('Loading DID configurations, path: ' + DID_OPTIONS_PATH);
            const configurations = loadJsonFiles<DIDConfiguration>({ path: DID_OPTIONS_PATH });
            for (const key of Object.keys(configurations.asObject)) {
                var cfg = configurations.asObject[key];
                await this.add(key, cfg);
            }
        }
        catch (e) {
            console.error(e);
        }
    }

    public async add(key:string, configuration:DIDConfiguration)
    {
        const dbConnection = await getDbConnection();
        const ids = dbConnection.getRepository(Identifier);
        configuration.identifier = await ids.createQueryBuilder('identifier')
            .innerJoinAndSelect("identifier.keys", "key")
            .where('identifier.did=:did', {did: configuration.did})
            .orWhere('identifier.alias=:alias', {alias: configuration.alias})
            .getOne();
        
        if (!configuration.identifier) {
            configuration = await this.initialiseKey(configuration);
        }
        else {
            const dbKey = configuration.identifier.keys[0];
            const pkeys = dbConnection.getRepository(PrivateKey);
            const pkey = await pkeys.findOneBy({alias:dbKey.kid});
            configuration.key = await Factory.createFromType(dbKey.type, pkey?.privateKeyHex);
        }

        this.configuration[key] = configuration;
    }

    private async initialiseKey(configuration:DIDConfiguration): Promise<DIDConfiguration>
    {
        configuration.key = await Factory.createFromType(configuration.type);
        await configuration.key.createPrivateKey();
        configuration.identifier = new Identifier();
        switch (configuration.provider) {
            case 'did:web':
                if (!configuration.did || configuration.did.length == 0) {
                    throw new Error("No did specified for did:web key");
                }
                configuration.identifier.did = configuration.did;
                break;
            case 'did:key':
                configuration.identifier.did = await Factory.toDIDKey(configuration.key);
                break;
            default: // DIIPv4 uses did:jwk by default
            case 'did:jwk':
                configuration.identifier.did = await Factory.toDIDJWK(configuration.key);
                break;
        }
        configuration.identifier.alias = configuration.alias ?? configuration.identifier.did;
        configuration.identifier.provider = configuration.provider ?? 'did:jwk';
        configuration.identifier.controllerKeyId = configuration.identifier.did;

        const dbConnection = await getDbConnection();
        const irepo = dbConnection.getRepository(Identifier);
        await irepo.save(configuration.identifier);

        const dbKey = new Key();
        dbKey.kid = configuration.key.exportPublicKey();
        dbKey.kms = 'local';
        dbKey.type = configuration.type;
        dbKey.publicKeyHex = dbKey.kid;
        dbKey.identifier = configuration.identifier.did;
        const krepo = dbConnection.getRepository(Key);
        await krepo.save(dbKey);

        const pKey = new PrivateKey();
        pKey.alias = dbKey.kid;
        pKey.type = dbKey.type;
        pKey.privateKeyHex = configuration.key.exportPrivateKey();
        const prepo = dbConnection.getRepository(PrivateKey);
        await prepo.save(pKey);

        return configuration;
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

var _didConfigurationStore: DIDConfigurationStore = new DIDConfigurationStore();
export const getDIDConfigurationStore = (): DIDConfigurationStore => _didConfigurationStore;
