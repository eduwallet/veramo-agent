import moment from 'moment';
import { createUniqueId } from '#root/utils/createUniqueId';
import { getDbConnection } from '#root/database/databaseService';
import { Nonce } from '#root/packages/datastore/entities/Nonce';
import { LessThan } from 'typeorm';

export class NonceManager {
    private issuer:string = '';

    public constructor(issuer:string)
    {
        this.issuer = issuer;
    }

    public async clear(id: string) {
        if (!id) {
            throw Error('No state id supplied');
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
}