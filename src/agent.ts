import { createAgent, IAgentContext, TAgent } from '@veramo/core'
import { configure, expressSupport } from './configuration'
import { plugins, TAgentTypes } from './plugins';

console.log('starting agent');
const agent = createAgent<TAgentTypes>({ plugins}) as TAgent<TAgentTypes>;
export default agent
export const context: IAgentContext<TAgentTypes> = {agent}

console.log('configuring');
await configure(agent, context);

console.log("starting express server");
expressSupport?.start();
console.log("end of agent program");
