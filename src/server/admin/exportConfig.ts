import { getDbConnection } from '#root/database/databaseService';
import { Identifier } from '#root/database/entities/index';
import { Issuer } from '#root/issuer/Issuer';
import { getIssuerStore } from '#root/issuer/Store';
import { getCredentialConfigurationStore } from '#root/credentials/Store';
import { getContextConfigurationStore } from '#root/contexts/Store';
import { getVctConfigurationStore } from '#root/vct/Store';
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { ErrorCodes } from '#root/types/api';
import { ArchiveFile, exportConfigAsZip } from '#root/utils/exportConfigAsZip';
import { Request, Response } from 'express'

export async function exportConfig(request: Request, response: Response) {
    try {
        response.set({
            'Content-Type': 'application/zip',
            'Content-Disposition': 'attachment; filename="configuration.zip"',
        });
        await exportConfigAsZip(response, await createFiles());
        return response;
    } 
    catch (e) {
        return sendErrorResponse(response, 500, {
                error: ErrorCodes.INTERNAL_ERROR,
                error_description: (e as Error).message,
            },
            e
        );
    }
}

async function createFiles()
{
    return [
        ...await addContextFiles(),
        ...await addCredentials(),
        ...await addDids(),
        ...await addIssuers(),
        ...await addMetadata(),
        ...await addVCTs()
    ];
}

async function addContextFiles(): Promise<ArchiveFile[]>
{
    return getContextConfigurationStore().configured().map((obj) => ({
        content: JSON.stringify({
            name: obj.name,
            basePath: obj.basePath,
            document: obj.source ?? obj.document
        }, null, 4),
        path: '/contexts',
        name: obj.name + '.json'
    }));
}
async function addCredentials(): Promise<ArchiveFile[]>
{
    const store = getCredentialConfigurationStore();
    return Object.keys(store).sort().map((name) => ({
        content: JSON.stringify(store[name], null, 4),
        path: '/credentials',
        name: name + '.json'
    }));
}
async function addDids(): Promise<ArchiveFile[]>
{
    const dbConnection = await getDbConnection();
    const ids = dbConnection.getRepository(Identifier);
    const objs =  await ids.createQueryBuilder('identifier')
        .innerJoinAndSelect("identifier.keys", "key")
        .orderBy("identifier.did").getMany();
    const retval:ArchiveFile[] = [];
    for (const obj of objs) {
        retval.push({content: didToJson(obj), path: '/dids', name: (obj.alias ?? obj.did) + '.json'});
    }
    return retval;
}
function didToJson(obj:Identifier):string
{
    return JSON.stringify({
        did: obj.did,
        ...(obj.alias && {alias: obj.alias}),
        ...(obj.path && {path: obj.path}),
        ...(obj.services && {service: obj.services}),
        type: obj.keys[0].type,
        provider: obj.provider
    }, null, 4);
}
async function addIssuers(): Promise<ArchiveFile[]>
{
    return sortedIssuers().map((issuer) => ({content: issuerToJson(issuer), path: '/issuers', name: issuer.name + '.json'}));
}
function sortedIssuers(): Issuer[]
{
    return Object.values(getIssuerStore()).sort((a, b) => a.name.localeCompare(b.name));
}
function issuerToJson(issuer:Issuer):string
{
    const obj = issuer.options;
    return JSON.stringify({
        name: issuer.name,
        baseUrl: obj.baseUrl,
        ...(obj.adminToken && {adminToken: obj.adminToken}),
        did: obj.did,
        ...(obj.authorizationEndpoint && {authorizationEndpoint: obj.authorizationEndpoint}),
        ...(obj.tokenEndpoint && {tokenEndpoint: obj.tokenEndpoint}),
        ...(obj.embeddedAuthorizationServer && {embeddedAuthorizationServer: obj.embeddedAuthorizationServer}),
        ...(obj.clientId && {clientId: obj.clientId}),
        ...(obj.clientSecret && {clientSecret: obj.clientSecret}),
        usesNonces: true
    }, null, 4);
}
async function addMetadata(): Promise<ArchiveFile[]>
{
    return sortedIssuers().map((issuer) => ({content: JSON.stringify(issuer.metadata, null, 4), path: '/metadata', name: issuer.name + '.json'}));
}
async function addVCTs(): Promise<ArchiveFile[]>
{
    const store = getVctConfigurationStore();
    return Object.keys(store).sort().map((name) => ({
        content: JSON.stringify({
            name,
            path: store[name].path,
            credentials: store[name].credentials,
            document: store[name].source ?? store[name].document
        }, null, 4),
        path: '/vct',
        name: name + '.json'
    }));
}
