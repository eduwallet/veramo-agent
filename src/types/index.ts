import {IDIDManagerCreateArgs, IIdentifier} from "@veramo/core";
import { CredentialSupplierConfig, IssuerMetadataV1_0_13} from "@sphereon/oid4vci-common"

export interface StringKeyedObject {
    [key:string]: any;
}

export enum KMS {
    LOCAL = 'local',
}
export enum DIDMethods {
    DID_ETHR = 'ethr',
    DID_KEY = 'key',
    // DID_LTO = 'lto',
    DID_ION = 'ion',
    // DID_FACTOM = 'factom',
    DID_JWK = 'jwk',
    DID_WEB = 'web'
}

export interface IDIDOpts {
    did?: string
    alias?: string;
    did_vm?: string
    createArgs?: IDIDManagerCreateArgs
    importArgs?: IImportX509DIDArg
    privateKeyHex?: string
}

export interface IDIDResult extends IDIDOpts {
    identifier?: IIdentifier
}

export interface IImportX509DIDArg {
    domain: string
    privateKeyPEM: string
    certificatePEM: string
    certificateChainPEM: string
    certificateChainURL?: string
    kms?: string // The Key Management System to use. Will default to 'local' when not supplied.
    kid?: string // The requested KID. A default will be generated when not supplied
}

export interface CredentialSupplierConfigWithTemplateSupport extends CredentialSupplierConfig {
    templates_base_dir?: string
    template_mappings?: TemplateMapping[]
}

interface TemplateMapping {
    credential_types: string[]
    template_path: string
    format?: string
}


  
interface IIdentifierOpts {
    identifier?: string
    alias?: string;
}

interface IDIDOptions {
    identifierOpts: IIdentifierOpts
}

interface IIssuerOptions {
    didOpts: IDIDOptions
}
