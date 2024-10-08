import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import { debug } from '@utils/logger';

export class M20241008_credentials1728382223150 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    function getTableName(givenName: string): string {
        return (
            queryRunner.connection.entityMetadatas.find((meta) => meta.givenTableName === givenName)?.tableName ||
            givenName
        )
    }
  
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string

    await queryRunner.createTable(
        new Table({
          name: getTableName('credential'),
          columns: [
            { name: 'uuid', type: 'varchar', isPrimary: true },
            { name: 'holder', type: 'varchar', length: '2048', isNullable: false},
            { name: 'metadata', type: 'text', isNullable: true },
            { name: 'claims', type: 'text', isNullable: true },
            { name: 'statuslists', type: 'text', isNullable: true },
            { name: 'issuanceDate', type: dateTimeType },
            { name: 'expirationDate', type: dateTimeType, isNullable: true },
            { name: 'saveDate', type: dateTimeType },
            { name: 'updateDate', type: dateTimeType },
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
