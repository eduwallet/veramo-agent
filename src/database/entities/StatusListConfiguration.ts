import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    BaseEntity,
    BeforeInsert,
    BeforeUpdate,
} from 'typeorm'

@Entity('statuslistconf')
export class StatusListConfiguration extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-expect-error has no initializer
    id: number;

    @Column('varchar')
    //@ts-expect-error has no initializer
    name: string

    @Column('text')
    //@ts-expect-error has no initializer
    tokens: string

    @Column('text')
    //@ts-expect-error has no initializer
    messages: string|null;

    @Column('int')
    //@ts-expect-error has no initializer
    size: number

    @Column('int')
    //@ts-expect-error has no initializer
    bitsize: number

    @Column('varchar')
    //@ts-expect-error has no initializer
    purpose: string

    @Column('varchar')
    //@ts-expect-error has no initializer
    type: string

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
