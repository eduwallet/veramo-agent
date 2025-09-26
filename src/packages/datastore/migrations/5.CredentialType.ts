import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class CredentialType1758699016150 implements MigrationInterface {
  name = 'CredentialType1758699016150';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string

    await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'credential_type'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'name', type: 'varchar', isNullable: false},
            { name: 'configuration', type: 'text', isNullable: false},
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType }
          ],
        }),
        true,
      )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('credential_type')) {
        await queryRunner.dropTable('credential_type', true, true, true);
    }
  }
}
