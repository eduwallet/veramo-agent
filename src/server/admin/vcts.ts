import Debug from 'debug';
const debug = Debug('server:api');

import { Request, Response } from 'express'
import { getVctConfigurationStore } from '#root/vct/Store';
import { DataList, vctToScheme } from './types.js';

export async function listVCTs(request: Request, response: Response) {
    try {
        debug('listing vct documents');
        const store = getVctConfigurationStore();
        const names = Object.keys(store).sort();
        const data:DataList = {
            offset: 0,
            count: names.length,
            pagesize: 50,
            data: names.map((name) => vctToScheme(name, store[name]))
        };
        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function getVCT(request: Request, response: Response) {
    try {
        const store = getVctConfigurationStore();
        const name = request.params.id as string;
        if (!Object.prototype.hasOwnProperty.call(store, name)) {
            return response.status(404).json({"error": "VCT document not found"});
        }
        return response.status(200).json(vctToScheme(name, store[name]));
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}
