import { KeyMetadata, TKeyType } from '@veramo/core'
import { Entity, Column, PrimaryColumn, BaseEntity, ManyToOne } from 'typeorm'
import { Identifier } from './Identifier'

/**
 * Mirrors {@link @veramo/core#TKeyType | TKeyType}
 *
 * @beta - This API may change without a BREAKING CHANGE notice.
 */
export type KeyType = TKeyType

/**
 * Represents some properties of a {@link @veramo/core#IKey | IKey} that are stored in a TypeORM
 * database for the purpose of keeping track of the {@link @veramo/key-manager#AbstractKeyManagementSystem}
 * implementations and the keys they are able to use.
 *
 * @see {@link @veramo/data-store#KeyStore | KeyStore} for the implementation used by the
 *   {@link @veramo/key-manager#KeyManager | KeyManager}.
 *
 * @beta This API may change without a BREAKING CHANGE notice.
 */
@Entity('key')
export class Key extends BaseEntity {
  @PrimaryColumn('varchar')
    //@ts-ignore
  kid: string

  @Column('varchar')
    //@ts-ignore
  kms: string

  @Column('varchar')
    //@ts-ignore
  type: KeyType

  @Column('varchar')
    //@ts-ignore
  publicKeyHex: string

  @Column({
    type: 'json',
    nullable: true,
    transformer: {
      to: (value: any): KeyMetadata | null => {
        return value
      },
      from: (value: KeyMetadata | null): object | null => {
        return value
      },
    },
  })
  meta?: KeyMetadata | null

  @ManyToOne((type) => Identifier, (identifier) => identifier?.keys, { onDelete: 'CASCADE' })
    //@ts-ignore
  identifier?: Identifier
}
