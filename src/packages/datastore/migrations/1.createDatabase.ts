import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import Debug from 'debug'
import { migrationGetTableName } from './migration-functions.js'

const debug = Debug('issuer:migration')

/**
 * Create the database layout for Veramo 3.0
 *
 * @public
 */
export class CreateDatabase1747127220001 implements MigrationInterface {
  name = 'CreateDatabase1747127220001' // Used in case this class gets minified, which would change the classname

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string

    debug(`creating identifier table`)
    await queryRunner.createTable(
      new Table({
        name: migrationGetTableName(queryRunner, 'identifier'),
        columns: [
          { name: 'did', type: 'varchar', isPrimary: true },
          { name: 'provider', type: 'varchar', isNullable: true },
          { name: 'alias', type: 'varchar', isNullable: true },
          { name: 'saveDate', type: dateTimeType },
          { name: 'updateDate', type: dateTimeType },
          { name: 'controllerKeyId', type: 'varchar', isNullable: true },
        ],
        indices: [
          {
            columnNames: ['alias', 'provider'],
            isUnique: true,
          },
        ],
      }),
      true,
    )

    debug(`creating key table`)
    await queryRunner.createTable(
      new Table({
        name: migrationGetTableName(queryRunner, 'key'),
        columns: [
          { name: 'kid', type: 'varchar', isPrimary: true },
          { name: 'kms', type: 'varchar' },
          { name: 'type', type: 'varchar' },
          { name: 'publicKeyHex', type: 'varchar' },
          { name: 'meta', type: 'text', isNullable: true },
          { name: 'identifierDid', type: 'varchar', isNullable: true },
        ],
        foreignKeys: [
          {
            columnNames: ['identifierDid'],
            referencedColumnNames: ['did'],
            referencedTableName: migrationGetTableName(queryRunner, 'identifier'),
          },
        ],
      }),
      true,
    )

    debug(`creating new private-key table`)
    await queryRunner.createTable(
      new Table({
        name: migrationGetTableName(queryRunner, 'private-key'),
        columns: [
          {
            name: 'alias',
            type: 'varchar',
            isPrimary: true,
          },
          {
            name: 'type',
            type: 'varchar',
          },
          {
            name: 'privateKeyHex',
            type: 'varchar',
          },
        ],
      }),
      true,
    )    
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error('illegal_operation: cannot roll back initial migration')
  }
}
