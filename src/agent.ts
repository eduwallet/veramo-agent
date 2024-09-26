import { createAgent, IAgentContext, TAgent } from '@veramo/core'
import { initialiseServer } from './server';
import { plugins, TAgentTypes } from './plugins';
import { getOrCreateDIDs } from "./utils";
import { initialiseIssuerStore } from './issuer/Store';
import { initialiseCredentialConfigurationStore } from 'credentials/Store';
import { debug } from '@utils/logger';
import { openObserverLog } from '@utils/openObserverLog';

debug('Starting main agent');
const agent = createAgent<TAgentTypes>({ plugins }) as TAgent<TAgentTypes>;
export default agent
export const context: IAgentContext<TAgentTypes> = { agent }

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
