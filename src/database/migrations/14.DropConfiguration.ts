import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

/**
 * Configuration (issuers, credential types, context documents and vct documents) is no
 * longer stored in the database, it is read from the configuration files only.
 */
export class DropConfiguration1793000000000 implements MigrationInterface {
  name = 'DropConfiguration1793000000000';

  async up(queryRunner: QueryRunner): Promise<void> {
    for (const name of ['issuer', 'credential_type', 'context_document', 'vct_document']) {
      const tableName = migrationGetTableName(queryRunner, name);
      if (await queryRunner.hasTable(tableName)) {
        await queryRunner.dropTable(tableName, true, true, true);
      }
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    const dateTimeType: string = queryRunner.connection.driver.mappedDataTypes.createDate as string
    const id = { name: 'id', type: 'int', isPrimary: true, isGenerated: true, generationStrategy: 'increment' } as const;
    const dates = [{ name: 'saveDate', type: dateTimeType }, { name: 'updateDate', type: dateTimeType }];

    await queryRunner.createTable(new Table({
      name: 'issuer',
      columns: [
        id,
        { name: 'name', type: 'varchar', isNullable: false },
        { name: 'did', type: 'text', isNullable: false },
        { name: 'adminToken', type: 'varchar', isNullable: false },
        { name: 'baseUrl', type: 'text', isNullable: false },
        { name: 'authorizationEndpoint', type: 'text', isNullable: true },
        { name: 'tokenEndpoint', type: 'text', isNullable: true },
        { name: 'clientId', type: 'text', isNullable: true },
        { name: 'clientSecret', type: 'varchar', isNullable: true },
        { name: 'metadata', type: 'text', isNullable: true },
        { name: 'statuslists', type: 'text', isNullable: true },
        { name: 'embeddedAuthorizationServer', type: 'text', isNullable: true },
        ...dates
      ],
    }), true);
    await queryRunner.createTable(new Table({
      name: 'credential_type',
      columns: [
        id,
        { name: 'name', type: 'varchar', isNullable: false },
        { name: 'configuration', type: 'text', isNullable: false },
        ...dates
      ],
    }), true);
    await queryRunner.createTable(new Table({
      name: 'context_document',
      columns: [
        id,
        { name: 'name', type: 'varchar', isNullable: false },
        { name: 'path', type: 'varchar', length: '1024', isNullable: false },
        { name: 'document', type: 'text', isNullable: false },
        ...dates
      ],
    }), true);
    await queryRunner.createTable(new Table({
      name: 'vct_document',
      columns: [
        id,
        { name: 'name', type: 'varchar', isNullable: false },
        { name: 'path', type: 'varchar', length: '1024', isNullable: false },
        { name: 'credentials', type: 'text', isNullable: false },
        { name: 'document', type: 'text', isNullable: false },
        ...dates
      ],
    }), true);
  }
}
