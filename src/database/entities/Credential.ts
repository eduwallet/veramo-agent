import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    BaseEntity,
    BeforeInsert,
    BeforeUpdate,
} from 'typeorm'

export interface Metadata {
    [x:string]: any
}

export interface Claims {
    [x:string]: any
};

export interface StatusLists {
    [x:string]: any;
}

@Entity('credential')
export class Credential extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-ignore
    id: number;
    
    @Column('varchar')
    //@ts-ignore
    state: string

    @Column('varchar')
    //@ts-ignore
    holder: string

    @Column({ type: 'simple-json' })
    //@ts-ignore
    metadata: Metadata

    @Column({ type: 'simple-json' })
    //@ts-ignore
    claims: Claims

    @Column({ type: 'simple-json', nullable: true })
    //@ts-ignore
    statuslists?: StatusLists

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
