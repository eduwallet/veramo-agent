import {Entities, migrations as VeramoDataStoreMigrations } from '@veramo/data-store'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'
import {DB_NAME, DB_SCHEMA, DB_HOST, DB_USER, DB_PORT, DB_PASSWORD} from "../environment";
import { migrations } from './migrations';
import { Credential } from './entities/Credential';

if (!process.env.DB_ENCRYPTION_KEY) {
  console.warn(`Please provide a DB_ENCRYPTION_KEY env var. Now we will use a pre-configured one. When you change to the var you will have to replace your DB`)
}

console.log('creating dbConfig');
export const dbConfig: PostgresConnectionOptions = {
  type: 'postgres',
  schema: DB_SCHEMA,
  host: DB_HOST,
  port: parseInt(DB_PORT),
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  applicationName: DB_SCHEMA,
  entities: [
    ...Entities,
    Credential
  ],
  migrations: [
    ...VeramoDataStoreMigrations,
    ...migrations
  ],
  migrationsRun: false, // We run migrations from code to ensure proper ordering with Redux
  synchronize: false, // We do not enable synchronize, as we use migrations from code
  migrationsTransactionMode: 'each', // protect every migration with a separate transaction
  logging: 'all', //['info', 'error'], // 'all' means to enable all logging
  logger: 'advanced-console',
  
}
