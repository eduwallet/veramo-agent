import { vi, expect, test, beforeEach } from 'vitest';
import { NonceManager } from '../NonceManager.js';
import { getDbConnection } from '#root/database/databaseService';

let executeResult: any;

const mockDeleteBuilder = {
    delete: vi.fn().mockReturnThis(),
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockReturnThis(),
    execute: vi.fn(() => Promise.resolve(executeResult)),
};

const mockRepo = {
    createQueryBuilder: vi.fn(() => mockDeleteBuilder),
    save: vi.fn().mockResolvedValue(undefined),
    findOneBy: vi.fn().mockResolvedValue(null),
};

beforeEach(() => {
    executeResult = { raw: [] };
    mockDeleteBuilder.delete.mockClear();
    mockDeleteBuilder.from.mockClear();
    mockDeleteBuilder.where.mockClear();
    mockDeleteBuilder.returning.mockClear();
    mockDeleteBuilder.execute.mockClear();
    mockRepo.save.mockClear();
    vi.mocked(getDbConnection).mockResolvedValue({
        getRepository: () => mockRepo,
    } as any);
});

test('consumeCNonce rejects a nonce that was never issued, without creating one', async () => {
    executeResult = { raw: [] };
    const manager = new NonceManager('test-issuer');
    const result = await manager.consumeCNonce('never-issued');
    expect(result).toBeNull();
    expect(mockRepo.save).not.toHaveBeenCalled();
});

test('consumeCNonce accepts and atomically removes a valid, unexpired nonce', async () => {
    executeResult = { raw: [{ uuid: 'abc', session: 'session-1', expirationDate: new Date(Date.now() + 60_000) }] };
    const manager = new NonceManager('test-issuer');
    const result = await manager.consumeCNonce('abc');
    expect(result).toEqual({ uuid: 'abc', session: 'session-1' });
    // consumption must happen as a single DELETE statement, not a separate find+delete
    expect(mockDeleteBuilder.execute).toHaveBeenCalledTimes(1);
});

test('consumeCNonce rejects an expired nonce even though it was found and removed', async () => {
    executeResult = { raw: [{ uuid: 'abc', session: '', expirationDate: new Date(Date.now() - 60_000) }] };
    const manager = new NonceManager('test-issuer');
    const result = await manager.consumeCNonce('abc');
    expect(result).toBeNull();
});

test('consumeCNonce rejects an empty id without querying the database', async () => {
    const manager = new NonceManager('test-issuer');
    const result = await manager.consumeCNonce('');
    expect(result).toBeNull();
    expect(mockDeleteBuilder.execute).not.toHaveBeenCalled();
});
