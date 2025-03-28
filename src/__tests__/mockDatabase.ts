import { jest } from '@jest/globals';
import { DataSource } from 'typeorm'

export const mockDataSource: Partial<DataSource> = {} as Partial<DataSource>;

jest.unstable_mockModule("../database/databaseService", () => {
    return {
        getDbConnection: jest.fn().mockImplementation(() => {
            return Promise.resolve(mockDataSource as DataSource);
        })
    }
});

export const service = await import("../database/databaseService");
