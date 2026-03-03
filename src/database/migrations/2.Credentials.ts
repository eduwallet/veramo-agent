import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class Credentials1728382223150 implements MigrationInterface {
  name = 'Credentials1728382223150';

  async up(queryRunner: QueryRunner): Promise<void> {
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string

    await queryRunner.createTable(
        new Table({
          name: migrationGetTableName(queryRunner, 'credential'),
          columns: [
            { name: 'id', type: "int", isPrimary: true, isGenerated: true, generationStrategy: "increment" },
            { name: 'state', type: 'varchar', isPrimary: true },
            { name: 'holder', type: 'varchar', length: '2048', isNullable: false},
            { name: 'metadata', type: 'text', isNullable: true },
            { name: 'claims', type: 'text', isNullable: true },
            { name: 'statuslists', type: 'text', isNullable: true },
            { name: 'issuanceDate', type: dateTimeType },
            { name: 'expirationDate', type: dateTimeType, isNullable: true },
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType },
            { name: 'credpid', type: 'varchar', isNullable: true},
            { name: 'issuer', type: 'varchar', isNullable: true},
            { name: 'credentialId', type: 'varchar', isNullable: true},
            { name: 'uuid', type: 'varchar', isNullable: true}
          ],
        }),
        true,
      )
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('credential')) {
        await queryRunner.dropTable('credential', true, true, true);
    }
  }
}
