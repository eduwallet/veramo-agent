import Debug from 'debug'
const debug = Debug(`eduwallet:plugin`)

import { IAgentPlugin, ICredentialIssuer, ICredentialVerifier, IDataStore, IDataStoreORM, IDIDManager, IKeyManager, IResolver } from '@veramo/core'
import { DataStore, DataStoreORM, DIDStore, KeyStore, PrivateKeyStore } from '@veramo/data-store'
//import {SecretBox} from '@veramo/kms-local'
import { DIDManager } from '@veramo/did-manager'
import { DIDResolverPlugin } from '@veramo/did-resolver'
import { CredentialPlugin } from '@veramo/credential-w3c'

import { IOID4VCIStore } from '@sphereon/ssi-sdk.oid4vci-issuer-store';
import {SphereonKeyManager} from '@sphereon/ssi-sdk-ext.key-manager'
import {SphereonKeyManagementSystem} from '@sphereon/ssi-sdk-ext.kms-local'
import { CredentialHandlerLDLocal, LdDefaultContexts, MethodNames, SphereonEd25519Signature2018,
    SphereonEd25519Signature2020, SphereonJsonWebSignature2020 } from '@sphereon/ssi-sdk.vc-handler-ld-local'

import { DIDMethods } from './types';
import { getDbConnection } from './database'
import { createDidProviders } from "./utils/did";
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
        new DataStore(dbConnection), // Veramo
        new DataStoreORM(dbConnection), // Veramo
        new SphereonKeyManager({
            store: new KeyStore(dbConnection),
            kms: {
                local: new SphereonKeyManagementSystem(privateKeyStore),
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

export type TAgentTypes = IOID4VCIStore &
    IDIDManager &
    IResolver &
    IKeyManager &
    IDataStore &
    IDataStoreORM &
    ICredentialVerifier &
    ICredentialIssuer;
