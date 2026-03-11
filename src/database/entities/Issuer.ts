import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'

@Entity('issuer')
@Index(['did'], { unique: true })
export class Issuer extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-expect-error has no initializer
    id: number;

    @Column('text')
    //@ts-expect-error has no initializer
    did: string

    @Column({ type: 'varchar'})
    //@ts-expect-error has no initializer
    name: string

    @Column({ type: 'text'})
    //@ts-expect-error has no initializer
    baseUrl: string

    @Column({ type: 'varchar'})
    //@ts-expect-error has no initializer
    adminToken: string

    @Column({ type: 'text', nullable: true})
    authorizationEndpoint?: string

    @Column({ type: 'text', nullable: true})
    tokenEndpoint?: string

    @Column({ type: 'text', nullable: true})
    clientId?: string

    @Column({ type: 'text', nullable: true})
    clientSecret?: string

    @Column({ type: 'text', nullable: true})
    metadata?: string

    @Column({ type: 'text', nullable: true})
    statuslists?: string

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
