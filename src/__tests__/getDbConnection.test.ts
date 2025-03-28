import { test, expect } from '@jest/globals';
import { service } from './mockDatabase';

import Debug from 'debug';
const debug = Debug('test:test');

import { getDbConnection } from '../database/databaseService';

test("should call getDbConnection", async () => {
    await service.getDbConnection();  
    expect(service.getDbConnection).toHaveBeenCalled();
});
