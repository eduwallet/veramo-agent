import { vi, expect, test, beforeEach } from 'vitest';
import { Factory } from '@muisit/cryptokey';
import { StatusListType } from '#root/statusLists/StatusListType';
import { StatusList } from '#root/database/entities/StatusList';
import { StatusListStatus } from '#root/types/internal/statuslists';
import { getDbConnection } from '#root/database/databaseService';
import { Issuer } from '#root/issuer/Issuer';
import { Bitstring } from '@digitalcredentials/bitstring';
import { statusListAsVC } from '../statusListAsVC.js';

const mockRepo = {
    find: vi.fn().mockResolvedValue([]),
    save: vi.fn().mockResolvedValue(undefined),
};

beforeEach(() => {
    mockRepo.find.mockReset().mockResolvedValue([]);
    mockRepo.save.mockReset().mockResolvedValue(undefined);
    vi.mocked(getDbConnection).mockResolvedValue({
        getRepository: () => mockRepo,
    } as any);
});

async function createBasicStatusList(bitSize:number)
{
    const dataList = new Bitstring({length: 1000});
    const contentList = new Bitstring({length: 1000 * bitSize});
    const lst = new StatusList();
    lst.size = 1000;
    lst.bitsize = bitSize;
    lst.content = await dataList.encodeBits();
    lst.revoked = await contentList.encodeBits();
    return lst;
}

test("Creating VC", async () => {
    const testkey = await Factory.createFromType('Ed25519', "fbe04e71bce89f37e0970de16a97a80c4457250c6fe0b1e9297e6df778ae72a8");
    const issuer = { key: testkey, did: { did: 'did:web:example.com' }, basePath: () => '/issuer' } as unknown as Issuer;

    const lst = await createBasicStatusList(2);
    lst.updateDate = new Date('2020-01-01 01:02:03');
    // reserve a bit
    const dataList = new Bitstring({buffer: await Bitstring.decodeBits({encoded:lst.content})});
    dataList.set(1, true);
    dataList.set(6, true);
    dataList.set(21, true);
    dataList.set(203, true);
    dataList.set(547, true);
    dataList.set(872, true);
    // update the list content
    lst.content = await dataList.encodeBits();

    const Stype = new StatusListType({name: 'test', size: 1000} as any, issuer);
    Stype.type = 'StatusList2021';
    Stype.bitSize = 2;
    await Stype.setState(lst, 1, 1);
    await Stype.setState(lst, 6, 2);
    await Stype.setState(lst, 21, 3);
    await Stype.setState(lst, 203, 0);
    await Stype.setState(lst, 547, 2);
    await Stype.setState(lst, 872, 1);

    const status:StatusListStatus = {
        type: Stype,
        statusList: lst,
        basepath: "https://example.com",
        date: '2020-01-01 01:02:03'
    };

    const jwt = await statusListAsVC(status, issuer);
    expect(jwt).toBeDefined();
    expect(jwt).toBe('eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDp3ZWI6ZXhhbXBsZS5jb20jMCIsInR5cCI6Imp3dF92Y19qc29uIiwiaXNzIjoiZGlkOndlYjpleGFtcGxlLmNvbSJ9.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiLCJodHRwczovL3czaWQub3JnL3ZjLXN0YXR1cy1saXN0LTIwMjEvdjEiXSwiaWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIlN0YXR1c0xpc3RDcmVkZW50aWFsIl0sImlzc3VlciI6ImRpZDp3ZWI6ZXhhbXBsZS5jb20iLCJ2YWxpZEZyb20iOiIyMDIwLTAxLTAxVDAxOjAyOjAzWiIsInZhbGlkVW50aWwiOiIyMDIwLTAxLTAxVDAxOjA3OjAzWiIsImlzc3VlZEF0IjoiMjAyMC0wMS0wMVQwMTowMjowM1oiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6Imh0dHBzOi8vZXhhbXBsZS5jb20jbGlzdCIsInR5cGUiOiJTdGF0dXNMaXN0MjAyMSIsImVuY29kZWRMaXN0IjoiSDRzSUFBQUFBQUFBQXhQZ1lHQmdNR0FZY01CRWRSTWRDTWdEQUpsOVJmbjZBQUFBIn0sImlhdCI6MTU3NzgzNjkyMywiZXhwIjoxNTc3ODM3ODIzLCJqdGkiOiJodHRwczovL2V4YW1wbGUuY29tIn0.wwEUyPtmEA_ov1i0bVWpl6IF6fTLOI1sLV8jgjnISdFWhFFQVm-ZqxkG8dkFziEE44nIc0Wqf0c2x9AnLvHXDw');
});

test("Creating VC for Bitstring", async () => {
    const testkey = await Factory.createFromType('Ed25519', "fbe04e71bce89f37e0970de16a97a80c4457250c6fe0b1e9297e6df778ae72a8");
    const issuer = { key: testkey, did: { did: 'did:web:example.com' }, basePath: () => '/issuer' } as unknown as Issuer;

    const lst = await createBasicStatusList(2);
    lst.updateDate = new Date('2020-01-01 01:02:03');
    // reserve a bit
    const dataList = new Bitstring({buffer: await Bitstring.decodeBits({encoded:lst.content})});
    dataList.set(1, true);
    dataList.set(6, true);
    dataList.set(21, true);
    dataList.set(203, true);
    dataList.set(547, true);
    dataList.set(872, true);
    // update the list content
    lst.content = await dataList.encodeBits();

    const Stype = new StatusListType({name: 'test', size: 1000} as any, issuer);
    Stype.type = 'BitstringStatusList';
    Stype.bitSize = 2;
    await Stype.setState(lst, 1, 1);
    await Stype.setState(lst, 6, 2);
    await Stype.setState(lst, 21, 3);
    await Stype.setState(lst, 203, 0);
    await Stype.setState(lst, 547, 2);
    await Stype.setState(lst, 872, 1);

    const status:StatusListStatus = {
        type: Stype,
        statusList: lst,
        basepath: "https://example.com",
        date: '2020-01-01 01:02:03'
    };

    const jwt = await statusListAsVC(status, issuer);
    expect(jwt).toBeDefined();
    expect(jwt).toBe('eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDp3ZWI6ZXhhbXBsZS5jb20jMCIsInR5cCI6Imp3dF92Y19qc29uIiwiaXNzIjoiZGlkOndlYjpleGFtcGxlLmNvbSJ9.eyJAY29udGV4dCI6WyJodHRwczovL3d3dy53My5vcmcvbnMvY3JlZGVudGlhbHMvdjIiXSwiaWQiOiJodHRwczovL2V4YW1wbGUuY29tIiwidHlwZSI6WyJWZXJpZmlhYmxlQ3JlZGVudGlhbCIsIkJpdHN0cmluZ1N0YXR1c0xpc3RDcmVkZW50aWFsIl0sImlzc3VlciI6ImRpZDp3ZWI6ZXhhbXBsZS5jb20iLCJ2YWxpZEZyb20iOiIyMDIwLTAxLTAxVDAxOjAyOjAzWiIsInZhbGlkVW50aWwiOiIyMDIwLTAxLTAxVDAxOjA3OjAzWiIsImlzc3VlZEF0IjoiMjAyMC0wMS0wMVQwMTowMjowM1oiLCJjcmVkZW50aWFsU3ViamVjdCI6eyJpZCI6Imh0dHBzOi8vZXhhbXBsZS5jb20jbGlzdCIsInR5cGUiOiJCaXRzdHJpbmdTdGF0dXNMaXN0IiwiZW5jb2RlZExpc3QiOiJ1SDRzSUFBQUFBQUFBQXhQZ1lHQmdNR0FZY01CRWRSTWRDTWdEQUpsOVJmbjZBQUFBIn0sImlhdCI6MTU3NzgzNjkyMywiZXhwIjoxNTc3ODM3ODIzLCJqdGkiOiJodHRwczovL2V4YW1wbGUuY29tIn0.RCmDu5l41tNG8qR_hiL_M1D33bj8HlTHQCtVm6L9HmzWi1qe7NW-nov43l-wM2dpgu6XWkINNsgvegsuSIfpCQ');
});
