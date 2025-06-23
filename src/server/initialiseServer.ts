import Debug from 'debug';
const debug = Debug('issuer:server');
import { dumpExpressRoutes } from 'utils/dumpExpressRoutes.js';
import { getIssuerStore } from 'issuer/Store.js';
import { createRoutesForIssuer } from './createRoutesForIssuer.js';
import { bearerAdminForIssuer } from './bearerAdminForIssuer.js';
import { getContextConfigurationStore } from "contexts/Store.js";
import { getVctConfigurationStore } from "vct/Store.js";
import express from 'express'
import morgan from 'morgan'
import bodyParser from 'body-parser'
import cors from 'cors'
import { getContext } from "./endpoints/getContext.js";
import { getVct } from "./endpoints/getVct.js";
import { getDIDConfigurationStore } from '#root/dids/Store';
import { getDidWebSpec } from './endpoints/getDidSpec.js';

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5000
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS ?? '0.0.0.0'

export const initialiseServer = async () => {
  const app = express();
  app.use(morgan('combined')); // use combined logging output
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json({ limit: '5mb' }));

  app.use(cors({origin: '*', credentials: true, optionsSuccessStatus: 204}));

  const store = getIssuerStore();
  debug('creating routes for each issuer instance', Object.keys(store));
  for (const key of Object.keys(store)) {
    const issuer = store[key];
    // initialise the passport strategy
    bearerAdminForIssuer(issuer);
    await createRoutesForIssuer(issuer, app);
  }

  const contextStore = getContextConfigurationStore();
  const contextRouter = express.Router();
  app.use('/', contextRouter);
  for (const key of contextStore.keys()) {
    const context = contextStore.get(key);
    // only serve it if we have content. If there is no content, it is cached on disk
    if (context?.document !== null) {
      console.error('adding context path for ', context);
      getContext(contextRouter, context!);
    }
  };

  const vctStore = getVctConfigurationStore();
  const vctRouter = express.Router();
  app.use('/', vctRouter);
  for (const key of Object.keys(vctStore)) {
    const vct = vctStore[key];
    getVct(vctRouter, vct);
  };

  const didStore = getDIDConfigurationStore();
  const didRouter = express.Router();
  app.use('/', didRouter);
  for (const did of didStore.keys()) {
    const didValue = didStore.get(did);
    if (didValue?.path && didValue?.path.length) {
      getDidWebSpec(didRouter, didValue);
    }

  }

  debug("starting express server");
  app.listen(PORT, LISTEN_ADDRESS);
  
  dumpExpressRoutes(app);
}
