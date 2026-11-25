import Debug from 'debug';
const debug = Debug('server:api');

import { Request, Response } from 'express'
import { getIssuerStore } from '#root/issuer/Store';
import { DataList, issuerToScheme } from './types.js';

export async function listIssuers(request: Request, response: Response) {
    try {
        debug('listing issuers');
        const issuers = Object.values(getIssuerStore()).sort((a, b) => a.name.localeCompare(b.name));
        const data:DataList = {
            offset: 0,
            count: issuers.length,
            pagesize: 50,
            data: issuers.map((issuer) => issuerToScheme(issuer))
        };
        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function getIssuer(request: Request, response: Response) {
    try {
        const issuer = getIssuerStore()[request.params.id as string];
        if (!issuer) {
            return response.status(404).json({"error": "Issuer not found"});
        }
        debug("retrieved a single issuer with name ", request.params.id);
        return response.status(200).json(issuerToScheme(issuer, true));
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}
