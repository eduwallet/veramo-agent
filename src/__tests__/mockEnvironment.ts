import Debug from 'debug';
const debug = Debug("mock:env");
import { jest } from '@jest/globals';
import { DataSource } from 'typeorm'

export const mockDataSource: Partial<DataSource> = {} as Partial<DataSource>;

debug('mocking getDbConnection from databaseService', (new Error()).stack)

jest.mock("../../../database", () => ({
    getDbConnection: jest.fn().mockImplementation(() => {
        debug('mocked version of getDBConnection used', (new Error()).stack);
        return Promise.resolve(mockDataSource as DataSource);
    })
}));

debug('mocking getAgent', (new Error()).stack);
jest.mock("../../../agent", () => ({
    getAgent: jest.fn().mockImplementation(() => {
        debug('mocked version of getAgent used', (new Error()).stack);
        return Promise.resolve({});
    })
}));


debug('mocking Issuer', (new Error()).stack);
jest.mock("../../../issuer/Issuer");
debug('importing Issuer from mockEnvironment', (new Error()).stack);
import { Issuer } from "../issuer/Issuer";

export function mockIssuer()
{
    const issuer = new Issuer({
        name: "test",
        baseUrl: "http://here",
        enableCreateCredentials:true,
        did: "did:alias"
    },{
        "credential_configurations_supported": {}
    }) as jest.Mocked<Issuer>;
    return issuer;
}
