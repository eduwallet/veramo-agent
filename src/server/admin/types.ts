import { getDbConnection } from "#root/database/databaseService";
import { Identifier, Issuer, Key } from "#root/packages/datastore/index";
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
    saved: string;
    updated:string;
    keys:KeyScheme[];
}

export async function identifierToScheme(id:Identifier) {
    const retval:IdentifierScheme = {
        did: id.did,
        provider: id.provider || '',
        alias: id.alias || '',
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
