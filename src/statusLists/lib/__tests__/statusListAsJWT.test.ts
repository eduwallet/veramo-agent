import { inflateSync } from 'zlib';
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

// setState() now runs inside a transaction and re-fetches its row via the
// transactional EntityManager, so the mock needs to support that too.
const mockManager = {
    query: vi.fn().mockResolvedValue(undefined),
    find: vi.fn().mockResolvedValue([]),
    findOne: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockImplementation(async (entity:any) => entity),
};

beforeEach(() => {
    mockRepo.find.mockReset().mockResolvedValue([]);
    mockRepo.save.mockReset().mockResolvedValue(undefined);
    mockManager.query.mockReset().mockResolvedValue(undefined);
    mockManager.find.mockReset().mockResolvedValue([]);
    mockManager.findOne.mockReset().mockResolvedValue(undefined);
    mockManager.save.mockReset().mockImplementation(async (entity:any) => entity);
    vi.mocked(getDbConnection).mockResolvedValue({
        getRepository: () => mockRepo,
        transaction: async (cb:any) => cb(mockManager),
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
    // setState() re-fetches its row via manager.findOne(); since this returns the
    // same object reference, later mutations to lst are still visible when found again.
    mockManager.findOne.mockResolvedValue(lst);
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
    const [header, payload] = jwt.split('.').slice(0, 2).map((part) => JSON.parse(Buffer.from(part, 'base64url').toString()));
    expect(header).toEqual({ alg: 'EdDSA', kid: 'did:web:example.com#0', typ: 'statuslist+jwt' });
    expect(payload.iss).toBe('did:web:example.com');
    expect(payload.sub).toBe('https://example.com');
    expect(payload.ttl).toBe(300);
    expect(payload.status_list.bits).toBe(1);
    // the IETF list numbers the bits of a byte from the least significant bit (draft-ietf-oauth-status-list, 4.1)
    const raw = inflateSync(Buffer.from(payload.status_list.lst, 'base64url'));
    const set:number[] = [];
    for (let i = 0; i < raw.length * 8; i++) {
        if ((raw[i >> 3] >> (i & 7)) & 1) {
            set.push(i);
        }
    }
    expect(set).toEqual([3, 12, 42, 43, 1094, 1745]);
});

test('reverseBitsPerByte', () => {
    expect(Array.from(StatusListType.reverseBitsPerByte(new Uint8Array([0x80, 0x01, 0b10110000, 0xff, 0])))).toEqual([0x01, 0x80, 0b00001101, 0xff, 0]);
});
