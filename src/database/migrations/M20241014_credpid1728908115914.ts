
import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm'

export class M20241014_credpid1728908115914 implements MigrationInterface {
    getTableName(queryRunner:QueryRunner, givenName: string): string {
        return (
            queryRunner.connection.entityMetadatas.find((meta) => meta.givenTableName === givenName)?.tableName ||
            givenName
        )
    }

    async up(queryRunner: QueryRunner): Promise<void>
    {
        if (!await queryRunner.hasColumn(this.getTableName(queryRunner, 'credential'), 'credpid')) {
            await queryRunner.addColumn(
                this.getTableName(queryRunner, 'credential'),
                new TableColumn({ name: 'credpid', type: 'varchar', isNullable: true})
            );
        }
        if (!await queryRunner.hasColumn(this.getTableName(queryRunner, 'credential'), 'issuer')) {
            await queryRunner.addColumn(
                this.getTableName(queryRunner, 'credential'),
                new TableColumn({ name: 'issuer', type: 'varchar', isNullable: true})
            );
        }
        if (!await queryRunner.hasColumn(this.getTableName(queryRunner, 'credential'), 'credentialId')) {
            await queryRunner.addColumn(
                this.getTableName(queryRunner, 'credential'),
                new TableColumn({ name: 'credentialId', type: 'varchar', isNullable: true})
            );
        }
    }

    async down(queryRunner: QueryRunner): Promise<void>
    {
        if (await queryRunner.hasColumn(this.getTableName(queryRunner, 'credential'), 'credpid')) {
            await queryRunner.dropColumn(this.getTableName(queryRunner, 'credential'), 'credpid');
        }
        if (await queryRunner.hasColumn(this.getTableName(queryRunner, 'credential'), 'issuer')) {
            await queryRunner.dropColumn(this.getTableName(queryRunner, 'credential'), 'issuer');
        }
        if (await queryRunner.hasColumn(this.getTableName(queryRunner, 'credential'), 'credentialId')) {
            await queryRunner.dropColumn(this.getTableName(queryRunner, 'credential'), 'credentialId');
        }
    }
}
