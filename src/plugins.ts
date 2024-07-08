import Debug from 'debug'
const debug = Debug(`eduwallet:plugin`)

import { IAgentPlugin, ICredentialIssuer, ICredentialVerifier, IDataStore, IDataStoreORM, IDIDManager, IKeyManager, IResolver} from '@veramo/core'
import  {DataStore, DataStoreORM, DIDStore, KeyStore, PrivateKeyStore} from '@veramo/data-store'
//import {SecretBox} from '@veramo/kms-local'
import {DIDManager} from '@veramo/did-manager'
import {DIDResolverPlugin} from '@veramo/did-resolver'
import {CredentialPlugin} from '@veramo/credential-w3c'

import {SphereonKeyManager} from '@sphereon/ssi-sdk-ext.key-manager'
import {SphereonKeyManagementSystem} from '@sphereon/ssi-sdk-ext.kms-local'
import { CredentialHandlerLDLocal, LdDefaultContexts, MethodNames, SphereonEd25519Signature2018, SphereonEd25519Signature2020, SphereonJsonWebSignature2020 } 
    from '@sphereon/ssi-sdk.vc-handler-ld-local'
import {IOID4VCIStore, OID4VCIStore, IIssuerOptsImportArgs} from "@sphereon/ssi-sdk.oid4vci-issuer-store";
import {IOID4VCIIssuer, OID4VCIIssuer} from "@sphereon/ssi-sdk.oid4vci-issuer";

import { oid4vciMetadataOpts, OID4VCI_ISSUER_OPTIONS_PATH } from "./environment";
import { DIDMethods, IEWIssuerOptsImportArgs } from './types';
import { getDbConnection } from './database'
import { createDidProviders, createDidResolver, loadJsonFiles } from "./utils";

const dbConnection = getDbConnection()
const privateKeyStore: PrivateKeyStore = new PrivateKeyStore(dbConnection)
export const resolver = createDidResolver()

debug("importing options for all issuers");
const issuerOptionsObjects = loadJsonFiles<IEWIssuerOptsImportArgs>({path: OID4VCI_ISSUER_OPTIONS_PATH})
export const importIssuerOpts = issuerOptionsObjects.asArray;
const defaultIssuerOptions = {userPinRequired: false, didOpts: {resolveOpts: {resolver}, identifierOpts: {identifier:'none'}}};

debug("creating list of plugins");
export const plugins: IAgentPlugin[] = [
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
        contextMaps: [LdDefaultContexts],
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
    new OID4VCIStore({
        defaultOpts: defaultIssuerOptions, 
        defaultNamespace: 'eduwallet',
        importIssuerOpts: importIssuerOpts.map((e) => e.options),
        importMetadatas: oid4vciMetadataOpts.asArray}
    ), // Sphereon
    new OID4VCIIssuer({returnSessions: true, resolveOpts: {resolver}}), // Sphereon
];

export type TAgentTypes = IOID4VCIStore &
    IOID4VCIIssuer &
    IDIDManager &
    IResolver &
    IKeyManager &
    IDataStore &
    IDataStoreORM &
    ICredentialVerifier &
    ICredentialIssuer;
