import { Entities as VeramoDataStoreEntities, migrations as VeramoDataStoreMigrations } from '@veramo/data-store'
import {
  DataStoreContactEntities,
  DataStoreMigrations,
  //DataStorePresentationDefinitionItemEntities
} from '@sphereon/ssi-sdk.data-store'
//import { SqliteConnectionOptions } from 'typeorm/driver/sqlite/SqliteConnectionOptions'
import { PostgresConnectionOptions } from 'typeorm/driver/postgres/PostgresConnectionOptions'
import { KeyValueStoreEntity, kvStoreMigrations } from '@sphereon/ssi-sdk.kv-store-temp'
import {DB_NAME, DB_SCHEMA, DB_HOST, DB_USER, DB_PORT, DB_PASSWORD} from "../environment";

if (!process.env.DB_ENCRYPTION_KEY) {
  console.warn(`Please provide a DB_ENCRYPTION_KEY env var. Now we will use a pre-configured one. When you change to the var you will have to replace your DB`)
}

const dbConfig: PostgresConnectionOptions = {
  type: 'postgres',
  schema: DB_SCHEMA,
  host: DB_HOST,
  port: parseInt(DB_PORT),
  username: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  applicationName: DB_SCHEMA,
  entities: [
    ...VeramoDataStoreEntities,
    ...DataStoreContactEntities,
    //...DataStorePresentationDefinitionItemEntities,
    KeyValueStoreEntity
  ],
  migrations: [
    ...VeramoDataStoreMigrations,
    ...DataStoreMigrations,
    ...kvStoreMigrations
  ],
  migrationsRun: false, // We run migrations from code to ensure proper ordering with Redux
  synchronize: false, // We do not enable synchronize, as we use migrations from code
  migrationsTransactionMode: 'each', // protect every migration with a separate transaction
  logging: 'all', //['info', 'error'], // 'all' means to enable all logging
  logger: 'advanced-console',
}

export { dbConfig }
