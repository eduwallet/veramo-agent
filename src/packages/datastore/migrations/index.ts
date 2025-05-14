import { CreateDatabase1747127220001 } from './1.createDatabase'

/**
 * Allow others to use shared migration functions if they extend Veramo
 *
 * @public
 */
export * from './migration-functions.js'

/**
 * The migrations array that SHOULD be used when initializing a TypeORM database connection.
 *
 * These ensure the correct creation of tables and the proper migrations of data when tables change between versions.
 *
 * @public
 */
export const migrations = [
  CreateDatabase1747127220001,
]
