import { expect, test } from 'vitest';
import { createStatusCredential } from '../createStatusCredential.js';
import { Bitstring } from '@digitalcredentials/bitstring';
import { StatusList } from '#root/database/entities/StatusList';
import { StatusListType } from '#root/statusLists/StatusListType';
import { getEnv } from '#root/utils/getEnv';
import { Issuer } from '#root/issuer/Issuer';

const issuer = { basePath: () => '/issuer', options: { baseUrl: getEnv('BASEURL', '') + '/issuer' } } as unknown as Issuer;

async function createBasicStatusList(index: number, bitSize:number)
{
    const dataList = new Bitstring({length: 1000});
    const contentList = new Bitstring({length: 1000 * bitSize});
    const lst = new StatusList();
    lst.size = 1000;
    lst.index = index;
    lst.bitsize = bitSize;
    lst.content = await dataList.encodeBits();
    lst.revoked = await contentList.encodeBits();
    return lst;
}

test("Basic Credential", async () => {
    const envval = getEnv('BASEURL', '');
    const Stype = new StatusListType({name: 'mylist', type:"BitstringStatusList", purpose:"purpose", size: 1000}, issuer);
    const lst = await createBasicStatusList(18, 1);
    const result = createStatusCredential(Stype, lst, 1241);

    expect(result).toBeDefined();
    expect(result.id).toBe(envval + '/issuer/sl/mylist/18#1241');
    expect(result.type).toBe('BitstringStatusListEntry');
    expect(result.statusListIndex).toBe(1241);
    expect(result.statusListCredential).toBe(envval + '/issuer/sl/mylist/18');
    expect(result.statusPurpose).toBe('purpose');
    expect(result.statusSize).toBeUndefined();
    expect(result.statusMessage).toBeUndefined();

});


test("IETF Credential", async () => {
    const envval = getEnv('BASEURL', '');
    const Stype = new StatusListType({name: 'mylist', type:"statuslist+jwt", purpose:"purpose", size: 1000}, issuer);
    const lst = await createBasicStatusList(18, 1);
    const result = createStatusCredential(Stype, lst, 1241);

    expect(result).toBeDefined();
    expect(result.uri).toBe(envval + '/issuer/sl/mylist/18');
    expect(result.idx).toBe(1241);
});



test("Old revocation Credential", async () => {
    const envval = getEnv('BASEURL', '');
    const Stype = new StatusListType({name: 'mylist', type:"StatusList2021", purpose:"revocation", size: 1000}, issuer);
    const lst = await createBasicStatusList(18, 1);
    const result = createStatusCredential(Stype, lst, 1241);

    expect(result).toBeDefined();
    expect(result.id).toBe(envval + '/issuer/sl/mylist/18#1241');
    expect(result.type).toBe('RevocationList2021Status');
    expect(result.statusListIndex).toBe(1241);
    expect(result.statusListCredential).toBe(envval + '/issuer/sl/mylist/18');
    expect(result.statusPurpose).toBeUndefined();
    expect(result.statusSize).toBeUndefined();
    expect(result.statusMessage).toBeUndefined();

});

test("Multi bit Credential", async () => {
    const envval = getEnv('BASEURL', '');
    const Stype = new StatusListType({name: 'mylist', type:"BitstringStatusList", purpose:"purpose", bitSize: 2, size: 1000}, issuer);
    const lst = await createBasicStatusList(18, 1);
    const result = createStatusCredential(Stype, lst, 1241);

    expect(result).toBeDefined();
    expect(result.id).toBe(envval + '/issuer/sl/mylist/18#1241');
    expect(result.type).toBe('BitstringStatusListEntry');
    expect(result.statusListIndex).toBe(1241);
    expect(result.statusListCredential).toBe(envval + '/issuer/sl/mylist/18');
    expect(result.statusPurpose).toBe('purpose');
    expect(result.statusSize).toBe(2);
    expect(result.statusMessage).toBeDefined();
    expect(result.statusMessage.length).toBe(4);
});

test("Multi bit Credential with messages", async () => {
    const envval = getEnv('BASEURL', '');
    const Stype = new StatusListType({name: 'mylist', type:"BitstringStatusList", purpose:"purpose", bitSize: 2, size: 1000, messages: [{a:1}]}, issuer);
    const lst = await createBasicStatusList(18, 1);
    const result = createStatusCredential(Stype, lst, 1241);

    expect(result).toBeDefined();
    expect(result.id).toBe(envval + '/issuer/sl/mylist/18#1241');
    expect(result.type).toBe('BitstringStatusListEntry');
    expect(result.statusListIndex).toBe(1241);
    expect(result.statusListCredential).toBe(envval + '/issuer/sl/mylist/18');
    expect(result.statusPurpose).toBe('purpose');
    expect(result.statusSize).toBe(2);
    expect(result.statusMessage).toBeDefined();
    expect(result.statusMessage.length).toBe(1);
});
