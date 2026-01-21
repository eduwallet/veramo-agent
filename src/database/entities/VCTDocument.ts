import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'

@Entity('vct_document')
export class VCTDocument extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-ignore
    id: number;

    @Column({ type: 'varchar'})
    // @ts-ignore
    name: string

    @Column('varchar')
    // @ts-ignore
    path: string

    @Column('text')
    // @ts-ignore
    credentials: string

    @Column('text')
    // @ts-ignore
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
    // @ts-ignore
    saveDate: Date

    @Column({ type: 'timestamp'})
    // @ts-ignore
    updateDate: Date
}
