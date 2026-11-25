import Debug from 'debug';
const debug = Debug('server:api');

import { Request, Response } from 'express'
import { getCredentialConfigurationStore } from '#root/credentials/Store';
import { DataList, credentialToScheme } from './types.js';

export async function listCredentials(request: Request, response: Response) {
    try {
        debug('listing credential types');
        const store = getCredentialConfigurationStore();
        const names = Object.keys(store).sort();
        const data:DataList = {
            offset: 0,
            count: names.length,
            pagesize: 50,
            data: names.map((name) => credentialToScheme(name, store[name]))
        };
        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function getCredential(request: Request, response: Response) {
    try {
        const store = getCredentialConfigurationStore();
        const name = request.params.id as string;
        if (!Object.prototype.hasOwnProperty.call(store, name)) {
            return response.status(404).json({"error": "Credential type not found"});
        }
        return response.status(200).json(credentialToScheme(name, store[name]));
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}
