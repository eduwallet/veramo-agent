import Debug from 'debug';
const debug = Debug('issuer:db');
import { scryptSync } from 'crypto';
import { fromString } from 'uint8arrays';
import { decrypt } from '@futuretense/secret-box';
import { getDbConnection } from './databaseService.js';
import { PrivateKey } from './entities/PrivateKey.js';

// Production already relies on PASSPHRASE being exactly 32 raw bytes, used directly as
// AES-256-GCM key material: that cannot be changed without breaking the ability to decrypt
// private keys that are already encrypted under that raw key. But a PASSPHRASE of any other
// length cannot be used as raw key material at all (createCipheriv would just throw), so for
// any such value we derive a 32-byte key from it instead. And since an exactly-32-byte value
// could equally be an ordinary passphrase that merely happens to be 32 bytes long rather than
// deliberately-chosen raw key material, we do not assume which interpretation is right: we try
// the raw bytes first (today's behaviour) against an already-encrypted row, and only fall back
// to the KDF-derived key if that fails.
//
// A fixed, non-secret salt is used for the KDF: there is nowhere to persist a genuine
// per-installation salt without a migration, and a fixed, purpose-specific salt still prevents
// the derived key from being reusable for anything other than this one purpose.
const KDF_SALT = 'veramo-agent:private-key-passphrase:v1';

export function deriveKey(passphrase: Uint8Array): Uint8Array {
    return new Uint8Array(scryptSync(Buffer.from(passphrase), KDF_SALT, 32));
}

async function findEncryptedSample(): Promise<PrivateKey | null> {
    const dbConnection = await getDbConnection();
    const repo = dbConnection.getRepository(PrivateKey);
    const rows = await repo.createQueryBuilder('private-key')
        .where('"seed" is not null')
        .andWhere('"seed" <> \'\'')
        .limit(1)
        .getMany();
    return rows[0] ?? null;
}

async function canDecrypt(sample: PrivateKey, key: Uint8Array): Promise<boolean> {
    try {
        const seed = fromString(sample.seed, 'hex');
        const encoded = fromString(sample.privateKeyHex, 'hex');
        await decrypt(encoded, key, seed, true);
        return true;
    }
    catch (e) {
        debug("candidate passphrase key could not decrypt the sample row", e);
        return false;
    }
}

let resolution: Promise<Uint8Array> | undefined;

/*
 * Resolves the PASSPHRASE environment variable to the actual AES-256 key material to use for
 * encrypting/decrypting private keys, and caches the result in memory for the lifetime of the
 * process: this is evaluated once (lazily, on first use), not on every encode/decode call.
 *
 * All current installations have PASSPHRASE configured, so this is required: an unset or
 * empty PASSPHRASE is a misconfiguration and rejects immediately, rather than silently
 * falling back to storing/reading private keys as plaintext.
 */
export function resolvePassphraseKey(): Promise<Uint8Array> {
    if (!resolution) {
        resolution = doResolvePassphraseKey();
    }
    return resolution;
}

async function doResolvePassphraseKey(): Promise<Uint8Array> {
    const passphrase = process.env.PASSPHRASE ?? '';
    if (passphrase.length == 0) {
        throw new Error("PASSPHRASE environment variable must be set");
    }

    const raw = fromString(passphrase);
    const candidates = raw.length == 32 ? [raw, deriveKey(raw)] : [deriveKey(raw)];

    const sample = await findEncryptedSample();
    if (!sample) {
        // nothing encrypted yet to validate against (fresh install): use the preferred
        // interpretation (raw bytes when that is a valid key length, matching today's
        // behaviour; otherwise the derived key, since raw bytes of any other length are
        // not usable as an AES-256 key at all)
        debug("no previously encrypted private key found, using preferred passphrase interpretation unvalidated");
        return candidates[0];
    }

    for (const candidate of candidates) {
        if (await canDecrypt(sample, candidate)) {
            return candidate;
        }
    }

    throw new Error("PASSPHRASE does not match previously encrypted private keys");
}

/*
 * Test-only: clears the cached resolution so a different PASSPHRASE can be exercised within
 * the same process.
 */
export function resetPassphraseKeyCacheForTests() {
    resolution = undefined;
}
