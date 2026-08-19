import {
    Entity,
    Column,
    PrimaryGeneratedColumn,
    BaseEntity,
    BeforeInsert,
    BeforeUpdate,
} from 'typeorm'

@Entity('statuslist')
export class StatusList extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-expect-error has no initializer
    id: number;

    @Column('varchar')
    //@ts-expect-error has no initializer
    name: string

    @Column('int')
    //@ts-expect-error has no initializer
    index: number

    @Column('int')
    //@ts-expect-error has no initializer
    size: number

    @Column('int')
    //@ts-expect-error has no initializer
    used: number

    @Column({type: 'int', nullable:true})
    bitsize?: number

    @Column('text')
    //@ts-expect-error has no initializer
    content: string

    @Column('text')
    //@ts-expect-error has no initializer
    revoked: string

    @Column({type: 'timestamp', nullable: true})
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
