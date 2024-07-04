import Debug from 'debug'
import { DataSource } from 'typeorm'
import { dbConfig } from './config'
import { DB_SCHEMA } from '../environment';

const debug = Debug(`eduwallet:db`)

/**
 * Todo, move to a class
 */
const dataSources = new Map()

export const getDbConnection = async (): Promise<DataSource> => {
  if (dbConfig.synchronize) {
    return Promise.reject(
      `WARNING: Migrations need to be enabled in this app! Adjust the database configuration and set migrationsRun and synchronize to false`
    )
  }

  if (dataSources.has(DB_SCHEMA)) {
    return dataSources.get(DB_SCHEMA)
  }

  const dataSource = await new DataSource({ ...dbConfig, name: DB_SCHEMA }).initialize()
  dataSources.set(DB_SCHEMA, dataSource)
  if (dbConfig.migrationsRun) {
    debug(
      `Migrations are currently managed from config. Please set migrationsRun and synchronize to false to get consistent behaviour. We run migrations from code explicitly`
    )
  } else {
    debug(`Running ${dataSource.migrations.length} migration(s) from code if needed...`)
    await dataSource.runMigrations()
    debug(`${dataSource.migrations.length} migration(s) from code were inspected and applied`)
  }
  return dataSource
}
