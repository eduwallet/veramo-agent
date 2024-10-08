import {
    Entity,
    Column,
    Connection,
    PrimaryColumn,
    BaseEntity,
    OneToMany,
    ManyToMany,
    Index,
    BeforeInsert,
    BeforeUpdate,
  } from 'typeorm'
  import { Key } from './Key'
  
  /**
   * Represents some properties and relationships of an {@link @veramo/core#IIdentifier} that are stored in a TypeORM
   * database for the purpose of keeping track of keys and services associated with a DID managed by a Veramo agent.
   *
   * @see {@link @veramo/data-store#DIDStore | DIDStore} for the implementation used by the
   *   {@link @veramo/did-manager#DIDManager | DIDManager}.
   * @see {@link @veramo/data-store#DataStoreORM | DataStoreORM} for the implementation of the query interface.
   *
   * @beta This API may change without a BREAKING CHANGE notice.
   */
  @Entity('identifier')
  @Index(['alias', 'provider'], { unique: true })
  export class Identifier extends BaseEntity {
    @PrimaryColumn('varchar')
      //@ts-ignore
    did: string
  
    @Column({ type: 'varchar', nullable: true })
      //@ts-ignore
    provider?: string
  
    @Column({ type: 'varchar', nullable: true })
      //@ts-ignore
    alias?: string
  
    @BeforeInsert()
    setSaveDate() {
      this.saveDate = new Date()
      this.updateDate = new Date()
    }
  
    @BeforeUpdate()
    setUpdateDate() {
      this.updateDate = new Date()
    }
  
    @Column({ type: 'date', select: false })
      //@ts-ignore
    saveDate: Date
  
    @Column({ type: 'date', select: false })
      //@ts-ignore
    updateDate: Date
  
    @Column({ type: 'varchar', nullable: true })
      //@ts-ignore
    controllerKeyId?: string
  
    @OneToMany((type) => Key, (key:Key) => key.identifier)
      //@ts-ignore
    keys: Key[]
  
    shortDid() {
      return `${this.did.slice(0, 15)}...${this.did.slice(-4)}`
    }
  }
  