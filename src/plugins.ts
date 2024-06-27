import { IAgentPlugin, ICredentialIssuer, ICredentialVerifier, IDataStore, IDataStoreORM, IDIDManager, IKeyManager, IResolver} from '@veramo/core'
import  {DataStore, DataStoreORM, DIDStore, KeyStore, PrivateKeyStore} from '@veramo/data-store'
import {SecretBox} from '@veramo/kms-local'
import {DIDManager} from '@veramo/did-manager'
import {DIDResolverPlugin} from '@veramo/did-resolver'
import {CredentialPlugin} from '@veramo/credential-w3c'

import {ISIOPv2RP} from '@sphereon/ssi-sdk.siopv2-oid4vp-rp-auth'
import {SphereonKeyManager} from '@sphereon/ssi-sdk-ext.key-manager'
import {SphereonKeyManagementSystem} from '@sphereon/ssi-sdk-ext.kms-local'
import {IPresentationExchange, PresentationExchange} from '@sphereon/ssi-sdk.presentation-exchange'
import {PDStore} from '@sphereon/ssi-sdk.data-store'
import { CredentialHandlerLDLocal, LdDefaultContexts, MethodNames, SphereonEd25519Signature2018, SphereonEd25519Signature2020, SphereonJsonWebSignature2020 } 
    from '@sphereon/ssi-sdk.vc-handler-ld-local'
import {IPDManager, PDManager} from '@sphereon/ssi-sdk.pd-manager'
import {IOID4VCIStore, OID4VCIStore} from "@sphereon/ssi-sdk.oid4vci-issuer-store";
import {IOID4VCIIssuer} from "@sphereon/ssi-sdk.oid4vci-issuer";

import { DB_ENCRYPTION_KEY, DB_CONNECTION_NAME, DID_PREFIX, IS_OID4VCI_ENABLED, IS_OID4VP_ENABLED } from "./environment";
import { DIDMethods } from './types';
import { getDbConnection } from './database'
import { createDidProviders, createDidResolver, createOID4VPRP } from "./utils";
import { createOID4VCIIssuer, createOID4VCIStore } from "./utils/oid4vci";

const dbConnection = getDbConnection(DB_CONNECTION_NAME)
const pdStore = new PDStore(dbConnection);
const privateKeyStore: PrivateKeyStore = new PrivateKeyStore(dbConnection)
export const resolver = createDidResolver()

export const plugins: IAgentPlugin[] = [
    new DataStore(dbConnection),
    new DataStoreORM(dbConnection),
    new SphereonKeyManager({
        store: new KeyStore(dbConnection),
        kms: {
            local: new SphereonKeyManagementSystem(privateKeyStore),
        },
    }),
    new DIDManager({
        store: new DIDStore(dbConnection),
        defaultProvider: `${DID_PREFIX}:${DIDMethods.DID_JWK}`,
        providers: createDidProviders(),
    }),
    new DIDResolverPlugin({
        resolver,
    }),
    new PresentationExchange({pdStore}),
    new CredentialPlugin(),
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
    }),
    new PDManager({store: pdStore})
]

export const oid4vpRP = IS_OID4VP_ENABLED ? await createOID4VPRP({resolver, pdStore}) : undefined;
if (oid4vpRP) {
    plugins.push(oid4vpRP)
}

export const oid4vciStore: OID4VCIStore | undefined = IS_OID4VCI_ENABLED ? await createOID4VCIStore() : undefined
if (oid4vciStore) {
    plugins.push(oid4vciStore)

    const oid4vciIssuer = await createOID4VCIIssuer({resolver});
    if (oid4vciIssuer) {
        plugins.push(oid4vciIssuer)
    }
}

export type TAgentTypes = ISIOPv2RP &
    IPresentationExchange &
    IOID4VCIStore &
    IOID4VCIIssuer &
    IDIDManager &
    IResolver &
    IKeyManager &
    IDataStore &
    IDataStoreORM &
    ICredentialVerifier &
    ICredentialIssuer &
    IPDManager;
