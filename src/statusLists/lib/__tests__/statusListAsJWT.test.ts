import { vi, expect, test, beforeEach } from 'vitest';
import { Factory } from '@muisit/cryptokey';
import { StatusListType } from '#root/statusLists/StatusListType';
import { StatusList } from '#root/database/entities/StatusList';
import { StatusListStatus } from '#root/types/internal/statuslists';
import { getDbConnection } from '#root/database/databaseService';
import { Issuer } from '#root/issuer/Issuer';
import { Bitstring } from '@digitalcredentials/bitstring';
import { statusListAsJWT } from '../statusListAsJWT.js';

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

test("Creating JWT", async () => {
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

    const Stype = new StatusListType({name: 'test', size: 1000, purpose: 'test'}, issuer);
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

    const jwt = await statusListAsJWT(status, issuer);
    expect(jwt).toBeDefined();
    expect(jwt).toBe('eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDp3ZWI6ZXhhbXBsZS5jb20jMCIsInR5cCI6InN0YXR1c2xpc3Qrand0In0.eyJpc3MiOiJkaWQ6d2ViOmV4YW1wbGUuY29tIiwiZXhwIjoxNTc3ODM3ODIzLCJpYXQiOjE1Nzc4MzY5MjMsInN1YiI6Imh0dHBzOi8vZXhhbXBsZS5jb20iLCJ0dGwiOjMwMCwic3RhdHVzX2xpc3QiOnsiYml0cyI6MSwibHN0IjoiZUp3VDRHQmdZREJnR0hEQVJIVVRIUWpJQXdCUE5nQ0wifX0.Lh8dm2M0ooaNCi1r2TBbao_UPolpdFtCyAe4mivx_hJOsPaFxhdE6p-akEWDAMaph_smwwkkxMHvUvMU8V33Ag');
});
