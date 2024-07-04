import Debug from 'debug'
import { Request, Response } from 'express'

import { TAgent } from '@veramo/core'

import {ExpressBuilder, ExpressCorsConfigurer, StaticBearerAuth} from "@sphereon/ssi-express-support";

import {getCredentialDataSupplier} from "../utils/oid4vciCredentialSuppliers";
import { TAgentTypes, importIssuerOpts } from '../plugins';
import { Issuer } from "./issuer";
import { dumpExpressRoutes } from '../utils/dumpExpressRoutes';

const debug = Debug(`eduwallet:server`)

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5000
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS ?? '0.0.0.0'
const HOSTNAME = process.env.HOSTNAME ?? 'agent.dev.eduwallet.nl'
const BEARER_TOKEN = process.env.BEARER_TOKEN ?? 'eduwallet'

StaticBearerAuth.init('bearer-auth').addUser({name: 'admin', id: 'admin', token: BEARER_TOKEN}).connectPassport()
    
const expressSupport = ExpressBuilder.fromServerOpts({
        hostname: LISTEN_ADDRESS,
        port: PORT,
        basePath: new URL(HOSTNAME).toString()
    })
        .withCorsConfigurer(new ExpressCorsConfigurer({}).allowOrigin('*').allowCredentials(true))
        .withPassportAuth(true)
        .withMorganLogging()
        .build({startListening: false});

export const initialiseServer = async (agent:TAgent<TAgentTypes>) => {
    debug('creating routes for each issuer instance');

    for (const issuerOptions of importIssuerOpts) {
        debug("optionsStore is ", issuerOptions);

        debug("initializing rest api using ", issuerOptions);
        const routedApi = await Issuer.init({
            context: {agent},
            expressSupport,
            issuerOptions,
            /*opts: {
                // baseUrl: '',
                endpointOpts: {
                    tokenEndpointOpts: {
                        accessTokenSignerCallback:
                    }
                }

                },*/
            credentialDataSupplier: getCredentialDataSupplier(issuerOptions.correlationId)
        })

        const restApiServer = routedApi.restApi;
        const router = restApiServer.router;
        const path = `/.well-known/openid-credential-issuer`;
        router.get(path, (request: Request, response: Response) => {
            debug("override metadata path");
            return response.send(restApiServer.issuer.issuerMetadata)
        });
    }

    debug("starting express server");
    expressSupport.start();

    dumpExpressRoutes(expressSupport.express);
}
