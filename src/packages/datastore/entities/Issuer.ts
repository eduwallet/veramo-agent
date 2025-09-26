import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  BaseEntity,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from 'typeorm'
import { Key } from '#root/packages/datastore/index'

@Entity('issuer')
@Index(['did'], { unique: true })
export class Issuer extends BaseEntity {
    @PrimaryGeneratedColumn('increment')
    //@ts-ignore
    id: number;

    @Column('text')
    // @ts-ignore
    did: string

    @Column({ type: 'varchar'})
    // @ts-ignore
    name: string

    @Column({ type: 'text'})
    // @ts-ignore
    baseUrl: string

    @Column({ type: 'varchar'})
    // @ts-ignore
    adminToken: string

    @Column({ type: 'text', nullable: true})
    // @ts-ignore
    authorizationEndpoint?: string

    @Column({ type: 'text', nullable: true})
    // @ts-ignore
    tokenEndpoint?: string

    @Column({ type: 'text', nullable: true})
    // @ts-ignore
    clientId?: string

    @Column({ type: 'text', nullable: true})
    // @ts-ignore
    metadata?: string

    @Column({ type: 'text', nullable: true})
    // @ts-ignore
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
    // @ts-ignore
    saveDate: Date

    @Column({ type: 'timestamp'})
    // @ts-ignore
    updateDate: Date
}
