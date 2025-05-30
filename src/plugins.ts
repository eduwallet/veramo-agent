import Debug from 'debug';
const debug = Debug('issuer:plugins');

import { IAgentPlugin, ICredentialIssuer, ICredentialVerifier, IDataStoreORM, IDIDManager, IKeyManager, IResolver } from '@veramo/core'
import { DataStoreORM, DIDStore, KeyStore, PrivateKeyStore } from './packages/datastore'
import { DIDManager } from '@veramo/did-manager'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { CredentialPlugin } from '@veramo/credential-w3c'
import { KeyManager } from './packages/keymanager/key-manager';
import { KeyManagementSystem } from './packages/kms/key-management-system';
import { DIDMethods } from './types';
import { getDbConnection } from './database/databaseService'
import { createDidProviders } from "./utils/did";
import { resolver } from './resolver';

export async function setupPlugins(): Promise<IAgentPlugin[]>
{
    const dbConnection = await getDbConnection();
    const privateKeyStore: PrivateKeyStore = new PrivateKeyStore(dbConnection);

    debug("creating list of plugins");
    return [
        new DataStoreORM(dbConnection),
        new KeyManager({
            store: new KeyStore(dbConnection),
            kms: {
                local: new KeyManagementSystem(privateKeyStore),
            },
        }),
        new DIDManager({
            store: new DIDStore(dbConnection),
            defaultProvider: `did:${DIDMethods.DID_WEB}`,
            providers: createDidProviders(),
        }), // Veramo
        new DIDResolverPlugin({
            resolver,
        }), // Veramo
        new CredentialPlugin() // Veramo
    ];
}

export type TAgentTypes = IDIDManager &
    IResolver &
    IKeyManager &
    IDataStoreORM &
    ICredentialVerifier &
    ICredentialIssuer;
