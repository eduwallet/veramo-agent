import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'

@Entity('context_document')
export class ContextDocument extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-expect-error has no initializer
    id: number;

    @Column({ type: 'varchar'})
    //@ts-expect-error has no initializer
    name: string

    @Column('varchar')
    //@ts-expect-error has no initializer
    path: string

    @Column('text')
    //@ts-expect-error has no initializer
    document: string

    @BeforeInsert()
    setSaveDate() {
        this.saveDate = new Date()
        this.updateDate = new Date()
    }

    @BeforeUpdate()
    setUpdateDate() {
        this.updateDate = new Date()
    }

    @Column({ type: 'timestamp'})
    //@ts-expect-error has no initializer
    saveDate: Date

    @Column({ type: 'timestamp'})
    //@ts-expect-error has no initializer
    updateDate: Date
}
