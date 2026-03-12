import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'

@Entity('credential_type')
@Index(['name'], { unique: true })
export class CredentialType extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-expect-error has no initializer
    id: number;

    @Column('text')
    //@ts-expect-error has no initializer
    configuration: string

    @Column({ type: 'varchar'})
    //@ts-expect-error has no initializer
    name: string

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
