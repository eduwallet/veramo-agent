import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class Issuer1758281913150 implements MigrationInterface {
  name = 'Issuer1758281913150';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string

    await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'issuer'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'name', type: 'varchar', isNullable: false},
            { name: 'did', type: 'text', isNullable: false},
            { name: 'adminToken', type: 'varchar', isNullable: false },
            { name: 'baseUrl', type: 'text', isNullable: false },
            { name: 'authorizationEndpoint', type: 'text', isNullable: true },
            { name: 'tokenEndpoint', type: 'text', isNullable: true },
            { name: 'clientId', type: 'text', isNullable: true },
            { name: 'metadata', type: 'text', isNullable: true },
            { name: 'statuslists', type: 'text', isNullable: true },
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType }
          ],
        }),
        true,
      )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('issuer')) {
        await queryRunner.dropTable('issuer', true, true, true);
    }
  }
}
