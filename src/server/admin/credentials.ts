import Debug from 'debug';
const debug = Debug('server:api');

import { getDbConnection } from '#root/database/databaseService';
import { CredentialType } from "#root/database/entities/index";
import { Request, Response } from 'express'
import { DataList, credentialToScheme } from './types.js';

export async function listCredentials(request: Request, response: Response) {
    try {
        debug('listing credential types');
        const data:DataList = {
            offset: 0,
            count: 0,
            pagesize: 50,
            data: []
        };
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(CredentialType);
        const objs =  await repo.createQueryBuilder('credential_type').orderBy("credential_type.name").getMany();
        data.count = objs.length;
        for (const obj of objs) {
            data.data.push(await credentialToScheme(obj));
        }

        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface StoreCredentialRequest {
    id:number;
    name:string;
    configuration:string;
}

async function setData(credential:CredentialType, name:string, configuration:string)
{
    credential.name = name;
    credential.configuration = JSON.stringify(JSON.parse(configuration));
}

export async function storeCredential(request: Request<StoreCredentialRequest>, response: Response) {
    try {
        debug("storing credential", request.body);

        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(CredentialType);
        const obj =  await repo.createQueryBuilder('credential_type')
            .where('id=:id', {id: request.body.id})
            .getOne();
        if (!obj) {
            throw new Error("Credential not found for POST");
        }

        await setData(obj, request.body.name, request.body.configuration);

        debug("saving credential", obj);
        await repo.save(obj);

        return response.status(200).json(await credentialToScheme(obj));
    }
    catch (e) {
        debug("storeCredential: caught", e);
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface CreateCredentialRequest {
    name:string;
    configuration:string;
}
export async function createCredential(request: Request<CreateCredentialRequest>, response: Response) {
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(CredentialType);
        const other =  await repo.createQueryBuilder('credential_type')
            .where('name=:name', {name: request.body.name})
            .getOne();
        if (other) {
            throw new Error("Credential type name already in use");
        }

        const obj = new CredentialType();
        await setData(obj, request.body.name, request.body.configuration);
        await repo.save(obj);

        return response.status(200).json(await credentialToScheme(obj));
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface DeleteRequest {
    id:number;
}

export async function deleteCredential(request: Request<DeleteRequest>, response: Response) {
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(CredentialType);

        const obj =  await repo.createQueryBuilder('credential_type')
            .where('id=:id', {id: request.body.id})
            .getOne();
        if (!obj) {
            throw new Error("Credential not found for DELETE");
        }
        
        await repo.delete({id: request.body.id});
        return response.status(202).json([]);
    }
    catch (e) {
        debug("Caught error on deleting credential ", e);
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}
