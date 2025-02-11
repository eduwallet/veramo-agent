import { debug } from "utils/logger";
import {Resolver} from "did-resolver";
import {getDidIonResolver, IonDIDProvider} from "@veramo/did-provider-ion";
import {KeyDIDProvider} from "@veramo/did-provider-key";
import {getDidJwkResolver} from "@sphereon/ssi-sdk-ext.did-resolver-jwk";
import {WebDIDProvider} from "@sphereon/ssi-sdk-ext.did-provider-web";
import {JwkDIDProvider} from "@sphereon/ssi-sdk-ext.did-provider-jwk";
import { getAgent } from "agent";
import {DIDDocumentSection, IIdentifier} from "@veramo/core";
import {didOptConfigs} from "environment";
import { IDIDResult, KMS, DIDMethods } from 'types';
import {mapIdentifierKeysToDocWithJwkSupport} from "@sphereon/ssi-sdk-ext.did-utils";
import {generatePrivateKeyHex, TKeyType, toJwk} from "@sphereon/ssi-sdk-ext.key-utils";
import { getDidKeyResolver } from "./didKeyResolver";
import { getDidWebResolver } from './didWebResolver';

export function createDidResolver() {
    return new Resolver({
        ...getDidJwkResolver(),
        ...getDidKeyResolver(),
        ...getDidIonResolver(),
        ...getDidWebResolver()
    })
}

export function createDidProviders() {
    return {
        [`did:${DIDMethods.DID_ION}`]: new IonDIDProvider({
            defaultKms: KMS.LOCAL,
        }),
        [`did:${DIDMethods.DID_WEB}`]: new WebDIDProvider({
            defaultKms: KMS.LOCAL,
        }),
        [`did:${DIDMethods.DID_JWK}`]: new JwkDIDProvider({
            defaultKms: KMS.LOCAL
        }),
        [`did:${DIDMethods.DID_KEY}`]: new KeyDIDProvider({
            defaultKms: KMS.LOCAL
        })
    }
}

export async function getIdentifier(did: string): Promise<IIdentifier | undefined> {
    return await getAgent().didManagerGet({did}).catch((e:any) => {
        console.error(e)
        return undefined
    })
}

export async function getIdentifierByAlias(alias: string): Promise<IIdentifier | undefined> {
    const tokens = alias.split(':');
    let provider = 'did:web';
    if (tokens.length > 2) {
        provider = tokens[0] + ':' + tokens[1];
        tokens.splice(0, 2);
        alias = tokens.join(':');
    }
    return await getAgent().didManagerGetByAlias({alias, provider}).catch((e:any) => {
        console.error(e)
        return undefined
    })
}

export async function getDefaultDID(): Promise<string | undefined> {
    return getAgent().didManagerFind().then((ids:any) => {
        if (!ids || ids.length === 0) {
            return
        }
        return ids[0].did
    })
}

export async function getDefaultKid({did, verificationMethodName, verificationMethodFallback}: {
    did?: string,
    verificationMethodName?: DIDDocumentSection,
    verificationMethodFallback?: boolean
}): Promise<string | undefined> {
    const targetDid = did ?? await getDefaultDID()
    if (!targetDid) {
        return undefined
    }
    const identifier = await getIdentifier(targetDid)
    if (!identifier) {
        return undefined
    }
    let keys = await mapIdentifierKeysToDocWithJwkSupport({identifier, vmRelationship: verificationMethodName ?? 'assertionMethod'}, { agent: getAgent() })
    if (keys.length === 0 && (verificationMethodFallback === undefined || verificationMethodFallback)) {
        keys = await mapIdentifierKeysToDocWithJwkSupport({identifier, vmRelationship:'verificationMethod'}, { agent: getAgent() })
    }
    if (keys.length === 0) {
        return undefined
    }
    return keys[0].kid
}


export async function getOrCreateDIDs(): Promise<IDIDResult[]> {
    const result = didOptConfigs.asArray.map(async opts => {
        debug(`DID config found for: ${opts.did}`)
        let identifier;
        if (opts.did) {
            identifier = await getIdentifier(opts.did);
        }
        if(!identifier && opts.alias) {
            identifier = await getIdentifierByAlias(opts.alias);
        }

        if (identifier) {
            console.log(`Identifier exists for DID ${opts.did}`)
            console.log(`${JSON.stringify(identifier)}`)
            identifier.keys.map(key => console.log(`kid: ${key.kid}:\r\n ` + JSON.stringify(toJwk(key.publicKeyHex, key.type), null, 2)))
        } else {
            console.log(`No identifier for DID ${opts.did} exists yet. Will create the DID...`)

            let args = opts.createArgs
            if (!args) {
                args = {options: {}}
            }
            if (opts.alias) {
                args.alias = opts.alias;
            }

            // @ts-ignore
            const privateKeyHex = generatePrivateKeyHex((args.options?.type ?? args.options.keyType ?? "Secp256k1") as TKeyType)
            if (args.options && !('key' in args.options)) {
                // @ts-ignore
                args.options['key'] = {privateKeyHex}
                // @ts-ignore
            } else if (args.options && 'key' in args.options && args.options.key && typeof args.options?.key === 'object' && !('privateKeyHex' in args.options.key)) {
                // @ts-ignore
                args.options.key['privateKeyHex'] = privateKeyHex
            }

            identifier = await getAgent().didManagerCreate(args)
            identifier!.keys.map(key => console.log(`kid: ${key.kid}:\r\n ` + JSON.stringify(toJwk(key.publicKeyHex, key.type), null, 2)))

            console.log(`Identifier created for DID ${identifier.did}`)
            console.log(`${JSON.stringify(identifier, null, 2)}`)
        }

        return {...opts, did: identifier.did, identifier} as IDIDResult
    });
    return Promise.all(result)
}
