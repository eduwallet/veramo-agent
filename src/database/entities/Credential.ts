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
    // the original issuer state used to issue this credential
    state: string

    @Column('varchar')
    //@ts-ignore
    // the current revocation state of the credential
    status: string

    @Column('varchar')
    //@ts-ignore
    // principal id by which this credential is known
    credpid: string

    @Column('varchar')
    //@ts-ignore
    // did representation of the holder key
    holder: string

    @Column('varchar')
    //@ts-ignore
    // representation of holder key as defined by the wallet
    original_holder: string

    @Column('varchar')
    //@ts-ignore
    // configured name of the issuer
    issuer: string

    @Column('varchar')
    //@ts-ignore
    // configured type of the credential
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

    @Column({ type: 'timestamp', select: true })
        //@ts-ignore
    saveDate: Date

    @Column({ type: 'timestamp', select: true })
        //@ts-ignore
    updateDate: Date
}
