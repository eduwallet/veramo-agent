import moment from 'moment';
import { createUniqueId } from '#root/utils/createUniqueId';
import { getDbConnection } from '#root/database/databaseService';
import { Nonce } from '#root/database/entities/index';
import { LessThan } from 'typeorm';

export class NonceManager {
    private issuer:string = '';

    public constructor(issuer:string)
    {
        this.issuer = issuer;
    }

    public async clear(id: string) {
        if (!id) {
            console.error('No state id supplied');
            return;
        }
        
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Nonce);
        await repo.delete({uuid: id, issuer: this.issuer});
    }

    public async get(id:string, defaultData?:any):Promise<Nonce> {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Nonce);
        let nonce = await repo.findOneBy({uuid: id, issuer: this.issuer});

        if (!nonce) {
            nonce = new Nonce();
            nonce.issuer = this.issuer;
            nonce.uuid = defaultData?.uuid ?? createUniqueId();
            nonce.session = defaultData?.session ?? '';
            nonce.expirationDate = defaultData?.expirationDate ?? moment().add(4, 'hours').toDate();
            await repo.save(nonce);
        }
        return nonce;
    }

    public async clearAll()
    {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Nonce);
        await repo.delete({
            expirationDate: LessThan(new Date()),
            issuer: this.issuer
        });
    }

    // Claims an id if, and only if, it has not been claimed before. Used for one-time
    // use identifiers (e.g. DPoP proof jti values) where re-use must be detected.
    // Returns false if the id was already claimed (replay).
    //
    // This relies on the unique index on (uuid, issuer): a find-then-insert pattern
    // would let two concurrent requests for the same id both see "not claimed yet"
    // before either writes, defeating single-use enforcement. INSERT ... ON CONFLICT
    // DO NOTHING is Postgres-specific (not standard SQL), which matches this project's
    // only supported database driver.
    public async claim(id: string, expirationDate: Date): Promise<boolean> {
        if (!id) {
            return false;
        }

        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Nonce);
        const result = await repo.createQueryBuilder()
            .insert()
            .into(Nonce)
            .values({
                issuer: this.issuer,
                uuid: id,
                session: '',
                expirationDate,
                saveDate: new Date(),
            })
            .orIgnore()
            .execute();

        return (result.identifiers?.length ?? 0) > 0;
    }

    // Validates and atomically consumes a client-supplied c_nonce: unlike get(), this
    // never creates a record on a miss (a nonce that was never issued by us must be
    // rejected, not silently accepted), and it removes the record as part of the same
    // statement so two concurrent requests for the same nonce cannot both succeed
    // (a separate find-then-delete would leave a race between them).
    // Returns null if the nonce does not exist or has expired.
    public async consumeCNonce(id: string): Promise<{ uuid: string; session: string } | null> {
        if (!id) {
            return null;
        }

        const row = await this.deleteAndReturnRow(id);
        if (!row) {
            return null;
        }
        if (row.expirationDate && new Date(row.expirationDate) < new Date()) {
            return null;
        }
        return { uuid: row.uuid, session: row.session };
    }

    // Consumes (validates and removes) a previously issued, single-use id.
    // Returns false if the id does not exist or has expired.
    public async consume(id: string): Promise<boolean> {
        if (!id) {
            return false;
        }

        const row = await this.deleteAndReturnRow(id);
        if (!row) {
            return false;
        }
        return !row.expirationDate || new Date(row.expirationDate) >= new Date();
    }

    // Atomically deletes and returns the (single) row matching this id, or null if no
    // such row exists. A DELETE on an existing row is inherently race-free under
    // Postgres' row-level locking: of several concurrent deletes targeting the same
    // row, only one can actually remove it, so only one caller ever gets it back.
    // DELETE ... RETURNING is Postgres-specific (not standard SQL), which matches this
    // project's only supported database driver.
    private async deleteAndReturnRow(id: string): Promise<any | null> {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Nonce);
        const result = await repo.createQueryBuilder()
            .delete()
            .from(Nonce)
            .where('uuid = :id and issuer = :issuer', { id, issuer: this.issuer })
            .returning('*')
            .execute();

        return result.raw?.[0] ?? null;
    }
}