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
    //@ts-expect-error has no initializer
    id: number;
    
    @Column('varchar')
    //@ts-expect-error has no initializer
    uuid: string

    @Column('varchar')
    // the original issuer state used to issue this credential
    //@ts-expect-error has no initializer
    state: string

    @Column('varchar')
    // the current revocation state of the credential
    //@ts-expect-error has no initializer
    status: string

    @Column('varchar')
    // principal id by which this credential is known
    //@ts-expect-error has no initializer
    credpid: string

    @Column('varchar')
    // did representation of the holder key
    //@ts-expect-error has no initializer
    holder: string

    @Column('varchar')
    // representation of holder key as defined by the wallet
    //@ts-expect-error has no initializer
    original_holder: string

    @Column('varchar')
    // configured name of the issuer
    //@ts-expect-error has no initializer
    issuer: string

    @Column('varchar')
    // configured type of the credential
    //@ts-expect-error has no initializer
    credentialId: string

    @Column({ type: 'simple-json' })
    //@ts-expect-error has no initializer
    metadata: StringKeyedObject;

    @Column({ type: 'simple-json' })
    //@ts-expect-error has no initializer
    claims: StringKeyedObject

    @Column({ type: 'simple-json', nullable: true })
    statuslists?: StringKeyedObject | StringKeyedObject[];

    @Column('timestamp')
    //@ts-expect-error has no initializer
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
    //@ts-expect-error has no initializer
    saveDate: Date

    @Column({ type: 'timestamp', select: true })
    //@ts-expect-error has no initializer
    updateDate: Date
}
