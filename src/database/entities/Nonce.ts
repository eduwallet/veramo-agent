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
    //@ts-expect-error has no initializer
    id: number;
    
    @Column('varchar')
    //@ts-expect-error has no initializer
    uuid: string

    @Column('varchar')
    //@ts-expect-error has no initializer
    session: string

    @Column('varchar')
    //@ts-expect-error has no initializer
    issuer: string

    @Column({ type: 'timestamp', nullable: true })
    expirationDate?: Date

    @BeforeInsert()
    setSaveDate() {
        this.saveDate = new Date()
    }

    @Column({ type: 'timestamp', select: false })
    //@ts-expect-error has no initializer
    saveDate: Date
}
