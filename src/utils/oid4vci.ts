import { oid4vciInstanceOpts } from "../environment";
import {createDidResolver, getDefaultDID, getDefaultKid, getIdentifier } from "../utils";
import {IIssuerDefaultOpts } from "@sphereon/ssi-sdk.oid4vci-issuer";
import {Resolvable} from "did-resolver";
import {
    IIssuerInstanceOptions,
    IIssuerOptions,
    IIssuerOptsPersistArgs
} from "@sphereon/ssi-sdk.oid4vci-issuer-store";
import {IIssuerOptsImportArgs} from "@sphereon/ssi-sdk.oid4vci-issuer-store/src/types/IOID4VCIStore";


export function toImportIssuerOptions(args?: { oid4vciInstanceOpts: IIssuerOptsImportArgs[] }): IIssuerOptsImportArgs[] {
    return args?.oid4vciInstanceOpts ?? oid4vciInstanceOpts.asArray
}


export async function getDefaultOID4VCIIssuerOptions(args?: { did?: string, resolver?: Resolvable }): Promise<IIssuerDefaultOpts | undefined> {
    const did = args?.did ?? await getDefaultDID()
    if (!did) {
        return
    }
    const identifier = await getIdentifier(did)
    if (!identifier) {
        return
    }
    return {
        userPinRequired: process.env.OID4VCI_DEFAULTS_USER_PIN_REQUIRED?.toLowerCase() !== 'false' ?? false,
        didOpts: {
            resolveOpts: {
                resolver: args?.resolver ?? createDidResolver()
            },
            identifierOpts: {
                identifier,
                kid: await getDefaultKid({did})
            }
        }
    }
}

export async function addDefaultsToOpts(issuerOpts: IIssuerOptions) {
    const defaultOpts = await getDefaultOID4VCIIssuerOptions({resolver: issuerOpts?.didOpts?.resolveOpts?.resolver})
    let identifierOpts = issuerOpts?.didOpts?.identifierOpts ?? defaultOpts?.didOpts.identifierOpts
    let resolveOpts = issuerOpts.didOpts.resolveOpts ?? defaultOpts?.didOpts.resolveOpts
    if (!issuerOpts.didOpts) {
        issuerOpts.didOpts = {
            identifierOpts,
            resolveOpts
        }
    }
    if (!issuerOpts.didOpts.identifierOpts) {
        issuerOpts.didOpts.identifierOpts = identifierOpts
    }
    if (!issuerOpts.didOpts.resolveOpts) {
        issuerOpts.didOpts.resolveOpts = resolveOpts
    }
    return issuerOpts;
}

export async function issuerPersistToInstanceOpts(opt: IIssuerOptsPersistArgs): Promise<IIssuerInstanceOptions> {
    const issuerOpts = await addDefaultsToOpts(opt.issuerOpts);
    return {
        credentialIssuer: opt.correlationId,
        issuerOpts,
        storeId: opt.storeId,
        storeNamespace: opt.namespace
    }
}

