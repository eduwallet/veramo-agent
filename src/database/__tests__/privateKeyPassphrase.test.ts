import { vi, expect, test, beforeEach, afterEach } from 'vitest';
import { encrypt } from '@futuretense/secret-box';
import { fromString, toString } from 'uint8arrays';
import { getDbConnection } from '../databaseService.js';
import { resolvePassphraseKey, resetPassphraseKeyCacheForTests, deriveKey } from '../privateKeyPassphrase.js';

let rows: any[] = [];

const mockQueryBuilder = {
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    getMany: vi.fn(() => Promise.resolve(rows)),
};

const mockRepo = {
    createQueryBuilder: () => mockQueryBuilder,
};

beforeEach(() => {
    rows = [];
    mockQueryBuilder.where.mockClear();
    mockQueryBuilder.andWhere.mockClear();
    mockQueryBuilder.limit.mockClear();
    mockQueryBuilder.getMany.mockClear();
    resetPassphraseKeyCacheForTests();
    vi.mocked(getDbConnection).mockResolvedValue({
        getRepository: () => mockRepo,
    } as any);
});

afterEach(() => {
    delete process.env.PASSPHRASE;
});

test('no PASSPHRASE configured is a misconfiguration, not a silent plaintext fallback', async () => {
    delete process.env.PASSPHRASE;
    await expect(resolvePassphraseKey()).rejects.toThrow(/PASSPHRASE environment variable must be set/);
});

test('a fresh install with no encrypted rows uses the raw 32-byte PASSPHRASE unvalidated', async () => {
    process.env.PASSPHRASE = '01234567890123456789012345678901'; // exactly 32 bytes
    const key = await resolvePassphraseKey();
    expect(key).toEqual(fromString(process.env.PASSPHRASE));
});

test('a fresh install with no encrypted rows derives a key for a non-32-byte PASSPHRASE', async () => {
    process.env.PASSPHRASE = 'not-32-bytes-long';
    const key = await resolvePassphraseKey();
    expect(key).toEqual(deriveKey(fromString(process.env.PASSPHRASE)));
});

test('a 32-byte PASSPHRASE that was actually used as raw key material is accepted as-is', async () => {
    const passphrase = '01234567890123456789012345678901';
    process.env.PASSPHRASE = passphrase;
    const raw = fromString(passphrase);
    const seed = new Uint8Array(12);
    const encoded = await encrypt(fromString('deadbeef', 'hex'), raw, seed, true);
    rows = [{ seed: toString(seed, 'hex'), privateKeyHex: toString(encoded, 'hex') }];

    const key = await resolvePassphraseKey();
    expect(key).toEqual(raw);
});

test('a 32-byte PASSPHRASE that was actually meant as a passphrase falls back to the derived key', async () => {
    const passphrase = '01234567890123456789012345678901';
    process.env.PASSPHRASE = passphrase;
    const raw = fromString(passphrase);
    const derived = deriveKey(raw);
    const seed = new Uint8Array(12);
    // encrypted with the DERIVED key, not the raw bytes
    const encoded = await encrypt(fromString('deadbeef', 'hex'), derived, seed, true);
    rows = [{ seed: toString(seed, 'hex'), privateKeyHex: toString(encoded, 'hex') }];

    const key = await resolvePassphraseKey();
    expect(key).toEqual(derived);
});

test('a PASSPHRASE that matches neither interpretation throws instead of silently mis-resolving', async () => {
    process.env.PASSPHRASE = '01234567890123456789012345678901';
    const seed = new Uint8Array(12);
    const otherKey = deriveKey(fromString('some other passphrase entirely'));
    const encoded = await encrypt(fromString('deadbeef', 'hex'), otherKey, seed, true);
    rows = [{ seed: toString(seed, 'hex'), privateKeyHex: toString(encoded, 'hex') }];

    await expect(resolvePassphraseKey()).rejects.toThrow(/does not match/);
});

test('the resolution is only computed once and cached in memory', async () => {
    process.env.PASSPHRASE = '01234567890123456789012345678901';
    const first = await resolvePassphraseKey();
    const second = await resolvePassphraseKey();
    expect(first).toBe(second);
    expect(mockQueryBuilder.getMany).toHaveBeenCalledTimes(1);
});
