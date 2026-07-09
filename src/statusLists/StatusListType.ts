import Debug from 'debug';
const debug = Debug("status:list");
import { getEnv } from "#root/utils/getEnv";
import  {Bitstring} from '@digitalcredentials/bitstring';
import { StatusList } from "#root/database/entities/StatusList";
import { getDbConnection } from "#root/database/databaseService";
import { StatusListInterface, StatusListMessage, StatusListTypeOptions } from '#root/types/internal/statuslists';
import {gzip, ungzip} from 'pako';
import { inflateSync, deflateSync } from 'zlib';
import { toString, fromString } from 'uint8arrays';

export class StatusListType implements StatusListInterface {
    public name:string;
    public id:string;
    public adminTokens:string[];
    public size:number;
    public purpose:string;
    public type:string;
    public bitSize:number;
    public lists:StatusList[];
    public messages?:StatusListMessage[];
    
    public constructor(opts:StatusListTypeOptions)
    {
        this.name = opts.name;
        this.adminTokens = opts.tokens;
        this.size = opts.size;
        this.purpose = opts.purpose;
        this.type = opts.type ?? 'StatusList2020';
        this.bitSize = opts.bitSize ?? 1;
        this.messages = opts.messages;

        this.id = getEnv('BASEURL', '') + '/' + this.name;
        this.lists = [];
    }

    public getCredentialType()
    {
        switch (this.type) {
            case 'BitstringStatusList':
                return 'BitstringStatusListCredential';
            default:
            case 'StatusList2020':
            case 'RevocationList2020Status':
            case 'SuspensionList2020Status':
            case 'StatusList2021':
            case 'RevocationList2021Status':
            case 'SuspensionList2021Status':
                break;
        }
        return 'StatusListCredential';
    }

    public getStatusCredentialType()
    {
        switch (this.type) {
            case 'BitstringStatusList':
                return 'BitstringStatusListEntry';
            case 'RevocationList2020Status':
            case 'SuspensionList2020Status':
            case 'RevocationList2021Status':
            case 'SuspensionList2021Status':
                return this.type;
            case 'StatusList2020':
                if (this.purpose == 'revocation') {
                    return 'RevocationList2020Status';
                }
                else {
                    return 'SuspensionList2020Status';
                }
            case 'StatusList2021':
                if (this.purpose == 'revocation') {
                    return 'RevocationList2021Status';
                }
                else {
                    return 'SuspensionList2021Status';
                }
        }
        return 'StatusListStatus';
    }

    public async loadLists()
    {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(StatusList);
        this.lists = await repo.find({where:{name: this.name}, order: {index:'ASC'}});
    }

    public async get(index:number)
    {
        await this.loadLists();
        for (const list of this.lists) {
            if (list.index == index) {
                return list;
            }
        }
        throw new Error("No such list");
    }

    public createCredentialUrl(listIndex?:number)
    {
        return getEnv('BASEURL', '') + '/' + this.name + '/' + (listIndex != undefined ? listIndex : '');
    }

    public async newIndex(expirationDate:Date|null|undefined)
    {
        debug("creating new index with expiration ", expirationDate);
        // reload the lists to ensure that we have the latest situation in a multi-user environment
        // TODO: implement a central location or job processor to set the list values
        // to prevent problems. Alternatively, each single-threaded issuer can have its own single-threaded
        // statuslist agent, working around such problems.
        await this.loadLists();
        for (const lst of this.lists) {
            if (lst.used < (0.9 * lst.size)) {
                try {
                    return await this.returnNewIndexFromList(lst, expirationDate);
                }
                catch (e) {
                    // any error caught will cause us to create a new list
                    console.log(e);
                }
            }
        }
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(StatusList);
        const list = new StatusList();
        list.name = this.name;
        if (this.lists.length > 0) {
            list.index = this.lists[this.lists.length - 1].index + 1;
        }
        else {
            list.index = 1;
        }
        list.size = this.size;
        list.used = 0;
        list.bitsize = this.bitSize ?? 1;
        const dataList = new Bitstring({length: list.size});
        list.content = await dataList.encodeBits();
        const contentList = new Bitstring({length: list.size * list.bitsize});
        list.revoked = await contentList.encodeBits();
        await repo.save(list); // create the list id, but this may be superfluous

        this.lists.push(list);

        // no try-catch: if we fail here, something else is amiss
        return await this.returnNewIndexFromList(list, expirationDate);
    }

    private async returnNewIndexFromList(list:StatusList, expirationDate:Date|null|undefined)
    {
        debug("returning new index from list");
        // look in the 'content' list to see if we have a spot available
        const dataList = new Bitstring({buffer: await Bitstring.decodeBits({encoded:list.content})});

        let index = -1;
        let tries = 10000;
        while (index < 0 && tries > 0) {
            tries -= 1;
            index = Math.floor(Math.random() * list.size);
            if (dataList.get(index)) {
                index = -1;
            }
        }
        if (index < 0) {
            debug("list appears to be full");
            throw new Error("List appears full");
        }

        debug("found index ", index);
        dataList.set(index, true);
        // update the list content
        list.content = await dataList.encodeBits();
        list.used = list.used + 1;
        // update the expiry date to keep track of when the entire list will expire
        if (expirationDate && (!list.expirationDate || expirationDate > list.expirationDate)) {
            list.expirationDate = expirationDate;
        }

        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(StatusList);
        await repo.save(list);

        return {
            list,
            index
        };
    }

    public async revoke(list:StatusList, index:number, doRevoke:boolean):Promise<string>
    {
        debug("revoking index ", index, doRevoke);
        const state = await this.setState(list, index, doRevoke ? 1 : 0, -1);
        if (state == 'CHANGED') {
            if (doRevoke) {
                return 'REVOKED';
            }
            else {
                return 'UNREVOKED';
            }
        }
        return state;
    }

    private getStateValue(bitString:Bitstring, index:number, bitSize:number)
    {
        let retval:number = 0;
        for(let i = 0;i < bitSize; i++) {
            const bitval = bitString.get((index * bitSize) + i);
            retval = (retval << 1) | (bitval ? 1 : 0);
        }
        return retval;
    }

    private setStateValue(bitString:Bitstring, index:number, state:number, bitSize:number)
    {
        for(let i = 0;i < bitSize; i++) {
            // MSB first
            const valueToSet = ((state & (1 << (bitSize - i - 1))) != 0)  ? true : false;
            bitString.set((index * bitSize) + i, valueToSet);
        }
    }

    public async setState(list:StatusList, index:number, newState:number, mask:number = -1):Promise<string>
    {
        debug("setting state at index ", index, newState, mask);
        const dataList = new Bitstring({buffer:await Bitstring.decodeBits({encoded:list.content})});
        const revokeList = new Bitstring({buffer: await Bitstring.decodeBits({encoded:list.revoked})});

        let retval:string = 'UNKNOWN';

        // mask out the bits that are not relevant
        // use the bitsize of the database entry instead of the default-size-for-new-lists defined on 
        // the overall type. In theory, we could then support lists of different sizes, but that
        // would be strange
        const bitSizeMask = (1 << (list.bitsize ?? 1)) - 1;
        newState = newState & bitSizeMask;

        if (dataList.get(index)) {
            const state = this.getStateValue(revokeList, index, list.bitsize ?? 1);
            if ((state & mask) == (newState & mask)) {
                retval = 'UNCHANGED';
            }
            else {
                const adjustedState = (state & ~mask) | (newState & mask);
                this.setStateValue(revokeList, index, adjustedState, list.bitsize ?? 1);
                retval = 'CHANGED';
            }

            if (retval != 'UNCHANGED') {
                list.revoked = await revokeList.encodeBits();
                const dbConnection = await getDbConnection();
                const repo = dbConnection.getRepository(StatusList);
                await repo.save(list);
            }
        }
        else {
            throw new Error("Credential is not enabled");
        }
        return retval;
    }

    public async getState(list:StatusList, index:number) {
        const dataList = new Bitstring({buffer: await Bitstring.decodeBits({encoded:list.content})});
        const revokeList = new Bitstring({buffer: await Bitstring.decodeBits({encoded:list.revoked})});

        if (dataList.get(index)) {
            return this.getStateValue(revokeList, index, list.bitsize ?? 1);
        }
        else {
            throw new Error("Credential is not enabled");
        }
    }
    
    public static async toZlibCompression(list:StatusList)
    {
        const buffer = await Bitstring.decodeBits({encoded:list.revoked})
        return toString(deflateSync(buffer), 'base64url');
    }

    // this routine is not used, but it is here for completeness sake
    public static async fromZlibCompression(data:string)
    {
        return inflateSync(fromString(data, 'base64url'));
    }

    public static async toBase64Encoding(list:StatusList)
    {
        const buffer = await Bitstring.decodeBits({encoded:list.revoked})
        return toString(await gzip(buffer), 'base64');
    }

    // this routine is not used, but is here for completeness sake
    public static async fromBase64Encoding(data:string)
    {
        return await ungzip(fromString(data, 'base64'));
    }

    public static async toMultibaseEncoding(list:StatusList)
    {
        const buffer = await Bitstring.decodeBits({encoded:list.revoked})
        return 'u' + toString(await gzip(buffer), 'base64url');
    }

    // this routine is not used, but is here for completeness sake
    public static async fromMultibaseEncoding(data:string)
    {
        let buffer = null;
        // these two methods are defined in the spec
        if (data[0] === 'u') {
            buffer = fromString(data.substring(1), 'base64url');
        }
        else if(data[0] == 'z') {
            buffer = fromString(data.substring(1), 'base58btc');
        }
        return await ungzip(buffer);
    }

}
