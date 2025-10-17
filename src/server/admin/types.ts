import { getDbConnection } from "#root/database/databaseService";
import { ContextDocument, CredentialType, Identifier, Issuer, Key, VCTDocument } from "#root/packages/datastore/index";
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
    id?: number;
    name: string;
    baseUrl: string;
    did: string;
    adminToken: string;
    authorizationEndpoint?:string;
    tokenEndpoint?: string;
    clientId?:string;
    metadata?:any;
    statusLists?:any;
    saved: string;
    updated:string;
}

export async function issuerToScheme(issuer:Issuer, doFull = false) {
    const retval:IssuerScheme = {
        id: issuer.id,
        name: issuer.name,
        did: issuer.did,
        baseUrl: issuer.baseUrl,
        adminToken: issuer.adminToken,
        authorizationEndpoint: issuer.authorizationEndpoint,
        tokenEndpoint: issuer.tokenEndpoint,
        clientId: issuer.clientId,
        saved: moment(issuer.saveDate).format('YYYY-MM-DD HH:mm:ss'),
        updated: moment(issuer.updateDate).format('YYYY-MM-DD HH:mm:ss')
    };

    if (doFull) {
        retval.metadata = JSON.parse(issuer.metadata ?? '{}');
        retval.statusLists = JSON.parse(issuer.statuslists ?? '{}');
    }

    return retval;
}

export interface CredentialScheme {
    id: number;
    name:string;
    configuration:string;
    saved: string;
    updated:string;
}

export async function credentialToScheme(credential:CredentialType) {
    const retval:CredentialScheme = {
        id: credential.id,
        name: credential.name,
        configuration: credential.configuration,
        saved: moment(credential.saveDate).format('YYYY-MM-DD HH:mm:ss'),
        updated: moment(credential.updateDate).format('YYYY-MM-DD HH:mm:ss')
    };
    return retval;
}

export interface ContextScheme {
    id: number;
    name:string;
    path:string;
    document:string;
    saved: string;
    updated:string;
}

export async function contextToScheme(context:ContextDocument) {
    const retval:ContextScheme = {
        id: context.id,
        name: context.name,
        path: context.path,
        document: context.document,
        saved: moment(context.saveDate).format('YYYY-MM-DD HH:mm:ss'),
        updated: moment(context.updateDate).format('YYYY-MM-DD HH:mm:ss')
    };
    return retval;
}


export interface VCTScheme {
    id: number;
    name:string;
    path:string;
    credentials:string;
    document:string;
    saved: string;
    updated:string;
}

export async function vctToScheme(vct:VCTDocument) {
    const retval:VCTScheme = {
        id: vct.id,
        name: vct.name,
        path: vct.path,
        credentials: vct.credentials,
        document: vct.document,
        saved: moment(vct.saveDate).format('YYYY-MM-DD HH:mm:ss'),
        updated: moment(vct.updateDate).format('YYYY-MM-DD HH:mm:ss')
    };
    return retval;
}
