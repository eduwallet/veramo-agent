import Debug from 'debug'
import { TAgent } from '@veramo/core'
import {ExpressBuilder, ExpressCorsConfigurer} from "@sphereon/ssi-express-support";

import { TAgentTypes } from '../plugins';
import { dumpExpressRoutes } from '../utils/dumpExpressRoutes';
import { getIssuerStore } from 'issuer/Store';
import { createRoutesForIssuer } from './createRoutesForIssuer';


const debug = Debug(`eduwallet:server`)

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5000
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS ?? '0.0.0.0'
const BASEURL = process.env.BASEURL ?? 'https://agent.dev.eduwallet.nl'

const expressSupport = ExpressBuilder.fromServerOpts({
        hostname: LISTEN_ADDRESS,
        port: PORT,
        basePath: new URL(BASEURL).toString()
    })
        .withCorsConfigurer(new ExpressCorsConfigurer({}).allowOrigin('*').allowCredentials(true))
        .withPassportAuth(true)
        .withMorganLogging()
        .build({startListening: false});

export const initialiseServer = async () => {
    debug('creating routes for each issuer instance');
    const store = getIssuerStore();
    Object.keys(store).forEach((key) => {
        const issuer = store[key];
        createRoutesForIssuer(issuer, expressSupport);
    })

    debug("starting express server");
    expressSupport.start();

    dumpExpressRoutes(expressSupport.express);
}
