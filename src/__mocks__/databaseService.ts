import { vi } from 'vitest';

export const getDbConnection = vi.fn().mockResolvedValue({
  query: vi.fn(),
  close: vi.fn(),
});
