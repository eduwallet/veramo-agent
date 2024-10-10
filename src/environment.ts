import {config as dotenvConfig} from "dotenv-flow";
import { debug } from "utils/logger";
debug('reading dot env file');
dotenvConfig()

import {resolve} from "path";
import {loadJsonFiles} from "utils/generic";
import {IDIDOpts} from "./types";

export const DB_CONNECTION_NAME = process.env.DB_CONNECTION_NAME ?? 'default'
export const DB_NAME = process.env.DB_NAME ?? 'postgres'
export const DB_SCHEMA = process.env.DB_SCHEMA ?? 'agent'
export const DB_HOST = process.env.DB_HOST ?? 'localhost'
export const DB_PORT = process.env.DB_PORT ?? '5432'
export const DB_USER = process.env.DB_USER ?? 'postgres'
export const DB_PASSWORD = process.env.DB_PASSWORD ?? 'topsecret'
export const DB_ENCRYPTION_KEY = process.env.DB_ENCRYPTION_KEY ?? '29739248cad1bd1a0fc4d9b75cd4d2990de535baf5caadfdf8d8f86664aa830c'

export const LOG_SERVICE = process.env.LOG_SERVICE;
export const LOG_USER = process.env.LOG_USER;

//export const DID_PREFIX = 'did'
export const CONF_PATH = process.env.CONF_PATH ? resolve(process.env.CONF_PATH) : resolve('../../conf')
export const DID_OPTIONS_PATH = `${CONF_PATH}/dids`
export const ISSUER_PATH = `${CONF_PATH}/issuer`;
export const METADATA_PATH = `${CONF_PATH}/metadata`;
export const CREDENTIAL_CONFIGURATION_PATH = `${CONF_PATH}/credentials`;
export const didOptConfigs = loadJsonFiles<IDIDOpts>({path: DID_OPTIONS_PATH})
