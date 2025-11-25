import {config as dotenvConfig} from "dotenv-flow";
dotenvConfig()

import {resolve} from "path";

export const DB_NAME = process.env.DB_NAME ?? 'postgres'
export const DB_SCHEMA = process.env.DB_SCHEMA ?? 'agent'
export const DB_HOST = process.env.DB_HOST ?? 'localhost'
export const DB_PORT = process.env.DB_PORT ?? '5432'
export const DB_USER = process.env.DB_USER ?? 'postgres'
export const DB_PASSWORD = process.env.DB_PASSWORD ?? 'topsecret'
export const BASEURL = process.env.BASEURL;

export const CONF_PATH = process.env.CONF_PATH ? resolve(process.env.CONF_PATH) : resolve('../../conf')
export const DID_OPTIONS_PATH = `${CONF_PATH}/dids`
export const ISSUER_PATH = `${CONF_PATH}/issuer`;
export const METADATA_PATH = `${CONF_PATH}/metadata`;
export const CREDENTIAL_CONFIGURATION_PATH = `${CONF_PATH}/credentials`;
export const CONTEXT_CONFIGURATION_PATH = `${CONF_PATH}/contexts`;
export const VCT_CONFIGURATION_PATH = `${CONF_PATH}/vct`;
