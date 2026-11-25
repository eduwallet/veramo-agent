import { getDbConnection } from "#root/database/databaseService";
import { Identifier, Key } from "#root/database/entities/index";
import { Issuer } from "#root/issuer/Issuer";
import { CredentialConfiguration } from "#root/types/specification/metadata";
import { ContextConfiguration } from "#root/contexts/Store";
import { VctConfiguration } from "#root/vct/Store";
import moment from "moment";

export interface DataList {
    offset: number;
    count: number;
    pagesize: number;
    data: any[];
}

export interface KeyScheme
{
    kid:string;
    type: string;
    publicKey: string;
    isController: boolean;
}

export interface IdentifierScheme
{
    did: string;
    provider: string;
    alias: string;
    path?:string;
    services?:string;
    saved: string;
    updated:string;
    keys:KeyScheme[];
}

export async function identifierToScheme(id:Identifier) {
    const retval:IdentifierScheme = {
        did: id.did,
        provider: id.provider || '',
        alias: id.alias || '',
        ...(id.path && {path: id.path}),
        ...(id.services && {services: id.services}),
        saved: moment(id.saveDate).format('YYYY-MM-DD HH:mm:ss'),
        updated: moment(id.updateDate).format('YYYY-MM-DD HH:mm:ss'),
        keys: []
    };

    const dbConnection = await getDbConnection();
    const keys = dbConnection.getRepository(Key);
    id.keys = await keys.createQueryBuilder('key').relation(Identifier, "keys").of(id).loadMany();

    for(const key of id.keys) {
        retval.keys.push({
            kid: key.kid,
            type: key.type,
            publicKey: key.publicKeyHex,
            isController: key.kid === id.controllerKeyId
        });
    }
    return retval;
}

export interface IssuerScheme {
    name: string;
    baseUrl: string;
    did: string;
    adminToken?: string;
    authorizationEndpoint?:string;
    tokenEndpoint?: string;
    embeddedAuthorizationServer?:any;
    clientSecret?:string;
    metadata?:any;
}

export function issuerToScheme(issuer:Issuer, doFull = false) {
    const options = issuer.options;
    const retval:IssuerScheme = {
        name: issuer.name,
        did: options.did,
        baseUrl: options.baseUrl,
        adminToken: options.adminToken,
        authorizationEndpoint: options.authorizationEndpoint,
        tokenEndpoint: options.tokenEndpoint,
        ...(options.embeddedAuthorizationServer && {embeddedAuthorizationServer: options.embeddedAuthorizationServer}),
        clientSecret: options.clientSecret
    };

    if (doFull) {
        retval.metadata = issuer.metadata;
    }

    return retval;
}

export interface CredentialScheme {
    name:string;
    configuration:string;
}

export function credentialToScheme(name:string, configuration:CredentialConfiguration) {
    const retval:CredentialScheme = {
        name,
        configuration: JSON.stringify(configuration)
    };
    return retval;
}

export interface ContextScheme {
    name:string;
    path:string;
    document:string;
}

export function contextToScheme(context:ContextConfiguration) {
    const retval:ContextScheme = {
        name: context.name!,
        path: context.basePath,
        document: JSON.stringify(context.source ?? context.document)
    };
    return retval;
}

export interface VCTScheme {
    name:string;
    path:string;
    credentials:string;
    document:string;
}

export function vctToScheme(name:string, vct:VctConfiguration) {
    const retval:VCTScheme = {
        name,
        path: vct.path,
        credentials: JSON.stringify(vct.credentials),
        document: JSON.stringify(vct.source ?? vct.document)
    };
    return retval;
}
