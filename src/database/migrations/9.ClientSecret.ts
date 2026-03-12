import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class ClientSecret1764064638150 implements MigrationInterface {
  name = 'ClientSecret1764064638150';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn(migrationGetTableName(queryRunner, 'issuer'), 'clientSecret')) {
      await queryRunner.addColumn(
          migrationGetTableName(queryRunner, 'issuer'),
          new TableColumn({ name: 'clientSecret', type: 'varchar', isNullable: true})
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn(migrationGetTableName(queryRunner, 'issuer'), 'clientSecret')) {
      await queryRunner.dropColumn(migrationGetTableName(queryRunner, 'issuer'), 'clientSecret');
    }
  }
}
