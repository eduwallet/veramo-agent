import moment from 'moment';
import { createUniqueId } from '#root/utils/createUniqueId';
import { getDbConnection } from '#root/database/databaseService';
import { Session } from '#root/packages/datastore/entities/Session';
import { LessThan } from 'typeorm';

export class SessionStateManager {
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
        const repo = dbConnection.getRepository(Session);
        await repo.delete({uuid: id, issuer: this.issuer});
    }

    public async get(id:string, callbackIfNotFound?:Function):Promise<Session> {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Session);
        let session = await repo.findOneBy({uuid: id, issuer: this.issuer});

        if (!session) {
            session = this.newState();
            session.data = {};
            if (callbackIfNotFound) {
                session.data = callbackIfNotFound(session.data);
            }
        }
        return session;
    }

    public async getByState(id:string):Promise<Session|null>
    {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Session);
        return await repo.findOneBy({state: id, issuer: this.issuer});
    }

    public async set(state:Session)
    {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Session);
        await repo.save(state);
    }

    public newState():Session {
        const session = new Session();
        session.issuer = this.issuer;
        session.uuid = createUniqueId();
        session.expirationDate = moment().add(4, 'hours').toDate();
        return session;
    }

    public async clearAll()
    {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(Session);
        await repo.delete({
            expirationDate: LessThan(new Date()),
            issuer: this.issuer
        });
    }
}