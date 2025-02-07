import {IDIDManagerCreateArgs, IIdentifier} from "@veramo/core";
import {CredentialIssuerMetadataOpts, CredentialSupplierConfig, IssuerMetadata, IssuerMetadataV1_0_13} from "@sphereon/oid4vci-common"
import { IIssuerOptsImportArgs } from '@sphereon/ssi-sdk.oid4vci-issuer-store'

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

// https://w3c.github.io/vc-bitstring-status-list/#examples
export interface StatusList {
    id: string;
    type: string;
    statusPurpose: string;
    statusListIndex: string
    statusListCredential: string;
}

interface StatusListOption {
    url: string;
    revoke: string;
    token: string;
}

interface StatusListsOption {
    [x:string]: StatusListOption;
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

interface IIssuerOptsPersistArgs {
    correlationId: string // The credential Issuer to store the metadata for
    overwriteExisting?: boolean // Whether to overwrite any existing metadata for a credential issuer. Defaults to true
    issuerOpts: IIssuerOptions
}  

export interface IEWIssuerOptsImportArgs {
    options: IIssuerOptsPersistArgs;
    baseUrl: string
    //credentialSupplier: string
    enableCreateCredentials: boolean
    clientId?:string;
    clientSecret?:string;
    adminToken?:string;
    authorizationEndpoint?:string;
    tokenEndpoint?:string;
    statusLists?:StatusListsOption;
}


export interface MetadataStorage {
    correlationId: string // The credential Issuer to store the metadata for
    overwriteExisting?: boolean // Whether to overwrite any existing metadata for a credential issuer. Defaults to true
    "@context"?: string[];
    metadata: IssuerMetadataV1_0_13;
}