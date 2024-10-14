
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
        await queryRunner.addColumn(
            this.getTableName(queryRunner, 'credential'),
            new TableColumn({ name: 'credpid', type: 'varchar', isNullable: true})
        )
    }

    async down(queryRunner: QueryRunner): Promise<void>
    {
        if (await queryRunner.hasColumn(this.getTableName(queryRunner, 'credential'), 'credpid')) {
            await queryRunner.dropColumn(this.getTableName(queryRunner, 'credential'), 'credpid');
        }
    }
}
