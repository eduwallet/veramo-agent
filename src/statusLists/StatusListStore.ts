import Debug from 'debug';
const debug = Debug("statuslist:configurations");

import { loadJsonFiles } from "#root/utils/generic";
import { resolveConfPath } from "#root/utils/resolveConfPath";
import { StatusListType } from "./StatusListType.js";
import { StatusListTypeOptions } from "#root/types/internal/statuslists";
import { getDbConnection } from "#root/database/databaseService";
import { StatusListConfiguration } from "#root/database/entities/StatusListConfiguration";
import { hasAdminBearerToken } from '#root/utils/adminBearerToken';

interface StatusListStore {
    [x:string]: StatusListType;
}

const _store:StatusListStore = {};

export function getStatusListStore(): StatusListStore {
    return _store;
}

async function readFromDB()
{
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(StatusListConfiguration);
        const objs = await repo.createQueryBuilder('statuslistconf').getMany();
        for (const obj of objs) {
            const cfg:StatusListTypeOptions = {
                name: obj.name,
                purpose: obj.purpose,
                type: obj.type,
                size: obj.size,
                bitSize: obj.bitsize || 1,
                tokens: JSON.parse(obj.tokens),
                ...(obj.messages && {messages: JSON.parse(obj.messages)})
            };
            const data = new StatusListType(cfg);
            _store[obj.name] = data;
        }
    }
    catch (e) {
        console.error("Caught exception initialising status list configurations", e);
    }
}

async function clearDB()
{
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(StatusListConfiguration);
        await repo.clear();
    }
    catch (e) {
        console.error("Caught exception initialising status list configurations", e);
    }
}

async function readFromFile()
{
    try {
        const dbConnection = await getDbConnection();
        const repo = dbConnection.getRepository(StatusListConfiguration);

        try {
            const options = loadJsonFiles<StatusListTypeOptions>({path: resolveConfPath('lists')});
            for (const opt of options.asArray) {
                if (!_store[opt.name]) {
                    const data = new StatusListType(opt);
                    _store[data.name] = data;

                    const cfg:StatusListConfiguration = new StatusListConfiguration();
                    cfg.name = opt.name;
                    cfg.purpose = opt.purpose;
                    cfg.type = opt.type ?? 'BitstringStatusList';
                    cfg.size = opt.size;
                    cfg.bitsize = opt.bitSize ?? 1;
                    cfg.messages = (opt.messages && opt.messages.length) ? JSON.stringify(opt.messages) : null;
                    cfg.tokens = JSON.stringify(opt.tokens);
                    await repo.save(cfg);
                }
            }    
        }
        catch (e) {
            debug("Missing conf path for status list configurations", e);
        }
    }
    catch (e) {
        console.error("Caught exception initialising status list configurations", e);
    }
}

export async function initialiseStatusListStore() {
    if (hasAdminBearerToken()) {
        await readFromDB();
    }
    else {
        await clearDB();
    }
    await readFromFile();
}