import Debug from 'debug';
const debug = Debug("agent:main");
import { createAgent, IAgentContext, TAgent } from '@veramo/core'
import { initialiseServer } from './server';
import { setupPlugins, TAgentTypes } from './plugins';
import { getOrCreateDIDs } from "utils/did";
import { initialiseIssuerStore } from 'issuer/Store';
import { initialiseCredentialConfigurationStore } from 'credentials/Store';
import { openObserverLog } from 'utils/openObserverLog';
import { initialiseContextConfigurationStore } from 'contexts/Store';

export var _agent:TAgent<TAgentTypes>|null = null;
export function getAgent():TAgent<TAgentTypes> { 
    if (_agent === null) {
        debug('ERROR: returning null agent value');
    }
    return _agent!; 
}

async function main() {
    debug('Loading contexts');
    await initialiseContextConfigurationStore().catch(e => console.error(e))

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

main().catch(console.log);
