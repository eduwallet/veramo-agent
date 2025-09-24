import Debug from 'debug';
const debug = Debug('server:api');

import { getDbConnection } from '#root/database/databaseService';
import { VCTDocument } from "#root/packages/datastore/index";
import { Request, Response } from 'express'
import { DataList, vctToScheme } from './types.js';

export async function listVCTs(request: Request, response: Response) {
    try {
        debug('listing vct types');
        const data:DataList = {
            offset: 0,
            count: 0,
            pagesize: 50,
            data: []
        };
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(VCTDocument);
        const objs =  await repo.createQueryBuilder('vct_document').orderBy("vct_document.name").getMany();
        data.count = objs.length;
        for (const obj of objs) {
            data.data.push(await vctToScheme(obj));
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
    credentials:string;
    document:string;
}

async function setData(obj:VCTDocument, name:string, path:string, credentials:string, document:string)
{
    obj.name = name;
    obj.path = path;
    obj.credentials = JSON.stringify(JSON.parse(credentials));
    obj.document = JSON.stringify(JSON.parse(document));
}

export async function storeVCTDocument(request: Request<StoreRequest>, response: Response) {
    try {
        debug("storing vct document", request.body);

        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(VCTDocument);
        const obj =  await repo.createQueryBuilder('vct_document')
            .where('id=:id', {id: request.body.id})
            .getOne();
        if (!obj) {
            throw new Error("VCT document not found for POST");
        }

        await setData(obj, request.body.name, request.body.path, request.body.credentials, request.body.document);

        debug("saving vct document", obj);
        await repo.save(obj);

        return response.status(200).json(vctToScheme(obj));
    }
    catch (e) {
        debug("storeVCTDocument: caught", e);
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface CreateRequest {
    name:string;
    path:string;
    credentials:string;
    document:string;
}
export async function createVCTDocument(request: Request<CreateRequest>, response: Response) {
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(VCTDocument);
        const other =  await repo.createQueryBuilder('vct_document')
            .where('name=:name', {name: request.body.name})
            .getOne();
        if (other) {
            throw new Error("VCT document type name already in use");
        }

        const obj = new VCTDocument();
        await setData(obj, request.body.name, request.body.path, request.body.credentials, request.body.document);
        await repo.save(obj);

        return response.status(200).json(vctToScheme(obj));
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface DeleteRequest {
    id:number;
}

export async function deleteVCTDocument(request: Request<DeleteRequest>, response: Response) {
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(VCTDocument);

        const obj =  await repo.createQueryBuilder('vct_document')
            .where('id=:id', {id: request.body.id})
            .getOne();
        if (!obj) {
            throw new Error("VCT document not found for DELETE");
        }
        
        await repo.delete({id: request.body.id});
        return response.status(202).json([]);
    }
    catch (e) {
        debug("Caught error on deleting vct document ", e);
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}
