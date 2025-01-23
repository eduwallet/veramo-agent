import { ExpressBuilder, ExpressCorsConfigurer } from "@sphereon/ssi-express-support";
import { dumpExpressRoutes } from 'utils/dumpExpressRoutes';
import { getIssuerStore } from 'issuer/Store';
import { createRoutesForIssuer } from './createRoutesForIssuer';
import { bearerAdminForIssuer } from './bearerAdminForIssuer';
import { debug } from "utils/logger";
import { getContextConfigurationStore } from "contexts/Store";
import express from 'express'
import { getContext } from "./endpoints/getContext";

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5000
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS ?? '0.0.0.0'
const BASEURL = process.env.BASEURL ?? 'https://agent.dev.eduwallet.nl'

const expressSupport = ExpressBuilder.fromServerOpts({
  hostname: LISTEN_ADDRESS,
  port: PORT,
  basePath: new URL(BASEURL).toString()
})
  .withCorsConfigurer(new ExpressCorsConfigurer({}).allowOrigin('*').allowCredentials(true))
  .withMorganLogging({ format: 'combined' })
  .build({ startListening: false });

export const initialiseServer = async () => {
  const store = getIssuerStore();
  debug('creating routes for each issuer instance', Object.keys(store));
  for (const key of Object.keys(store)) {
    const issuer = store[key];
    // initialise the passport strategy
    bearerAdminForIssuer(issuer);
    await createRoutesForIssuer(issuer, expressSupport);
  }

  const contextStore = getContextConfigurationStore();
  const contextRouter = express.Router();
  expressSupport.express.use('/', contextRouter);
  for (const key of Object.keys(contextStore)) {
    const context = contextStore[key];
    getContext(contextRouter, context);
  };

  debug("starting express server");
  expressSupport.start();

  dumpExpressRoutes(expressSupport.express);
}
