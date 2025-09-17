import { StringKeyedObject } from '#root/types/index';
import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    BaseEntity,
    BeforeInsert,
    BeforeUpdate,
} from 'typeorm'

@Entity('credential')
export class Credential extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-ignore
    id: number;
    
    @Column('varchar')
    //@ts-ignore
    uuid: string

    @Column('varchar')
    //@ts-ignore
    state: string

    @Column('varchar')
    //@ts-ignore
    credpid: string

    @Column('varchar')
    //@ts-ignore
    holder: string

    @Column('varchar')
    //@ts-ignore
    issuer: string

    @Column('varchar')
    //@ts-ignore
    credentialId: string

    @Column({ type: 'simple-json' })
    //@ts-ignore
    metadata: StringKeyedObject;

    @Column({ type: 'simple-json' })
    //@ts-ignore
    claims: StringKeyedObject

    @Column({ type: 'simple-json', nullable: true })
    //@ts-ignore
    statuslists?: StringKeyedObject

    @Column('timestamp')
    //@ts-ignore
    issuanceDate: Date

    @Column({ type: 'timestamp', nullable: true })
    expirationDate?: Date

    @BeforeInsert()
    setSaveDate() {
        this.saveDate = new Date()
        this.updateDate = new Date()
    }

    @BeforeUpdate()
    setUpdateDate() {
        this.updateDate = new Date()
    }

    @Column({ type: 'timestamp', select: false })
        //@ts-ignore
    saveDate: Date

    @Column({ type: 'timestamp', select: false })
        //@ts-ignore
    updateDate: Date
}
