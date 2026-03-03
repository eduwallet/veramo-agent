import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    BaseEntity,
    BeforeInsert,
} from 'typeorm'

@Entity('nonce')
export class Nonce extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-ignore
    id: number;
    
    @Column('varchar')
    //@ts-ignore
    uuid: string

    @Column('varchar')
    //@ts-ignore
    session: string

    @Column('varchar')
    //@ts-ignore
    issuer: string

    @Column({ type: 'timestamp', nullable: true })
    expirationDate?: Date

    @BeforeInsert()
    setSaveDate() {
        this.saveDate = new Date()
    }


    @Column({ type: 'timestamp', select: false })
        //@ts-ignore
    saveDate: Date
}
