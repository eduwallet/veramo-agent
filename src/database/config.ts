import {Entities, migrations } from '#root/packages/datastore/index'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions.js'
import {DB_NAME, DB_SCHEMA, DB_HOST, DB_USER, DB_PORT, DB_PASSWORD} from "../environment.js";

export const dbConfig: PostgresConnectionOptions = {
  type: 'postgres',
  schema: DB_SCHEMA,
  host: DB_HOST,
  port: parseInt(DB_PORT),
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  applicationName: DB_SCHEMA,
  entities: Entities,
  migrations,
  migrationsRun: false, // We run migrations from code to ensure proper ordering with Redux
  synchronize: false, // We do not enable synchronize, as we use migrations from code
  migrationsTransactionMode: 'each', // protect every migration with a separate transaction
  logging: 'all', //['info', 'error'], // 'all' means to enable all logging
  logger: 'advanced-console',
  
}
