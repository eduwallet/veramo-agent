import Debug from 'debug';
const debug = Debug('issuer:did');
import {Resolver} from "did-resolver";
import {KeyDIDProvider} from "../packages/did-key-provider/key-did-provider";
import {WebDIDProvider} from "../packages/did-web-provider/web-did-provider";
import {JwkDIDProvider} from "../packages/did-jwk-provider/jwk-did-provider";
import { getAgent } from "agent";
import {DIDDocumentSection, IIdentifier, IDIDManagerCreateArgs} from "@veramo/core";
import {didOptConfigs} from "environment";
import { IDIDResult, KMS, DIDMethods, IDIDOpts } from 'types';
import {mapIdentifierKeysToDocWithJwkSupport} from "@sphereon/ssi-sdk-ext.did-utils";
import { getDidJwkResolver } from "./didJwkResolver";
import { getDidKeyResolver } from "./didKeyResolver";
import { getDidWebResolver } from './didWebResolver';

export function createDidResolver() {
    return new Resolver({
        ...getDidJwkResolver(),
        ...getDidKeyResolver(),
        ...getDidWebResolver()
    })
}

export function createDidProviders() {
    return {
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
    const result = didOptConfigs.asArray.map(async (opts:IDIDOpts) => {
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
        } else {
            console.log(`No identifier for DID ${opts.did} exists yet. Will create the DID...`)

            let args:IDIDManagerCreateArgs = opts.createArgs
            if (!args) {
                args = {options: {}}
            }
            if (opts.alias) {
                args.alias = opts.alias;
                // for did:web, the alias is used to create the identifier
                if (opts.did && opts.did.startsWith('did:web:')) {
                    args.alias = opts.did.substring(8);
                }
                else if (opts.alias.startsWith('did:web:')) {
                    args.alias = opts.alias.substring(8);
                }
            }

            identifier = await getAgent().didManagerCreate(args)
            console.log(`Identifier created for DID ${identifier.did}`)
            console.log(`${JSON.stringify(identifier, null, 2)}`)
        }

        return {...opts, did: identifier.did, identifier} as IDIDResult
    });
    return Promise.all(result)
}
