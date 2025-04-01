import { test, expect } from 'vitest';
import { getDbConnection } from '../database/databaseService';

test("should call getDbConnection", async () => {
    await getDbConnection();  
    expect(getDbConnection).toHaveBeenCalled();
});
