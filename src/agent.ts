import { createAgent, IAgentContext, TAgent } from '@veramo/core'
import { initialiseServer } from './server';
import { plugins, TAgentTypes } from './plugins';
import { getOrCreateDIDs} from "./utils";
import { initialiseIssuerStore } from './issuer/Store';
import { initialiseCredentialStore } from 'credentials/Store';

console.log('Starting main agent');
const agent = createAgent<TAgentTypes>({ plugins}) as TAgent<TAgentTypes>;
export default agent
export const context: IAgentContext<TAgentTypes> = {agent}

console.log('Loading and/or creating DIDs');
await getOrCreateDIDs().catch(e => console.log(e))

console.log('Loading credential configurations');
await initialiseCredentialStore();

console.log('Creating Issuer instances');
await initialiseIssuerStore();

console.log("Starting Express Server");
await initialiseServer();
