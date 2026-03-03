import Debug from 'debug';
const debug = Debug('server:api');

import { getDbConnection } from '#root/database/databaseService';
import { Issuer } from "#root/database/entities/index";
import { Request, Response } from 'express'
import { DataList, issuerToScheme } from './types.js';

export async function listIssuers(request: Request, response: Response) {
    try {
        debug('listing issuers');
        const data:DataList = {
            offset: 0,
            count: 0,
            pagesize: 50,
            data: []
        };
        const dbConnection = await getDbConnection();
        const ids = dbConnection.getRepository(Issuer);
        const issuers =  await ids.createQueryBuilder('issuer').orderBy("issuer.name").getMany();
        data.count = issuers.length;
        for (const obj of issuers) {
            data.data.push(await issuerToScheme(obj));
        }

        return response.status(200).json(data);
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function getIssuer(request: Request, response: Response) {
    try {
        const dbConnection = await getDbConnection();
        const ids = dbConnection.getRepository(Issuer);
        const issuer =  await ids.createQueryBuilder('issuer').where('id=:id', {id: request.params.id}).getOne();
        debug("retrieved a single issuer with id ", request.params.id, issuer);
        return response.status(200).json(await issuerToScheme(issuer!, true));
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}


function is_valid_name(p:string) {
    if (!p || p.length < 1) {
        debug("invalid name, returning error");
        throw new Error ('Invalid name');
    }
}

interface StoreIssuerRequest {
    id?: number;
    did:string;
    baseUrl:string;
    name:string;
    adminToken:string;
    authorizationEndpoint?:string;
    tokenEndpoint?:string;
    clientId?:string;
    clientSecret?:string;
    metadata?:any;
    statusLists?:any;
}

async function setIssuerData(issuer:Issuer, data:StoreIssuerRequest)
{
    issuer.name = data.name;
    issuer.did = data.did;
    issuer.baseUrl = data.baseUrl;
    issuer.adminToken = data.adminToken;
    issuer.authorizationEndpoint = data.authorizationEndpoint;
    issuer.tokenEndpoint = data.tokenEndpoint;
    issuer.clientId = data.clientId;
    issuer.clientSecret = data.clientSecret;
    if (data.metadata) {
        issuer.metadata = JSON.stringify(data.metadata);
    }
    if (data.statusLists) {
        issuer.statuslists = JSON.stringify(data.statusLists);
    }
}

export async function storeIssuer(request: Request<StoreIssuerRequest>, response: Response) {
    try {
        debug("storing issuer", request.body);
        is_valid_name(request.body.name);

        const dbConnection = await getDbConnection();
        const issuers = dbConnection.getRepository(Issuer);
        const issuer =  await issuers.createQueryBuilder('issuer')
            .where('id=:id', {id: request.body.id})
            .getOne();
        if (!issuer) {
            throw new Error("Issuer not found for POST");
        }

        await setIssuerData(issuer, request.body);

        debug("saving issuer", issuer);
        await issuers.save(issuer);

        return response.status(200).json(await issuerToScheme(issuer));
    }
    catch (e) {
        debug("storeIssuer: caught", e);
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

export async function createIssuer(request: Request<StoreIssuerRequest>, response: Response) {
    try {
        is_valid_name(request.body.name);

        const dbConnection = await getDbConnection();
        const issuers = dbConnection.getRepository(Issuer);
        const other =  await issuers.createQueryBuilder('issuer')
            .where('name=:name', {name: request.body.name})
            .getOne();
        if (other) {
            throw new Error("Name already in use");
        }

        const obj = new Issuer();
        await setIssuerData(obj, request.body);
        await issuers.save(obj);

        return response.status(200).json(await issuerToScheme(obj));
    }
    catch (e) {
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}

interface DeleteIssuerRequest {
    id:number;
}

export async function deleteIssuer(request: Request<DeleteIssuerRequest>, response: Response) {
    try {
        const dbConnection = await getDbConnection();
        const issuers = dbConnection.getRepository(Issuer);

        const issuer =  await issuers.createQueryBuilder('issuer')
            .where('id=:id', {id: request.body.id})
            .getOne();
        if (!issuer) {
            throw new Error("Issuer not found for POST");
        }
        
        await issuers.delete({id: request.body.id});
        debug("removed issuer, returning status 202");
        return response.status(202).json([]);
    }
    catch (e) {
        debug("Caught error on deleting issuer ", e);
        response.header('Content-Type', 'application/json')
        return response.status(500).json({"error": JSON.stringify(e)});
    }
}
