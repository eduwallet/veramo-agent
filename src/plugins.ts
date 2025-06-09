import Debug from 'debug';
const debug = Debug('issuer:plugins');

import { IAgentPlugin, ICredentialIssuer, ICredentialVerifier, IDataStoreORM, IDIDManager, IKeyManager, IResolver } from '@veramo/core'
import { DataStoreORM, DIDStore, KeyStore, PrivateKeyStore } from './packages/datastore'
import { DIDManager } from '@veramo/did-manager'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { CredentialPlugin } from '@veramo/credential-w3c'
import { KeyManager } from './packages/keymanager/key-manager';
import { KeyManagementSystem } from './packages/kms/key-management-system';

import { CredentialHandlerLDLocal, LdDefaultContexts, MethodNames, SphereonEd25519Signature2018,
    SphereonEd25519Signature2020, SphereonJsonWebSignature2020 } from '@sphereon/ssi-sdk.vc-handler-ld-local'

import { DIDMethods } from './types';
import { getDbConnection } from './database/databaseService'
import { createDidProviders } from "./utils/did.js";
import { resolver } from './resolver';
import { getContextConfigurationStore } from 'contexts/Store'

export async function setupPlugins(): Promise<IAgentPlugin[]>
{
    const dbConnection = await getDbConnection();
    const privateKeyStore: PrivateKeyStore = new PrivateKeyStore(dbConnection);
    const contextStore = getContextConfigurationStore();
    var defaultContexts = new Map(LdDefaultContexts);
    for (const key of Object.keys(contextStore)) {
        defaultContexts.set(contextStore[key].fullPath!, contextStore[key]['document']);
    }

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
        new CredentialPlugin(), // Veramo
        new CredentialHandlerLDLocal({
            contextMaps: [defaultContexts],
            suites: [
                new SphereonEd25519Signature2018(),
                new SphereonEd25519Signature2020(),
    //            new SphereonBbsBlsSignature2020(),
                new SphereonJsonWebSignature2020(),
            ],
            bindingOverrides: new Map([
                ['createVerifiableCredentialLD', MethodNames.createVerifiableCredentialLDLocal],
                ['createVerifiablePresentationLD', MethodNames.createVerifiablePresentationLDLocal],
            ]),
            keyStore: privateKeyStore,
        }), // Sphereon
    ];
}

export type TAgentTypes = IDIDManager &
    IResolver &
    IKeyManager &
    IDataStoreORM &
    ICredentialVerifier &
    ICredentialIssuer;
