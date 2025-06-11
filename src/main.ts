import Debug from 'debug';
const debug = Debug('issuer:agent');
import { setAgent } from './agent';
import { createAgent, TAgent } from '@veramo/core'
import { initialiseServer } from './server/index';
import { setupPlugins, TAgentTypes } from './plugins';
import { getOrCreateDIDs } from "./utils/did";
import { initialiseIssuerStore } from './issuer/Store';
import { initialiseCredentialConfigurationStore } from './credentials/Store';
import { openObserverLog } from './utils/openObserverLog';
import { initialiseContextConfigurationStore } from './contexts/Store';
import { initialiseVctConfigurationStore } from './vct/Store';

async function main() {
    debug('Loading contexts');
    await initialiseContextConfigurationStore().catch((e:any) => console.error(e))

    debug('Loading vcts');
    await initialiseVctConfigurationStore().catch((e:any) => console.error(e))

    debug('Starting main agent');
    const agent = createAgent<TAgentTypes>({ plugins: await setupPlugins() }) as TAgent<TAgentTypes>;
    setAgent(agent);

    debug('Loading and/or creating DIDs');
    await getOrCreateDIDs().catch((e:any) => console.error(e))

    debug('Loading credential configurations');
    await initialiseCredentialConfigurationStore();

    debug('Creating Issuer instances');
    await initialiseIssuerStore();

    debug("Starting Express Server");
    await initialiseServer();

    debug("Sending initial log message");
    openObserverLog("none", "init", {message:"Started issuer agent"});
}
console.log(process.env.DEBUG);
main().catch(console.log);
