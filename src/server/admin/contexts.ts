import Debug from 'debug';
const debug = Debug('server:api');

import { getDbConnection } from '#root/database/databaseService';
import { ContextDocument, CredentialType } from "#root/packages/datastore/index";
import { Request, Response } from 'express'
import { DataList, contextToScheme } from './types.js';

export async function listContextDocuments(request: Request, response: Response) {
    try {
        debug('listing context types');
        const data:DataList = {
            offset: 0,
            count: 0,
            pagesize: 50,
            data: []
        };
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(ContextDocument);
        const objs =  await repo.createQueryBuilder('context_document').orderBy("context_document.name").getMany();
        data.count = objs.length;
        for (const obj of objs) {
            data.data.push(await contextToScheme(obj));
        }

        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface StoreRequest {
    id:number;
    name:string;
    path:string;
    document:string;
}

async function setData(obj:ContextDocument, name:string, path:string, document:string)
{
    obj.name = name;
    obj.path = path;
    obj.document = JSON.stringify(JSON.parse(document));
}

export async function storeContextDocument(request: Request<StoreRequest>, response: Response) {
    try {
        debug("storing context document", request.body);

        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(ContextDocument);
        const obj =  await repo.createQueryBuilder('context_document')
            .where('id=:id', {id: request.body.id})
            .getOne();
        if (!obj) {
            throw new Error("Context document not found for POST");
        }

        await setData(obj, request.body.name, request.body.path, request.body.document);

        debug("saving context document", obj);
        await repo.save(obj);

        return response.status(200).json(await contextToScheme(obj));
    }
    catch (e) {
        debug("storeContextDocument: caught", e);
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface CreateRequest {
    name:string;
    path:string;
    document:string;
}
export async function createContextDocument(request: Request<CreateRequest>, response: Response) {
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(ContextDocument);
        const other =  await repo.createQueryBuilder('context_document')
            .where('name=:name', {name: request.body.name})
            .getOne();
        if (other) {
            throw new Error("Context document type name already in use");
        }

        const obj = new ContextDocument();
        await setData(obj, request.body.name, request.body.path, request.body.document);
        await repo.save(obj);

        const json = await contextToScheme(obj);
        debug("returning json", json);
        return response.status(200).json(json);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface DeleteRequest {
    id:number;
}

export async function deleteContextDocument(request: Request<DeleteRequest>, response: Response) {
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(ContextDocument);

        const obj =  await repo.createQueryBuilder('context_document')
            .where('id=:id', {id: request.body.id})
            .getOne();
        if (!obj) {
            throw new Error("Context document not found for DELETE");
        }
        
        await repo.delete({id: request.body.id});
        return response.status(202).json([]);
    }
    catch (e) {
        debug("Caught error on deleting context document ", e);
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}
