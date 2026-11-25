import Debug from 'debug';
const debug = Debug('server:api');

import { Request, Response } from 'express'
import { getContextConfigurationStore } from '#root/contexts/Store';
import { DataList, contextToScheme } from './types.js';

export async function listContextDocuments(request: Request, response: Response) {
    try {
        debug('listing context documents');
        const contexts = getContextConfigurationStore().configured().sort((a, b) => a.name!.localeCompare(b.name!));
        const data:DataList = {
            offset: 0,
            count: contexts.length,
            pagesize: 50,
            data: contexts.map((context) => contextToScheme(context))
        };
        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function getContextDocument(request: Request, response: Response) {
    try {
        const context = getContextConfigurationStore().configured().find((c) => c.name === request.params.id);
        if (!context) {
            return response.status(404).json({"error": "Context document not found"});
        }
        return response.status(200).json(contextToScheme(context));
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}
