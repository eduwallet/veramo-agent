import { MigrationInterface, QueryRunner, Table, TableColumn } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class CredStatus1761663603150 implements MigrationInterface {
  name = 'CredStatus1761663603150';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn(migrationGetTableName(queryRunner, 'credential'), 'status')) {
      await queryRunner.addColumn(
          migrationGetTableName(queryRunner, 'credential'),
          new TableColumn({ name: 'status', type: 'varchar', isNullable: true})
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn(migrationGetTableName(queryRunner, 'credential'), 'status')) {
      await queryRunner.dropColumn(migrationGetTableName(queryRunner, 'credential'), 'status');
    }
  }
}
