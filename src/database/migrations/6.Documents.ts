import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class Documents1758721139150 implements MigrationInterface {
  name = 'Documents1758721139150';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string

    await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'context_document'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'name', type: 'varchar', isNullable: false},
            { name: 'path', type: 'varchar', length: '1024', isNullable: false},
            { name: 'document', type: 'text', isNullable: false},
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType }
          ],
        }),
        true,
      );

      await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'vct_document'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'name', type: 'varchar', isNullable: false},
            { name: 'path', type: 'varchar', length: '1024', isNullable: false},
            { name: 'credentials', type: 'text', isNullable: false},
            { name: 'document', type: 'text', isNullable: false},
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType }
          ],
        }),
        true,
      );
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('context_document')) {
        await queryRunner.dropTable('context_document', true, true, true);
    }
    if (await queryRunner.hasTable('vct_document')) {
        await queryRunner.dropTable('vct_document', true, true, true);
    }
  }
}
