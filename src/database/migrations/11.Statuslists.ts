import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class Statuslists1769001656334 implements MigrationInterface {
  name = 'Statuslists1769001656334';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string

    await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'statuslist'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'name', type: 'varchar', isNullable: false},
            { name: 'index', type: 'int', isNullable: false},
            { name: 'size', type: 'int', isNullable: false},
            { name: 'used', type: 'int', isNullable: false},
            { name: 'content', type: 'text', isNullable: false },
            { name: 'revoked', type: 'text', isNullable: false },
            { name: 'expirationDate', type: dateTimeType, isNullable: true },
            { name: 'bitsize', type: 'int', isNullable: true },
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType },
          ],
        }),
        true,
      )

    await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'statuslistconf'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'name', type: 'varchar', isNullable: false},
            { name: 'tokens', type: 'text', isNullable: false},
            { name: 'messages', type: 'text', isNullable: true},
            { name: 'size', type: 'int', isNullable: false},
            { name: 'bitsize', type: 'int', isNullable: false},
            { name: 'purpose', type: 'varchar', isNullable: false},
            { name: 'type', type: 'varchar', isNullable: false },
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType }
          ],
        }),
        true,
      )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('statuslistconf')) {
        await queryRunner.dropTable('statuslistconf', true, true, true);
    }
    if (await queryRunner.hasTable('statuslist')) {
        await queryRunner.dropTable('statuslist', true, true, true);
    }
  }
}
