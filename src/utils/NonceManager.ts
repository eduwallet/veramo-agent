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
    public async claim(id: string, expirationDate: Date): Promise<boolean> {
        if (!id) {
            return false;
        }

        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Nonce);
        const existing = await repo.findOneBy({ uuid: id, issuer: this.issuer });
        if (existing) {
            return false;
        }

        const nonce = new Nonce();
        nonce.issuer = this.issuer;
        nonce.uuid = id;
        nonce.session = '';
        nonce.expirationDate = expirationDate;
        await repo.save(nonce);
        return true;
    }

    // Consumes (validates and removes) a previously issued, single-use id.
    // Returns false if the id does not exist or has expired.
    public async consume(id: string): Promise<boolean> {
        if (!id) {
            return false;
        }

        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Nonce);
        const existing = await repo.findOneBy({ uuid: id, issuer: this.issuer });
        if (!existing) {
            return false;
        }
        await repo.delete({ uuid: id, issuer: this.issuer });
        return !existing.expirationDate || existing.expirationDate >= new Date();
    }
}