import Debug from 'debug';
const debug = Debug('issuer:server');
import { dumpExpressRoutes } from 'utils/dumpExpressRoutes.js';
import { getIssuerStore } from 'issuer/Store.js';
import { createRoutesForAdmin } from './admin/createRoutesForAdmin.js';
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
import { isSingleTenant } from '#root/utils/isSingleTenant';

const PORT = process.env.PORT ? Number.parseInt(process.env.PORT) : 5000
const LISTEN_ADDRESS = process.env.LISTEN_ADDRESS ?? '0.0.0.0'

export const initialiseServer = async () => {
  const app = express();
  app.use(morgan('combined')); // use combined logging output
  app.use(bodyParser.urlencoded({ extended: true }));
  app.use(bodyParser.json({ limit: '5mb' }));

  app.use(cors({origin: '*', credentials: true, optionsSuccessStatus: 204}));

  await createRoutesForAdmin(app);

  const contextStore = getContextConfigurationStore();
  const rootRouter = express.Router();
  app.use('/', rootRouter);
  const wellKnownRouter = express.Router();
  if (!isSingleTenant()) {
      app.use('/.well-known', wellKnownRouter);
  }

  for (const key of contextStore.keys()) {
      const context = contextStore.get(key);
      // only serve it if we have content. If there is no content, it is cached on disk
      if (context?.document !== null) {
        debug('adding context path for ', context);
        getContext(rootRouter, context!);
      }
  }

  const vctStore = getVctConfigurationStore();
  for (const key of Object.keys(vctStore)) {
      const vct = vctStore[key];
      getVct(rootRouter, vct);
  }

  const didStore = getDIDConfigurationStore();
  debug('looping over keys in store', (await didStore.keysWithPath())?.length);
  for (const did of (await didStore.keysWithPath())) {
      const didValue = await didStore.get(did);
      debug('evaluating did ', didValue?.identifier.did, ' for path ', didValue?.identifier.path);
      if (didValue && (isSingleTenant() || didValue?.identifier.path && didValue?.identifier.path.length)) {
          debug('adding did-web path for ', didValue?.identifier);
          getDidWebSpec(rootRouter, didValue!);
      }
  }

  // add the more specific issuer routes at the end, so we do not accidentally overrule
  // did-web-spec routes
  const store = getIssuerStore();
  debug('creating routes for each issuer instance', Object.keys(store));
  for (const key of Object.keys(store)) {
    const issuer = store[key];
    // initialise the passport strategy
    bearerAdminForIssuer(issuer);
    await createRoutesForIssuer(issuer, app, isSingleTenant() ? rootRouter : wellKnownRouter);
  }

  debug("starting express server");
  app.listen(PORT, LISTEN_ADDRESS);
  
  dumpExpressRoutes(app);
}
