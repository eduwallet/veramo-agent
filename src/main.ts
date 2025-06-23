import Debug from 'debug';
const debug = Debug('issuer:agent');

import { initialiseServer } from '#root/server/index';
import { initialiseIssuerStore } from '#root/issuer/Store';
import { initialiseCredentialConfigurationStore } from '#root/credentials/Store';
import { openObserverLog } from '#root/utils/openObserverLog';
import { initialiseVctConfigurationStore } from '#root/vct/Store';
import { getContextConfigurationStore } from '#root/contexts/Store';
import { getDIDConfigurationStore } from '#root/dids/Store'; 

async function main() {
    debug('Loading contexts');
    const contextStore = getContextConfigurationStore();
    await contextStore.init();

    debug('Loading vcts');
    await initialiseVctConfigurationStore().catch((e:any) => console.error(e))

    debug('Loading and/or creating keys and identifiers');
    const didStore = getDIDConfigurationStore();
    await didStore.init();

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
