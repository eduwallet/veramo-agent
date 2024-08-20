import Debug from 'debug'
import {ExpressBuilder, ExpressCorsConfigurer} from "@sphereon/ssi-express-support";
import { dumpExpressRoutes } from '../utils/dumpExpressRoutes';
import { getIssuerStore } from 'issuer/Store';
import { createRoutesForIssuer } from './createRoutesForIssuer';
import { bearerAdminForIssuer } from './bearerAdminForIssuer';

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
        .withMorganLogging({format:'combined'})
        .build({startListening: false});

export const initialiseServer = async () => {
    debug('creating routes for each issuer instance');
    const store = getIssuerStore();
    Object.keys(store).forEach((key) => {
        const issuer = store[key];
        // initialise the passport strategy
        bearerAdminForIssuer(issuer);
        createRoutesForIssuer(issuer, expressSupport);
    })

    debug("starting express server");
    expressSupport.start();

    dumpExpressRoutes(expressSupport.express);
}
