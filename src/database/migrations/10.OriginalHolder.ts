import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'
import { migrationGetTableName } from './migration-functions.js'

export class OriginalHolder1769001656333 implements MigrationInterface {
  name = 'OriginalHolder1769001656333';

  async up(queryRunner: QueryRunner): Promise<void> {
    if (!await queryRunner.hasColumn(migrationGetTableName(queryRunner, 'credential'), 'original_holder')) {
      await queryRunner.addColumn(
          migrationGetTableName(queryRunner, 'credential'),
          new TableColumn({ name: 'original_holder', type: 'varchar', isNullable: true})
      );
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasColumn(migrationGetTableName(queryRunner, 'credential'), 'original_holder')) {
      await queryRunner.dropColumn(migrationGetTableName(queryRunner, 'credential'), 'original_holder');
    }
  }
}
