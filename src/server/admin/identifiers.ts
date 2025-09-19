import { getDbConnection } from '#root/database/databaseService';
import { Identifier } from "#root/packages/datastore/index";
import { Request, Response } from 'express'
import { DataList, IdentifierScheme, identifierToScheme } from './types.js';

export async function listIdentifiers(request: Request, response: Response) {
    try {
        const data:DataList = {
            offset: 0,
            count: 0,
            pagesize: 50,
            data: []
        };
        const dbConnection = await getDbConnection();
        const ids = dbConnection.getRepository(Identifier);
        const identifiers =  await ids.createQueryBuilder('identifier').orderBy("identifier.did").getMany();
        data.count = identifiers.length;
        for (const id of identifiers) {
            data.data.push(await identifierToScheme(id));
        }

        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function storeIdentifier(request: Request, response: Response) {
    try {
        const data:any[] = [];
        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function createIdentifier(request: Request, response: Response) {
    try {
        const data:any[] = [];
        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function deleteIdentifier(request: Request, response: Response) {
    try {
        const data:any[] = [];
        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}