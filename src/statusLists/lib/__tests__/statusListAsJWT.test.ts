import { vi, expect, test } from 'vitest';
import { Factory } from '@muisit/cryptokey';
import { StatusListType } from '../../../statusLists/StatusListType';
import { StatusList } from '../../../database/entities/StatusList';
import { StatusListStatus } from '../../../types';
import  {Bitstring} from '@digitalcredentials/bitstring';
vi.mock('../../../database/index', () => import('../../../database/__mocks__/index'));
let testkey:any = null;
vi.mock('../../../utils/keymanager.ts', () => ({
    getKey: vi.fn(() => {
        return testkey;
    }),
    getDID: vi.fn(() => {
        return "did:web:example.com";
    })
  }));
import { statusListAsJWT } from '../statusListAsJWT';

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
    testkey = await Factory.createFromType('Ed25519', "fbe04e71bce89f37e0970de16a97a80c4457250c6fe0b1e9297e6df778ae72a8");
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

    const Stype = new StatusListType({});
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

    const jwt = await statusListAsJWT(status);
    expect(jwt).toBeDefined();
    expect(jwt).toBe('eyJhbGciOiJFZERTQSIsImtpZCI6ImRpZDp3ZWI6ZXhhbXBsZS5jb20jMCIsInR5cCI6InN0YXR1c2xpc3Qrand0In0.eyJpc3MiOiJkaWQ6d2ViOmV4YW1wbGUuY29tIiwiZXhwIjoxNTc3ODM3ODIzLCJpYXQiOjE1Nzc4MzY5MjMsInN1YiI6Imh0dHBzOi8vZXhhbXBsZS5jb20iLCJ0dGwiOjMwMCwic3RhdHVzX2xpc3QiOnsiYml0cyI6MSwibHN0IjoiZUp3VDRHQmdZREJnR0hEQVJIVVRIUWpJQXdCUE5nQ0wifX0.Lh8dm2M0ooaNCi1r2TBbao_UPolpdFtCyAe4mivx_hJOsPaFxhdE6p-akEWDAMaph_smwwkkxMHvUvMU8V33Ag');
});
