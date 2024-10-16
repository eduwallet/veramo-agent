import { MigrationInterface, QueryRunner, Table } from 'typeorm'
import { debug } from 'utils/logger';

export class M20241008_cleanup1728382223149 implements MigrationInterface {
  async up(queryRunner: QueryRunner): Promise<void> {
    debug("running cleanup migration");
    if (await queryRunner.hasTable('message_credentials_credential')) {
        await queryRunner.dropTable('message_credentials_credential', true, true, true);
    }
    if (await queryRunner.hasTable('message_presentations_presentation')) {
        await queryRunner.dropTable('message_presentations_presentation', true, true, true);
    }
    if (await queryRunner.hasTable('presentation_credentials_credential')) {
        await queryRunner.dropTable('presentation_credentials_credential', true, true, true);
    }
    if (await queryRunner.hasTable('presentation_verifier_identifier')) {
        await queryRunner.dropTable('presentation_verifier_identifier', true, true, true);
    }
    if (await queryRunner.hasTable('claim')) {
        await queryRunner.dropTable('claim', true, true, true);
    }
    if (await queryRunner.hasTable('keyvaluestore')) {
        await queryRunner.dropTable('keyvaluestore', true, true, true);
    }
    if (await queryRunner.hasTable('message')) {
        await queryRunner.dropTable('message', true, true, true);
    }
    if (await queryRunner.hasTable('presentation')) {
        await queryRunner.dropTable('presentation', true, true, true);
    }
    if (await queryRunner.hasTable('credential')) {
        await queryRunner.dropTable('credential', true, true, true);
    }
  }

  async down(queryRunner: QueryRunner): Promise<void> {
    throw new Error('illegal_operation: cannot roll back cleanup migration')
  }
}
