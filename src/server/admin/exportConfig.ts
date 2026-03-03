import { getDbConnection } from '#root/database/databaseService';
import { ContextDocument, CredentialType, Identifier, Issuer, VCTDocument } from '#root/database/entities/index';
import { sendErrorResponse } from '#root/server/sendErrorResponse'
import { ErrorCodes } from '#root/types/api';
import { ArchiveFile, exportConfigAsZip } from '#root/utils/exportConfigAsZip';
import { getBaseUrl } from '#root/utils/getBaseUrl';
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
    const dbConnection = await getDbConnection();
    const repo = dbConnection.getRepository(ContextDocument);
    const objs =  await repo.createQueryBuilder('context_document').orderBy("context_document.name").getMany();
    const retval:ArchiveFile[] = [];
    for (const obj of objs) {
        retval.push({content: contextToJson(obj), path: '/contexts', name: obj.name + '.json'});
    }
    return retval;
}
function contextToJson(obj:ContextDocument):string
{
    // replacing is not really necessary, as we store the configuration with the unreplaced tags
    // as is in the database
    const basePath = getBaseUrl();
    let jsonDoc = obj.document;
    jsonDoc = jsonDoc.replaceAll(`/${basePath}/gi`, "{{ here }}");
    return JSON.stringify({
        name: obj.name,
        basePath: obj.path,
        document: JSON.parse(jsonDoc)
    }, null, 4);
}
async function addCredentials(): Promise<ArchiveFile[]>
{
    const dbConnection = await getDbConnection();
    const repo = dbConnection.getRepository(CredentialType);
    const objs =  await repo.createQueryBuilder('credential_type').orderBy("credential_type.name").getMany();
    const retval:ArchiveFile[] = [];
    for (const obj of objs) {
        retval.push({content: credentialToJson(obj), path: '/credentials', name: obj.name + '.json'});
    }
    return retval;
}
function credentialToJson(obj:CredentialType):string
{
    return JSON.stringify(JSON.parse(obj.configuration), null, 4);
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
    const dbConnection = await getDbConnection();
    const ids = dbConnection.getRepository(Issuer);
    const objs =  await ids.createQueryBuilder('issuer').orderBy("issuer.name").getMany();
    const retval:ArchiveFile[] = [];
    for (const obj of objs) {
        retval.push({content: issuerToJson(obj), path: '/issuers', name: obj.name + '.json'});
    }
    return retval;
}
function issuerToJson(obj:Issuer):string
{
    return JSON.stringify({
        name: obj.name,
        baseUrl: obj.baseUrl,
        ...(obj.adminToken && {adminToken: obj.adminToken}),
        did: obj.did,
        ...(obj.authorizationEndpoint && {authorizationEndpoint: obj.authorizationEndpoint}),
        ...(obj.tokenEndpoint && {tokenEndpoint: obj.tokenEndpoint}),
        ...(obj.clientId && {clientId: obj.clientId}),
        ...(obj.clientSecret && {clientSecret: obj.clientSecret}),
        ...(obj.statuslists && {statusLists: JSON.parse(obj.statuslists)}),
        usesNonces: true
    }, null, 4);
}
async function addMetadata(): Promise<ArchiveFile[]>
{
    const dbConnection = await getDbConnection();
    const ids = dbConnection.getRepository(Issuer);
    const objs =  await ids.createQueryBuilder('issuer').orderBy("issuer.name").getMany();
    const retval:ArchiveFile[] = [];
    for (const obj of objs) {
        retval.push({content: metadataToJson(obj), path: '/metadata', name: obj.name + '.json'});
    }
    return retval;
}
function metadataToJson(obj:Issuer):string
{
    return JSON.stringify(JSON.parse(obj.metadata ?? '{}'), null, 4);
}
async function addVCTs(): Promise<ArchiveFile[]>
{
    const dbConnection = await getDbConnection();
    const repo = dbConnection.getRepository(VCTDocument);
    const objs =  await repo.createQueryBuilder('vct_document').orderBy("vct_document.name").getMany();
    const retval:ArchiveFile[] = [];
    for (const obj of objs) {
        retval.push({content: vctToJson(obj), path: '/vct', name: obj.name + '.json'});
    }
    return retval;
}
function vctToJson(obj:VCTDocument):string
{
    const basePath = getBaseUrl();
    let jsonDoc = obj.document;
    jsonDoc = jsonDoc.replaceAll(`/${basePath}/gi`, "{{ here }}");
        
    return JSON.stringify({
        name: obj.name,
        path: obj.path,
        credentials: JSON.parse(obj.credentials),
        document: JSON.parse(jsonDoc)
    }, null, 4);
}
