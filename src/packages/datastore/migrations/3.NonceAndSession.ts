import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class NonceAndSession1750939106000 implements MigrationInterface {
  name = 'NonceAndSession1750939106000';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string

    await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'nonce'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'uuid', type: 'varchar', isNullable: true},
            { name: 'session', type: 'varchar', isNullable: true},
            { name: 'issuer', type: 'varchar', isNullable: true},
            { name: 'expirationDate', type: dateTimeType, isNullable: true },
            { name: 'saveDate', type: dateTimeType }
          ],
        }),
        true,
      )

      await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'session'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'uuid', type: 'varchar', isNullable: true},
            { name: 'state', type: 'varchar', isNullable: true},
            { name: 'issuer', type: 'varchar', isNullable: true},
            { name: 'expirationDate', type: dateTimeType, isNullable: true },
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType },
            { name: 'data', type: 'text', isNullable: true }
          ],
        }),
        true,
      )

  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('nonce')) {
        await queryRunner.dropTable('nonce', true, true, true);
    }
    if (await queryRunner.hasTable('session')) {
        await queryRunner.dropTable('session', true, true, true);
    }
  }
}
