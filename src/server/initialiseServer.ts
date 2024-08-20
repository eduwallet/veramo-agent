import Debug from 'debug'
import {ExpressBuilder, ExpressCorsConfigurer} from "@sphereon/ssi-express-support";
import { dumpExpressRoutes } from '../utils/dumpExpressRoutes';
import { getIssuerStore } from 'issuer/Store';
import { createRoutesForIssuer } from './createRoutesForIssuer';
import { bearerAdminForIssuer } from './bearerAdminForIssuer';
import { bearerTokenForCredential } from './bearerTokenForCredential';

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
    const store = getIssuerStore();
    console.log('creating routes for each issuer instance', Object.keys(store));
    Object.keys(store).forEach(async (key) => {
        const issuer = store[key];
        // initialise the passport strategy
        bearerAdminForIssuer(issuer);
        bearerTokenForCredential(issuer);
        await createRoutesForIssuer(issuer, expressSupport);
    })

    debug("starting express server");
    expressSupport.start();

    dumpExpressRoutes(expressSupport.express);
}
