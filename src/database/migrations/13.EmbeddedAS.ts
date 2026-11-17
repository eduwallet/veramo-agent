import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class EmbeddedAS1792000000000 implements MigrationInterface {
  name = 'EmbeddedAS1792000000000';
  public transaction = false;

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn(migrationGetTableName(queryRunner, 'issuer'), 'embeddedAuthorizationServer')) {
      await queryRunner.addColumn(
          migrationGetTableName(queryRunner, 'issuer'),
          new TableColumn({ name: 'embeddedAuthorizationServer', type: 'text', isNullable: true})
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn(migrationGetTableName(queryRunner, 'issuer'), 'embeddedAuthorizationServer')) {
      await queryRunner.dropColumn(migrationGetTableName(queryRunner, 'issuer'), 'embeddedAuthorizationServer');
    }
  }
}
