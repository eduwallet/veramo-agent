import Debug from 'debug';
const debug = Debug('issuer:agent');
import { createAgent, TAgent } from '@veramo/core'
import { initialiseServer } from './server/index.js';
import { setupPlugins, TAgentTypes } from './plugins.js';
import { getOrCreateDIDs } from "utils/did.js";
import { initialiseIssuerStore } from 'issuer/Store.js';
import { initialiseCredentialConfigurationStore } from 'credentials/Store.js';
import { openObserverLog } from 'utils/openObserverLog.js';
import { initialiseContextConfigurationStore } from 'contexts/Store.js';
import { initialiseVctConfigurationStore } from 'vct/Store.js';

export var _agent:TAgent<TAgentTypes>|null = null;
export function getAgent():TAgent<TAgentTypes> { 
    if (_agent === null) {
        debug('ERROR: returning null agent value');
    }
    return _agent!; 
}

export async function main() {
    debug('Loading contexts');
    await initialiseContextConfigurationStore().catch(e => console.error(e))

    debug('Loading vcts');
    await initialiseVctConfigurationStore().catch(e => console.error(e))

    debug('Starting main agent');
    _agent = createAgent<TAgentTypes>({ plugins: await setupPlugins() }) as TAgent<TAgentTypes>;

    debug('Loading and/or creating DIDs');
    await getOrCreateDIDs().catch(e => console.error(e))

    debug('Loading credential configurations');
    await initialiseCredentialConfigurationStore();

    debug('Creating Issuer instances');
    await initialiseIssuerStore();

    debug("Starting Express Server");
    await initialiseServer();

    debug("Sending initial log message");
    openObserverLog("none", "init", {message:"Started issuer agent"});
}
