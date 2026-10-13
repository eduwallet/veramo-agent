import { Entity, Column, PrimaryColumn, BaseEntity } from 'typeorm'
import { encrypt, decrypt } from '@futuretense/secret-box';
import { fromString, toString } from "uint8arrays";
import crypto from 'crypto';
import { resolvePassphraseKey } from '#root/database/privateKeyPassphrase';

@Entity('private-key')
export class PrivateKey extends BaseEntity {
    @PrimaryColumn('varchar')
    //@ts-expect-error has no initializer
    alias: string

    @Column('varchar')
    //@ts-expect-error has no initializer
    type: string

    @Column('varchar')
    //@ts-expect-error has no initializer
    privateKeyHex: string

    @Column('varchar')
    //@ts-expect-error has no initializer
    seed: string

    async decodeKey():Promise<string> {
        // a row with no seed predates encryption entirely (legacy plaintext row that was
        // never migrated); PASSPHRASE is otherwise required, so we only resolve it when
        // we actually need to decrypt
        if (!this.seed || this.seed.length == 0) {
            return this.privateKeyHex;
        }
        const passphraseKey = await resolvePassphraseKey();
        const seed = fromString(this.seed, 'hex');
        const encoded = fromString(this.privateKeyHex, 'hex');
        return toString(await decrypt(encoded, passphraseKey, seed, true), 'hex');
    }

    async encodeKey(key:string) {
        const passphraseKey = await resolvePassphraseKey();
        const seed = fromString(this.seed, 'hex');
        const secret = fromString(key, 'hex');
        this.privateKeyHex = toString(await encrypt(secret, passphraseKey, seed, true), 'hex');
    }

    setSeed() {
        this.seed = crypto.randomBytes(32).toString('hex');
    }
}
